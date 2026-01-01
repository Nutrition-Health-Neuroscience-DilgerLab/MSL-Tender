import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a processed image to R2 storage
 * @param buffer Image buffer
 * @param studyNumber Study number for folder organization
 * @param filename Original filename
 * @returns Public URL and storage key
 */
export async function uploadProcessedImage(
  buffer: Buffer,
  studyNumber: string | number,
  filename: string
): Promise<UploadResult> {
  const key = `processed/${studyNumber}/${filename}`;
  
  console.log(`[R2] Uploading to key: ${key}, size: ${buffer.length} bytes`);
  
  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await r2Client.send(command);
  console.log(`[R2] Upload successful: ${key}`);

  const url = `${R2_PUBLIC_URL}/${key}`;
  
  return { url, key };
}
