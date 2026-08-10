require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const pool = require('./config/db');
const { ensureBucket } = require('./config/storage');

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
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;

ensureBucket()
  .catch((err) => console.error('MinIO bucket init failed (will retry on first upload):', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`AAA backend listening on :${PORT}`));
  });
