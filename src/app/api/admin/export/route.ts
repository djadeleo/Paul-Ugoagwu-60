import { supabaseAdmin } from '@/lib/supabase-admin';
import { json, requireAdmin } from '@/lib/security';

/** Full JSON export of every wish (all statuses) incl. media URLs - handy for backups. */
export async function GET(req: Request) {
  if (!(await requireAdmin(req))) return json({ error: 'forbidden' }, 403);
  const { data, error } = await supabaseAdmin().from('wishes').select('*').order('created_at', { ascending: true });
  if (error) return json({ error: 'db' }, 500);
  return new Response(JSON.stringify(data, null, 2), {
    headers: { 'content-type': 'application/json', 'content-disposition': 'attachment; filename="wishes-backup.json"' },
  });
}
