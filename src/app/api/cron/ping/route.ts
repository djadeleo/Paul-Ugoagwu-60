import { deleteKeys, keyFromUrl, listObjects } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { json } from '@/lib/security';

export const dynamic = 'force-dynamic';

/** Daily Vercel Cron: (1) keeps the free Supabase project awake, (2) prunes old rate-limit rows,
    (3) deletes R2 files that were uploaded but never attached to a wish (older than 24 h). */
export async function GET(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return json({ error: 'forbidden' }, 401);
  const sb = supabaseAdmin();

  const { count, error } = await sb.from('wishes').select('id', { count: 'exact', head: true });
  if (error) return json({ ok: false, error: error.message }, 500);

  await sb.from('rate_limits').delete().lt('window_start', new Date(Date.now() - 24 * 3600e3).toISOString());

  let orphansDeleted = 0;
  try {
    const old = (await listObjects('uploads/')).filter((o) => Date.now() - o.modified > 24 * 3600e3);
    if (old.length) {
      const { data } = await sb.from('wishes').select('photo_url,video_url,thumbnail_url');
      const used = new Set(
        (data ?? []).flatMap((r) => [r.photo_url, r.video_url, r.thumbnail_url]).map((u) => keyFromUrl(u as string | null)),
      );
      const orphans = old.filter((o) => !used.has(o.key)).map((o) => o.key);
      await deleteKeys(orphans);
      orphansDeleted = orphans.length;
    }
  } catch {
    /* R2 hiccup: not fatal for the keep-alive */
  }
  return json({ ok: true, wishes: count, orphansDeleted });
}
