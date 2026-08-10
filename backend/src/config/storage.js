// Provider-abstracted evidence storage. Two backends, selected by env:
//   1. Vercel Blob  -> set BLOB_READ_WRITE_TOKEN (auto-injected on Vercel once
//                      you add a Blob store). Public, unguessable object URLs.
//   2. MinIO        -> the docker-compose stack (default). S3-compatible,
//                      self-hosted, time-limited pre-signed download URLs.
//
// The rest of the app only calls putEvidence / getDownloadUrl / ensureBucket,
// so switching providers needs no route changes.

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const USE_BLOB = !!BLOB_TOKEN;

const BUCKET = process.env.MINIO_BUCKET || 'aaa-evidence';

// Vercel serverless functions cap the request body at ~4.5 MB, so in Blob mode
// evidence is limited to 4 MB. Self-hosted MinIO keeps the original 25 MB.
const MAX_UPLOAD_BYTES = USE_BLOB ? 4 * 1024 * 1024 : 25 * 1024 * 1024;

let minioClient = null;
if (!USE_BLOB) {
  const Minio = require('minio');
  minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'minio',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || 'aaa_minio_admin',
    secretKey: process.env.MINIO_SECRET_KEY || 'aaa_minio_password',
  });
}

async function ensureBucket() {
  if (USE_BLOB) return; // Blob has no bucket to create
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`Created MinIO bucket "${BUCKET}"`);
  }
}

// Store an object. Returns { storageKey }: a public Blob URL (Blob mode) or the
// object key (MinIO mode). That value is what gets persisted in evidence_documents.
async function putEvidence(key, buffer, size, contentType) {
  if (USE_BLOB) {
    const { put } = require('@vercel/blob');
    const blob = await put(key, buffer, {
      access: 'public',
      contentType,
      token: BLOB_TOKEN,
      addRandomSuffix: false,
    });
    return { storageKey: blob.url };
  }
  await minioClient.putObject(BUCKET, key, buffer, size, {
    'Content-Type': contentType,
  });
  return { storageKey: key };
}

// Turn a stored value back into a downloadable URL.
async function getDownloadUrl(storageKey) {
  if (/^https?:\/\//i.test(storageKey)) return storageKey; // Blob public URL
  return minioClient.presignedGetObject(BUCKET, storageKey, 15 * 60); // 15 min
}

module.exports = { ensureBucket, putEvidence, getDownloadUrl, USE_BLOB, MAX_UPLOAD_BYTES };
