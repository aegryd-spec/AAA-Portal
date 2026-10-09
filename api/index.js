// Vercel serverless entry — wraps the Express app without calling listen()
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('../backend/src/routes/auth');
const criteriaRoutes = require('../backend/src/routes/criteria');
const submissionRoutes = require('../backend/src/routes/submissions');
const evidenceRoutes = require('../backend/src/routes/evidence');
const adminRoutes = require('../backend/src/routes/admin');
const dashboardRoutes = require('../backend/src/routes/dashboard');
const campusRoutes = require('../backend/src/routes/campuses');
const taskRoutes = require('../backend/src/routes/tasks');
const notificationRoutes = require('../backend/src/routes/notifications');
const pool = require('../backend/src/config/db');

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/criteria', criteriaRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/evidence', evidenceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/campuses', campusRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
