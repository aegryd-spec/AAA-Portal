const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/auth');
const { minioClient, BUCKET } = require('../config/storage');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB/file

router.post('/:submissionId', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file required (multipart field "file")' });

  const { rows: subRows } = await pool.query('SELECT * FROM submissions WHERE id = $1', [req.params.submissionId]);
  const submission = subRows[0];
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (!['super_admin', 'iqac'].includes(req.user.role) && submission.school_id !== req.user.school_id) {
    return res.status(403).json({ error: 'Cannot attach evidence to another school\'s submission' });
  }

  const storageKey = `${submission.school_id}/${submission.id}/${crypto.randomUUID()}-${req.file.originalname}`;
  await minioClient.putObject(BUCKET, storageKey, req.file.buffer, req.file.size, {
    'Content-Type': req.file.mimetype,
  });

  const { rows } = await pool.query(
    `INSERT INTO evidence_documents (submission_id, file_name, storage_key, content_type, size_bytes, uploaded_by)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [submission.id, req.file.originalname, storageKey, req.file.mimetype, req.file.size, req.user.sub]
  );
  res.status(201).json(rows[0]);
});

router.get('/:submissionId', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT * FROM evidence_documents WHERE submission_id = $1 ORDER BY uploaded_at',
    [req.params.submissionId]
  );
  res.json(rows);
});

// Time-limited pre-signed download URL — files are never served through the API directly
router.get('/download/:evidenceId', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM evidence_documents WHERE id = $1', [req.params.evidenceId]);
  const doc = rows[0];
  if (!doc) return res.status(404).json({ error: 'Evidence not found' });
  const url = await minioClient.presignedGetObject(BUCKET, doc.storage_key, 15 * 60); // 15 min
  res.json({ url, file_name: doc.file_name });
});

module.exports = router;
