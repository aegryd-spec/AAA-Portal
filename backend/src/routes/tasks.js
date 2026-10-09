const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Who may assign to whom:
// - super_admin, iqac -> any user
// - school_coordinator -> faculty in their own school
async function canAssign(assigner, assigneeId) {
  if (['super_admin', 'iqac'].includes(assigner.role)) return true;
  if (assigner.role === 'school_coordinator') {
    const { rows } = await pool.query('SELECT role_code, school_id FROM users WHERE id = $1', [assigneeId]);
    const a = rows[0];
    return a && a.role_code === 'faculty' && a.school_id === assigner.school_id;
  }
  return false;
}

async function notify(userId, type, taskId, message) {
  await pool.query(
    'INSERT INTO notifications (user_id, type, task_id, message) VALUES ($1,$2,$3,$4)',
    [userId, type, taskId, message]
  );
}

// Create / assign a task (optionally tied to a metric = "new thread from criteria")
router.post('/', requireAuth, async (req, res) => {
  const { assigned_to, title, description, task_type, due_date, metric_id, submission_id, school_id, audit_cycle_id } = req.body;
  if (!assigned_to || !title) return res.status(400).json({ error: 'assigned_to and title are required' });

  if (!(await canAssign(req.user, assigned_to))) {
    return res.status(403).json({ error: 'You are not permitted to assign tasks to this user' });
  }

  const { rows } = await pool.query(
    `INSERT INTO tasks (audit_cycle_id, metric_id, submission_id, school_id, task_type, title, description, assigned_by, assigned_to, due_date)
     VALUES ($1,$2,$3,$4,COALESCE($5,'general'),$6,$7,$8,$9,$10) RETURNING *`,
    [audit_cycle_id, metric_id, submission_id, school_id, task_type, title, description, req.user.sub, assigned_to, due_date]
  );
  const task = rows[0];

  const due = due_date ? ` (due ${due_date})` : '';
  await notify(assigned_to, 'task_assigned', task.id,
    `${req.user.name} assigned you: "${title}"${due}`);

  res.status(201).json(task);
});

// List tasks. ?box=inbox (assigned to me) | outbox (assigned by me); ?status=...
router.get('/', requireAuth, async (req, res) => {
  const { box = 'inbox', status } = req.query;
  const params = [req.user.sub];
  let where = box === 'outbox' ? 't.assigned_by = $1' : 't.assigned_to = $1';
  if (status) { params.push(status); where += ` AND t.status = $${params.length}`; }

  const { rows } = await pool.query(
    `SELECT t.*,
            ab.name AS assigned_by_name, ab.role_code AS assigned_by_role,
            at.name AS assigned_to_name, at.role_code AS assigned_to_role,
            m.code AS metric_code, m.title AS metric_title,
            sc.name AS school_name
     FROM tasks t
     JOIN users ab ON ab.id = t.assigned_by
     JOIN users at ON at.id = t.assigned_to
     LEFT JOIN metrics m ON m.id = t.metric_id
     LEFT JOIN schools sc ON sc.id = t.school_id
     WHERE ${where}
     ORDER BY (t.status IN ('completed','cancelled')), t.due_date NULLS LAST, t.created_at DESC`,
    params
  );
  res.json(rows);
});

// Assignee moves task to in_progress
router.post('/:id/start', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.assigned_to !== req.user.sub) return res.status(403).json({ error: 'Only the assignee can start this task' });
  if (task.status !== 'open') return res.status(400).json({ error: `Cannot start a task that is ${task.status}` });

  const upd = await pool.query(
    `UPDATE tasks SET status = 'in_progress', updated_at = now() WHERE id = $1 RETURNING *`, [req.params.id]);
  res.json(upd.rows[0]);
});

// Assignee completes the task -> compute on_time/delayed, notify the assigner
router.post('/:id/complete', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.assigned_to !== req.user.sub) return res.status(403).json({ error: 'Only the assignee can complete this task' });
  if (['completed', 'cancelled'].includes(task.status)) return res.status(400).json({ error: `Task is already ${task.status}` });

  // On time if no due date, or completed on/before the end of the due date.
  const { rows: stateRows } = await pool.query(
    `SELECT CASE
        WHEN $1::date IS NULL THEN 'on_time'
        WHEN now() <= ($1::date + interval '1 day' - interval '1 second') THEN 'on_time'
        ELSE 'delayed' END AS state`,
    [task.due_date]
  );
  const state = stateRows[0].state;

  const upd = await pool.query(
    `UPDATE tasks SET status='completed', completed_at=now(), completion_state=$2, updated_at=now()
     WHERE id=$1 RETURNING *`, [req.params.id, state]);

  const label = state === 'on_time' ? 'on time' : 'after the due date (delayed)';
  await notify(task.assigned_by, 'task_completed', task.id,
    `${req.user.name} completed "${task.title}" ${label}`);

  res.json(upd.rows[0]);
});

// Assigner cancels a task
router.post('/:id/cancel', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM tasks WHERE id = $1', [req.params.id]);
  const task = rows[0];
  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (task.assigned_by !== req.user.sub && !['super_admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Only the assigner can cancel this task' });
  }
  const upd = await pool.query(
    `UPDATE tasks SET status='cancelled', updated_at=now() WHERE id=$1 RETURNING *`, [req.params.id]);
  await notify(task.assigned_to, 'task_updated', task.id, `"${task.title}" was cancelled`);
  res.json(upd.rows[0]);
});

// Assignable users (for the assign form). super_admin/iqac -> all; coordinator -> own faculty.
router.get('/assignable-users', requireAuth, async (req, res) => {
  if (['super_admin', 'iqac'].includes(req.user.role)) {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role_code, s.name AS school_name
       FROM users u LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.is_active = true AND u.id <> $1 ORDER BY u.name`, [req.user.sub]);
    return res.json(rows);
  }
  if (req.user.role === 'school_coordinator') {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.role_code, s.name AS school_name
       FROM users u LEFT JOIN schools s ON s.id = u.school_id
       WHERE u.is_active = true AND u.role_code = 'faculty' AND u.school_id = $1 ORDER BY u.name`,
      [req.user.school_id]);
    return res.json(rows);
  }
  res.json([]);
});

module.exports = router;
