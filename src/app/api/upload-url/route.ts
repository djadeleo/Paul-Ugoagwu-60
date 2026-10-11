import { siteConfig } from '@site';
import { EXT, GB, MB, baseType, isClosed } from '@/lib/config-helpers';
import { CACHE, presignPut } from '@/lib/r2';
import { allow, clientIp, json, usedBytes, validSession } from '@/lib/security';

const L = siteConfig.limits;
const ALLOWED: Record<string, readonly string[]> = {
  video: L.allowedVideoTypes,
  photo: L.allowedPhotoTypes,
  thumb: ['image/jpeg'],
};

export async function POST(req: Request) {
  if (isClosed()) return json({ error: 'closed' }, 403);
  if (!validSession(req)) return json({ error: 'session' }, 401);
  if (!(await allow(`up:${clientIp(req)}`, 15, 3600))) return json({ error: 'rate' }, 429);

  let b: { kind?: string; contentType?: string; size?: number };
  try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }

  const kind = String(b.kind);
  const type = baseType(String(b.contentType ?? ''));
  const size = Number(b.size);
  if (!(kind in ALLOWED) || !ALLOWED[kind].includes(type) || !Number.isFinite(size) || size <= 0)
    return json({ error: 'type' }, 400);

  const max = kind === 'video' ? L.videoMaxMB * MB : kind === 'photo' ? L.photoMaxMB * MB : 300 * 1024;
  if (size > max) return json({ error: 'size' }, 413);

  const used = await usedBytes();
  if (kind === 'video' && used >= L.videoCloseAtGB * GB) return json({ error: 'video_closed' }, 403);
  if (used + size > L.hardCapGB * GB) return json({ error: 'storage_full' }, 403);

  const key = `uploads/${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${EXT[type]}`;
  const uploadUrl = await presignPut(key, type);
  return json({ uploadUrl, key, headers: { 'Content-Type': type, 'Cache-Control': CACHE } });
}
