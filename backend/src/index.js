// Long-running server entrypoint (Docker / self-hosted). On Vercel the same
// app is served as a serverless function via /api/index.js instead.
const app = require('./app');
const { ensureBucket } = require('./config/storage');

const PORT = process.env.PORT || 4000;

ensureBucket()
  .catch((err) => console.error('Storage bucket init failed (will retry on first upload):', err.message))
  .finally(() => {
    app.listen(PORT, () => console.log(`AAA backend listening on :${PORT}`));
  });
