const Minio = require('minio');

// MinIO gives S3-compatible object storage that runs entirely inside
// your own docker-compose stack — no external cloud dependency, and it
// scales the same way S3-based apps do if you later move to a bigger
// deployment (or point this client at real S3 by changing env vars only).
const minioClient = new Minio.Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: process.env.MINIO_PORT ? parseInt(process.env.MINIO_PORT, 10) : undefined,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY || 'aaa_minio_admin',
  secretKey: process.env.MINIO_SECRET_KEY || 'aaa_minio_password',
});

const BUCKET = process.env.MINIO_BUCKET || 'aaa-evidence';

async function ensureBucket() {
  const exists = await minioClient.bucketExists(BUCKET).catch(() => false);
  if (!exists) {
    await minioClient.makeBucket(BUCKET);
    console.log(`Created MinIO bucket "${BUCKET}"`);
  }
}

module.exports = { minioClient, BUCKET, ensureBucket };
