const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.sub]
  );
  const { rows: countRows } = await pool.query(
    'SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = false',
    [req.user.sub]
  );
  res.json({ notifications: rows, unread: countRows[0].unread });
});

router.post('/:id/read', requireAuth, async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.sub]);
  res.json({ ok: true });
});

router.post('/read-all', requireAuth, async (req, res) => {
  await pool.query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.sub]);
  res.json({ ok: true });
});

module.exports = router;
