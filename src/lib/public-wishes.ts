import { createClient } from '@supabase/supabase-js';
import type { Wish } from './types';

/** Server-side read of approved wishes for the home page (anon key; RLS enforces "approved only"). */
export async function fetchApproved(limit: number): Promise<Wish[]> {
  try {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false },
    });
    const { data } = await sb
      .from('wishes')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
      .limit(limit);
    return (data as Wish[]) ?? [];
  } catch {
    return [];
  }
}
