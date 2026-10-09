const express = require('express');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Full nested tree: Criteria -> Key Indicators -> Metrics (+ benchmark bands)
router.get('/', requireAuth, async (req, res) => {
  const { rows: criteria } = await pool.query('SELECT * FROM criteria ORDER BY sort_order');
  const { rows: kis } = await pool.query('SELECT * FROM key_indicators ORDER BY sort_order');
  const { rows: metrics } = await pool.query('SELECT * FROM metrics ORDER BY sort_order');
  const { rows: benchmarks } = await pool.query('SELECT * FROM metric_benchmarks ORDER BY band DESC');

  const metricsByKi = {};
  for (const m of metrics) {
    m.benchmarks = benchmarks.filter((b) => b.metric_id === m.id);
    (metricsByKi[m.key_indicator_id] ||= []).push(m);
  }
  const kisByCriterion = {};
  for (const ki of kis) {
    ki.metrics = metricsByKi[ki.id] || [];
    (kisByCriterion[ki.criterion_id] ||= []).push(ki);
  }
  const tree = criteria.map((c) => ({ ...c, key_indicators: kisByCriterion[c.id] || [] }));
  res.json(tree);
});

// Create a new metric (master-data management — super_admin/iqac only)
router.post('/metrics', requireAuth, requireRole('super_admin', 'iqac'), async (req, res) => {
  const { key_indicator_id, code, title, metric_type, max_score, documents_required, requires_document, instructions, not_to_be_included, sort_order } = req.body;
  if (!key_indicator_id || !code || !title || !metric_type) {
    return res.status(400).json({ error: 'key_indicator_id, code, title, metric_type required' });
  }
  const { rows } = await pool.query(
    `INSERT INTO metrics (key_indicator_id, code, title, metric_type, max_score, documents_required, requires_document, instructions, not_to_be_included, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7,false),$8,$9,COALESCE($10,0)) RETURNING *`,
    [key_indicator_id, code, title, metric_type, max_score || 0, documents_required, requires_document, instructions, not_to_be_included, sort_order]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
