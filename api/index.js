// Vercel serverless entrypoint. All /api/* requests are rewritten here
// (see vercel.json) and handled by the same Express app the Docker backend
// runs. Storage bucket creation is skipped in Blob mode, so no init needed.
const app = require('../backend/src/app');

module.exports = app;
