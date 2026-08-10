const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/schools', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM schools ORDER BY name');
  res.json(rows);
});

router.post('/schools', requireAuth, requireRole('super_admin'), async (req, res) => {
  const { code, name, type } = req.body;
  const { rows } = await pool.query(
    'INSERT INTO schools (code, name, type) VALUES ($1,$2,$3) RETURNING *',
    [code, name, type || 'School']
  );
  res.status(201).json(rows[0]);
});

router.get('/audit-cycles', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM audit_cycles ORDER BY start_date DESC');
  res.json(rows);
});

router.post('/audit-cycles', requireAuth, requireRole('super_admin', 'iqac'), async (req, res) => {
  const { name, academic_year, start_date, end_date } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO audit_cycles (name, academic_year, start_date, end_date) VALUES ($1,$2,$3,$4) RETURNING *`,
    [name, academic_year, start_date, end_date]
  );
  res.status(201).json(rows[0]);
});

router.get('/roles', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM roles ORDER BY code');
  res.json(rows);
});

router.get('/users', requireAuth, requireRole('super_admin', 'iqac'), async (req, res) => {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role_code, u.is_active, s.name AS school_name
     FROM users u LEFT JOIN schools s ON s.id = u.school_id ORDER BY u.name`
  );
  res.json(rows);
});

router.post('/users', requireAuth, requireRole('super_admin'), async (req, res) => {
  const { name, email, password, role_code, school_id } = req.body;
  if (!name || !email || !password || !role_code) {
    return res.status(400).json({ error: 'name, email, password, role_code required' });
  }
  const hash = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role_code, school_id)
     VALUES ($1,$2,$3,$4,$5) RETURNING id, name, email, role_code, school_id`,
    [name, email, hash, role_code, school_id || null]
  );
  res.status(201).json(rows[0]);
});

module.exports = router;
