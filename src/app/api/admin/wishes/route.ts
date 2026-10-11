import { siteConfig } from '@site';
import { GB } from '@/lib/config-helpers';
import { deleteKeys, keyFromUrl } from '@/lib/r2';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { json, requireAdmin, usedBytes } from '@/lib/security';

const STATUSES = ['pending', 'approved', 'rejected'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return json({ error: 'forbidden' }, 403);
  const status = new URL(req.url).searchParams.get('status') || 'pending';
  const sb = supabaseAdmin();

  let q = sb.from('wishes').select('*').order('created_at', { ascending: false }).limit(300);
  if (STATUSES.includes(status)) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) return json({ error: 'db' }, 500);

  const counts: Record<string, number> = {};
  for (const s of STATUSES) {
    const { count } = await sb.from('wishes').select('id', { count: 'exact', head: true }).eq('status', s);
    counts[s] = count ?? 0;
  }
  return json({
    wishes: data ?? [],
    counts,
    usedBytes: await usedBytes(),
    videoCloseAtBytes: siteConfig.limits.videoCloseAtGB * GB,
    hardCapBytes: siteConfig.limits.hardCapGB * GB,
  });
}

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return json({ error: 'forbidden' }, 403);
  let b: { action?: string; ids?: string[] };
  try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  const ids = Array.isArray(b.ids) ? b.ids.filter((i) => typeof i === 'string' && UUID.test(i)).slice(0, 100) : [];
  if (!ids.length) return json({ error: 'no_ids' }, 400);
  const sb = supabaseAdmin();

  if (b.action === 'approve' || b.action === 'reject') {
    const { error } = await sb.from('wishes').update({ status: b.action === 'approve' ? 'approved' : 'rejected' }).in('id', ids);
    return error ? json({ error: 'db' }, 500) : json({ ok: true });
  }

  if (b.action === 'delete') {
    const { data, error } = await sb.from('wishes').select('photo_url,video_url,thumbnail_url').in('id', ids);
    if (error) return json({ error: 'db' }, 500);
    const keys = (data ?? [])
      .flatMap((r) => [r.photo_url, r.video_url, r.thumbnail_url])
      .map((u) => keyFromUrl(u as string | null))
      .filter((k): k is string => !!k);
    try {
      await deleteKeys(keys); // files first: if this fails the rows stay, so nothing is orphaned
    } catch {
      return json({ error: 'r2_delete_failed' }, 502);
    }
    const { error: delErr } = await sb.from('wishes').delete().in('id', ids);
    return delErr ? json({ error: 'db' }, 500) : json({ ok: true, filesDeleted: keys.length });
  }
  return json({ error: 'bad_action' }, 400);
}
