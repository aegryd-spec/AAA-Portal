require('dotenv').config();
// Forward rejections from async route handlers to the error middleware.
// Without this, Express 4 leaves a failed async handler hanging with no
// response (e.g. a DB outage would freeze the request instead of 500-ing).
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const pool = require('./config/db');

const authRoutes = require('./routes/auth');
const criteriaRoutes = require('./routes/criteria');
const submissionRoutes = require('./routes/submissions');
const evidenceRoutes = require('./routes/evidence');
const adminRoutes = require('./routes/admin');
const dashboardRoutes = require('./routes/dashboard');
const taskRoutes = require('./routes/tasks');
const notificationRoutes = require('./routes/notifications');

const app = express();
app.use(helmet());
app.use(cors());
app.use(morgan('tiny'));
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
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  // Surface DB-connectivity failures as a clear 503 instead of a generic 500,
  // so the UI can tell the user the service/database isn't reachable.
  const dbDown = ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN'].includes(err.code)
    || /timeout|terminating connection|connection.*(closed|reset)/i.test(err.message || '');
  if (dbDown) {
    return res.status(503).json({ error: 'Database unavailable — the server could not reach its database.' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
