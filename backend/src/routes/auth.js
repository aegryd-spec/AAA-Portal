const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { requireAuth, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role_code, u.school_id, u.campus_id,
            s.name AS school_name, c.name AS campus_name
     FROM users u LEFT JOIN schools s ON s.id = u.school_id
     LEFT JOIN campuses c ON c.id = u.campus_id
     WHERE u.email = $1 AND u.is_active = true`,
    [email]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

  const payload = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role_code,
    school_id: user.school_id,
    campus_id: user.campus_id,
    campus_name: user.campus_name,
    school_name: user.school_name,
  };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: payload });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
