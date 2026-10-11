import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const bucket = () => process.env.R2_BUCKET!;
export const publicBase = () => process.env.R2_PUBLIC_URL!.replace(/\/$/, '');
export const CACHE = 'public, max-age=31536000, immutable'; // keys are random UUIDs, so immutable is safe

let client: S3Client | null = null;
function r2() {
  return (client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
    // Newer SDKs add checksum headers that R2 presigned PUTs reject; only send them when required.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  }));
}

export const presignPut = (key: string, contentType: string) =>
  getSignedUrl(
    r2(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType, CacheControl: CACHE }),
    { expiresIn: 600 },
  );

export async function objectSize(key: string): Promise<number | null> {
  try {
    const h = await r2().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return h.ContentLength ?? null;
  } catch {
    return null;
  }
}

export const keyFromUrl = (url: string | null) => {
  if (!url) return null;
  const base = publicBase() + '/';
  return url.startsWith(base) ? url.slice(base.length) : null;
};

export async function deleteKeys(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    await r2().send(
      new DeleteObjectsCommand({
        Bucket: bucket(),
        Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }
}

export async function listObjects(prefix: string) {
  const out = await r2().send(new ListObjectsV2Command({ Bucket: bucket(), Prefix: prefix, MaxKeys: 1000 }));
  return (out.Contents ?? []).map((o) => ({ key: o.Key!, modified: o.LastModified?.getTime() ?? Date.now() }));
}
