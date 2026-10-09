const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { visibleDepartmentIds } = require('../middleware/scope');

const router = express.Router();

// Wrap async handlers so a thrown error becomes a clean JSON response
// instead of an unhandled rejection that could crash the process.
const H = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  const dup = e && e.code === '23505';
  res.status(dup ? 409 : 500).json({ error: dup ? 'That code already exists' : 'Server error' });
});

// List campuses visible to the caller.
router.get('/', requireAuth, H(async (req, res) => {
  if (['super_admin', 'iqac', 'peer_team', 'viewer'].includes(req.user.role)) {
    const { rows } = await pool.query(
      `SELECT c.*, d.name AS director_name,
              (SELECT COUNT(*)::int FROM schools s WHERE s.campus_id = c.id) AS department_count
       FROM campuses c LEFT JOIN users d ON d.id = c.director_id ORDER BY c.name`);
    return res.json(rows);
  }
  const { rows } = await pool.query(
    `SELECT c.*, d.name AS director_name,
            (SELECT COUNT(*)::int FROM schools s WHERE s.campus_id = c.id) AS department_count
     FROM campuses c LEFT JOIN users d ON d.id = c.director_id WHERE c.id = $1`,
    [req.user.campus_id]);
  res.json(rows);
}));

// Create a campus (tenant) — Super Admin / University IQAC
router.post('/', requireAuth, requireRole('super_admin', 'iqac'), H(async (req, res) => {
  const { code, name, location } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name required' });
  const { rows } = await pool.query(
    'INSERT INTO campuses (code, name, location) VALUES ($1,$2,$3) RETURNING *',
    [code, name, location || null]);
  res.status(201).json(rows[0]);
}));

// Assign / change a campus director (tenant admin)
router.post('/:id/assign-director', requireAuth, requireRole('super_admin', 'iqac'), H(async (req, res) => {
  const { user_id } = req.body;
  await pool.query('UPDATE campuses SET director_id = $1 WHERE id = $2', [user_id, req.params.id]);
  if (user_id) await pool.query('UPDATE users SET campus_id = $1 WHERE id = $2', [req.params.id, user_id]);
  res.json({ ok: true });
}));

// List departments, scoped to what the caller may see.
router.get('/departments', requireAuth, H(async (req, res) => {
  const scope = await visibleDepartmentIds(req.user);
  let rows;
  if (scope.all) {
    ({ rows } = await pool.query(
      `SELECT s.*, c.name AS campus_name, c.code AS campus_code, d.name AS director_name
       FROM schools s LEFT JOIN campuses c ON c.id = s.campus_id
       LEFT JOIN users d ON d.id = s.director_id ORDER BY c.name, s.name`));
  } else if (scope.ids.length === 0) {
    rows = [];
  } else {
    ({ rows } = await pool.query(
      `SELECT s.*, c.name AS campus_name, c.code AS campus_code, d.name AS director_name
       FROM schools s LEFT JOIN campuses c ON c.id = s.campus_id
       LEFT JOIN users d ON d.id = s.director_id
       WHERE s.id = ANY($1) ORDER BY c.name, s.name`, [scope.ids]));
  }
  res.json(rows);
}));

// Create a department under a campus.
router.post('/departments', requireAuth, H(async (req, res) => {
  const { code, name, campus_id } = req.body;
  if (!code || !name || !campus_id) return res.status(400).json({ error: 'code, name, campus_id required' });
  const allowed = ['super_admin', 'iqac'].includes(req.user.role)
    || (req.user.role === 'campus_director' && req.user.campus_id === campus_id);
  if (!allowed) return res.status(403).json({ error: 'Not permitted to add departments to this campus' });
  const { rows } = await pool.query(
    'INSERT INTO schools (code, name, type, campus_id) VALUES ($1,$2,$3,$4) RETURNING *',
    [code, name, 'Department', campus_id]);
  res.status(201).json(rows[0]);
}));

// Assign the department director.
router.post('/departments/:id/assign-director', requireAuth, H(async (req, res) => {
  const { user_id } = req.body;
  const { rows: deptRows } = await pool.query('SELECT * FROM schools WHERE id = $1', [req.params.id]);
  const dept = deptRows[0];
  if (!dept) return res.status(404).json({ error: 'Department not found' });
  const allowed = ['super_admin', 'iqac'].includes(req.user.role)
    || (req.user.role === 'campus_director' && req.user.campus_id === dept.campus_id);
  if (!allowed) return res.status(403).json({ error: 'Not permitted to assign a director here' });
  await pool.query('UPDATE schools SET director_id = $1 WHERE id = $2', [user_id, req.params.id]);
  if (user_id) await pool.query('UPDATE users SET school_id = $1, campus_id = $2 WHERE id = $3',
    [req.params.id, dept.campus_id, user_id]);
  res.json({ ok: true });
}));

// Assign the responsible faculty / coordinator for a department.
router.post('/departments/:id/assign-coordinator', requireAuth, H(async (req, res) => {
  const { user_id } = req.body;
  const { rows: deptRows } = await pool.query('SELECT * FROM schools WHERE id = $1', [req.params.id]);
  const dept = deptRows[0];
  if (!dept) return res.status(404).json({ error: 'Department not found' });
  const allowed = ['super_admin', 'iqac'].includes(req.user.role)
    || (req.user.role === 'campus_director' && req.user.campus_id === dept.campus_id)
    || (req.user.role === 'department_director' && dept.director_id === req.user.sub);
  if (!allowed) return res.status(403).json({ error: 'Not permitted to assign a coordinator here' });
  if (!user_id) return res.status(400).json({ error: 'user_id required' });
  await pool.query('UPDATE users SET school_id = $1, campus_id = $2 WHERE id = $3',
    [req.params.id, dept.campus_id, user_id]);
  res.json({ ok: true });
}));

module.exports = router;
