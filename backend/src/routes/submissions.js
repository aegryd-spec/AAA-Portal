const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole, scopeToOwnSchool } = require('../middleware/auth');

const router = express.Router();

// Valid forward transitions, keyed by who is allowed to trigger them.
const TRANSITIONS = {
  draft: { submitted: ['school_coordinator', 'faculty', 'super_admin'] },
  submitted: {
    dvv_review: ['iqac', 'super_admin'],
    clarification_requested: ['iqac', 'super_admin'],
  },
  clarification_requested: { submitted: ['school_coordinator', 'faculty', 'super_admin'] },
  dvv_review: {
    dvv_verified: ['iqac', 'super_admin'],
    clarification_requested: ['iqac', 'super_admin'],
  },
  dvv_verified: { peer_review: ['iqac', 'super_admin'] },
  peer_review: { finalized: ['peer_team', 'iqac', 'super_admin'] },
};

// List submissions — filterable by audit_cycle_id, school_id, status, criterion_id
router.get('/', requireAuth, scopeToOwnSchool, async (req, res) => {
  const { audit_cycle_id, school_id, status, criterion_id } = req.query;
  const conditions = [];
  const params = [];

  if (audit_cycle_id) { params.push(audit_cycle_id); conditions.push(`s.audit_cycle_id = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`s.status = $${params.length}`); }
  if (criterion_id) { params.push(criterion_id); conditions.push(`ki.criterion_id = $${params.length}`); }

  // Non-cross-school roles are locked to their own school regardless of query param.
  const effectiveSchoolId = ['super_admin', 'iqac', 'peer_team', 'viewer'].includes(req.user.role)
    ? school_id
    : req.user.school_id;
  if (effectiveSchoolId) { params.push(effectiveSchoolId); conditions.push(`s.school_id = $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await pool.query(
    `SELECT s.*, m.code AS metric_code, m.title AS metric_title, m.metric_type, m.max_score,
            sc.name AS school_name, ki.code AS ki_code, ki.criterion_id
     FROM submissions s
     JOIN metrics m ON m.id = s.metric_id
     JOIN key_indicators ki ON ki.id = m.key_indicator_id
     JOIN schools sc ON sc.id = s.school_id
     ${where}
     ORDER BY m.sort_order`,
    params
  );
  res.json(rows);
});

// Get / create-on-demand a single school's submission for one metric+cycle (upsert draft)
router.post('/upsert', requireAuth, scopeToOwnSchool, async (req, res) => {
  const { audit_cycle_id, metric_id, response_text, self_score } = req.body;
  const school_id = ['super_admin', 'iqac'].includes(req.user.role) ? req.body.school_id : req.user.school_id;
  if (!audit_cycle_id || !metric_id || !school_id) {
    return res.status(400).json({ error: 'audit_cycle_id, metric_id, school_id required' });
  }

  const { rows } = await pool.query(
    `INSERT INTO submissions (audit_cycle_id, metric_id, school_id, response_text, self_score, submitted_by, status)
     VALUES ($1,$2,$3,$4,$5,$6,'draft')
     ON CONFLICT (audit_cycle_id, metric_id, school_id)
     DO UPDATE SET response_text = EXCLUDED.response_text,
                   self_score = EXCLUDED.self_score,
                   updated_at = now()
     WHERE submissions.status IN ('draft','clarification_requested')
     RETURNING *`,
    [audit_cycle_id, metric_id, school_id, response_text, self_score, req.user.sub]
  );
  if (!rows[0]) {
    return res.status(409).json({ error: 'Submission is locked (not in an editable state)' });
  }
  res.json(rows[0]);
});

// Status transition
router.post('/:id/transition', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { to_status, verified_score } = req.body;

  const { rows: existingRows } = await pool.query('SELECT * FROM submissions WHERE id = $1', [id]);
  const submission = existingRows[0];
  if (!submission) return res.status(404).json({ error: 'Submission not found' });

  if (!['super_admin', 'iqac', 'peer_team'].includes(req.user.role) && submission.school_id !== req.user.school_id) {
    return res.status(403).json({ error: 'Cannot modify another school\'s submission' });
  }

  const allowedTargets = TRANSITIONS[submission.status] || {};
  const allowedRoles = allowedTargets[to_status];
  if (!allowedRoles) {
    return res.status(400).json({ error: `Cannot move from ${submission.status} to ${to_status}` });
  }
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ error: `Role ${req.user.role} cannot perform this transition` });
  }

  // Mandatory-document rule: a submission cannot be moved to "submitted"
  // if its metric requires supporting documents and none are attached.
  if (to_status === 'submitted') {
    const { rows: check } = await pool.query(
      `SELECT m.requires_document,
              (SELECT COUNT(*) FROM evidence_documents e WHERE e.submission_id = s.id) AS evidence_count
       FROM submissions s JOIN metrics m ON m.id = s.metric_id
       WHERE s.id = $1`,
      [id]
    );
    if (check[0]?.requires_document && Number(check[0].evidence_count) === 0) {
      return res.status(422).json({
        error: 'This metric requires at least one supporting document. Please upload evidence before submitting.',
        code: 'EVIDENCE_REQUIRED',
      });
    }
  }

  const setSubmittedAt = to_status === 'submitted' ? ', submitted_at = now()' : '';
  const setScore = verified_score !== undefined ? ', verified_score = $3' : '';
  const params = verified_score !== undefined ? [to_status, id, verified_score] : [to_status, id];

  const { rows } = await pool.query(
    `UPDATE submissions SET status = $1, updated_at = now()${setSubmittedAt}${setScore} WHERE id = $2 RETURNING *`,
    params
  );

  await pool.query(
    `INSERT INTO audit_log (actor_id, action, entity_type, entity_id, details)
     VALUES ($1,'transition','submission',$2,$3)`,
    [req.user.sub, id, JSON.stringify({ from: submission.status, to: to_status })]
  );

  res.json(rows[0]);
});

// Review comments (DVV clarifications, peer team notes)
router.get('/:id/comments', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT rc.*, u.name AS author_name FROM review_comments rc
     JOIN users u ON u.id = rc.author_id WHERE submission_id = $1 ORDER BY created_at`,
    [req.params.id]
  );
  res.json(rows);
});

router.post('/:id/comments', requireAuth, async (req, res) => {
  const { comment } = req.body;
  if (!comment) return res.status(400).json({ error: 'comment required' });
  const { rows } = await pool.query(
    `INSERT INTO review_comments (submission_id, author_id, role_code, comment)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, req.user.sub, req.user.role, comment]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
