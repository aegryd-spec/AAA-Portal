const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Submission-status counts, scoped to the caller's school unless they're
// a cross-institution role.
router.get('/summary', requireAuth, async (req, res) => {
  const { audit_cycle_id } = req.query;
  const params = [];
  const conditions = [];
  if (audit_cycle_id) { params.push(audit_cycle_id); conditions.push(`s.audit_cycle_id = $${params.length}`); }
  if (!['super_admin', 'iqac', 'peer_team', 'viewer'].includes(req.user.role)) {
    params.push(req.user.school_id); conditions.push(`s.school_id = $${params.length}`);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: byStatus } = await pool.query(
    `SELECT s.status, COUNT(*)::int AS count FROM submissions s ${where} GROUP BY s.status`,
    params
  );
  const { rows: bySchool } = await pool.query(
    `SELECT sc.name AS school_name,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE s.status = 'finalized')::int AS finalized
     FROM submissions s JOIN schools sc ON sc.id = s.school_id
     ${where}
     GROUP BY sc.name ORDER BY sc.name`,
    params
  );
  res.json({ byStatus, bySchool });
});

module.exports = router;
