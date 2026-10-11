import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
/** Browser client (anon key). RLS only lets it read approved wishes; admin login uses it too. */
export function supabaseBrowser() {
  return (client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
}
