const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { visibleDepartmentIds, UNIVERSITY_ROLES } = require('../middleware/scope');

const router = express.Router();

router.get('/summary', requireAuth, async (req, res) => {
  const { audit_cycle_id } = req.query;
  const scope = await visibleDepartmentIds(req.user);

  const params = [];
  const conditions = [];
  if (audit_cycle_id) { params.push(audit_cycle_id); conditions.push(`s.audit_cycle_id = $${params.length}`); }
  if (!scope.all) {
    if (scope.ids.length === 0) { conditions.push('false'); }
    else { params.push(scope.ids); conditions.push(`s.school_id = ANY($${params.length})`); }
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: byStatus } = await pool.query(
    `SELECT s.status, COUNT(*)::int AS count FROM submissions s ${where} GROUP BY s.status`, params);

  const { rows: byDepartment } = await pool.query(
    `SELECT sc.name AS department_name, c.name AS campus_name,
            COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE s.status = 'finalized')::int AS finalized
     FROM submissions s
     JOIN schools sc ON sc.id = s.school_id
     LEFT JOIN campuses c ON c.id = sc.campus_id
     ${where}
     GROUP BY sc.name, c.name ORDER BY c.name, sc.name`, params);

  let byCampus = [];
  if (UNIVERSITY_ROLES.includes(req.user.role)) {
    ({ rows: byCampus } = await pool.query(
      `SELECT c.name AS campus_name,
              COUNT(DISTINCT sc.id)::int AS departments,
              COUNT(s.id)::int AS total,
              COUNT(s.id) FILTER (WHERE s.status = 'finalized')::int AS finalized
       FROM campuses c
       LEFT JOIN schools sc ON sc.campus_id = c.id
       LEFT JOIN submissions s ON s.school_id = sc.id
            ${audit_cycle_id ? 'AND s.audit_cycle_id = $1' : ''}
       GROUP BY c.name ORDER BY c.name`, audit_cycle_id ? [audit_cycle_id] : []));
  }

  res.json({ scope: scope.all ? 'university' : req.user.role, byStatus, byCampus, byDepartment });
});

module.exports = router;
