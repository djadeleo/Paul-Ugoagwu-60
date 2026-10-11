import { siteConfig } from '@site';
import { MB, isClosed } from '@/lib/config-helpers';
import { deleteKeys, objectSize, publicBase } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { allow, clientIp, json, validSession } from '@/lib/security';

const L = siteConfig.limits;
const KEY_RE = {
  photo: /^uploads\/\d{4}\/[0-9a-f-]{36}\.(jpg|png|webp)$/,
  video: /^uploads\/\d{4}\/[0-9a-f-]{36}\.(mp4|mov|webm)$/,
  thumb: /^uploads\/\d{4}\/[0-9a-f-]{36}\.jpg$/,
};
const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  if (isClosed()) return json({ error: 'closed' }, 403);
  if (!validSession(req)) return json({ error: 'session' }, 401);
  if (!(await allow(`wish:${clientIp(req)}`, 5, 3600))) return json({ error: 'rate' }, 429);

  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (b.hp) return json({ error: 'bad' }, 400);

  const name = clean(b.name, 80);
  const location = clean(b.location, 100) || null;
  const message = clean(b.message, L.messageMaxChars);
  if (!name || !message) return json({ error: 'missing' }, 400);

  // The browser sends only storage KEYS; we build the public URLs ourselves and check real sizes in R2.
  const keys: Record<'photo' | 'video' | 'thumb', string | null> = { photo: null, video: null, thumb: null };
  for (const k of ['photo', 'video', 'thumb'] as const) {
    const v = b[`${k}Key`];
    if (v == null || v === '') continue;
    if (typeof v !== 'string' || !KEY_RE[k].test(v)) return json({ error: 'bad_key' }, 400);
    keys[k] = v;
  }

  const limits = { photo: L.photoMaxMB * MB, video: L.videoMaxMB * MB, thumb: 300 * 1024 };
  let total = 0;
  for (const k of ['photo', 'video', 'thumb'] as const) {
    const key = keys[k];
    if (!key) continue;
    const size = await objectSize(key);
    if (size == null) return json({ error: 'upload_missing' }, 400);
    if (size > limits[k]) {
      await deleteKeys(Object.values(keys).filter(Boolean) as string[]);
      return json({ error: 'size' }, 413);
    }
    total += size;
  }

  const url = (k: string | null) => (k ? `${publicBase()}/${k}` : null);
  const { error } = await supabaseAdmin().from('wishes').insert({
    name,
    location,
    message,
    photo_url: url(keys.photo),
    video_url: url(keys.video),
    thumbnail_url: url(keys.thumb),
    file_size_bytes: total,
    status: 'pending',
  });
  if (error) return json({ error: 'db' }, 500);
  return json({ ok: true });
}
