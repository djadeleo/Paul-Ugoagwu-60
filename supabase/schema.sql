-- =====================================================================
-- Paul Ugoagwu @ 60 - Supabase schema + Row Level Security
-- Run this whole file once in: Supabase Dashboard > SQL Editor > New query
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- wishes ----------
create table if not exists public.wishes (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  location         text check (location is null or char_length(location) <= 100),
  message          text not null check (char_length(message) between 1 and 1000),
  photo_url        text,
  video_url        text,
  thumbnail_url    text,
  file_size_bytes  bigint not null default 0 check (file_size_bytes >= 0),
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at       timestamptz not null default now()
);
create index if not exists wishes_status_created_idx on public.wishes (status, created_at desc);

-- ---------- admins (who may moderate) ----------
create table if not exists public.admins (email text primary key check (email = lower(email)));
alter table public.admins enable row level security;   -- no policies = nobody but the service role can touch it

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;

-- ---------- Row Level Security on wishes ----------
alter table public.wishes enable row level security;

drop policy if exists "public can read approved wishes" on public.wishes;
create policy "public can read approved wishes" on public.wishes
  for select using (status = 'approved');

drop policy if exists "admin can read all wishes" on public.wishes;
create policy "admin can read all wishes" on public.wishes
  for select to authenticated using (public.is_admin());

drop policy if exists "admin can update wishes" on public.wishes;
create policy "admin can update wishes" on public.wishes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin can delete wishes" on public.wishes;
create policy "admin can delete wishes" on public.wishes
  for delete to authenticated using (public.is_admin());

-- INSERT: deliberately NO policy for the public (anon) key.
-- Visitors submit through /api/wishes, which checks Cloudflare Turnstile, a signed session,
-- rate limits and the real file sizes in R2 before inserting as 'pending' with the service-role key.
-- (An open anon INSERT policy would let bots skip all of those checks by calling Supabase directly.)

-- ---------- rate limiting (used by the API routes) ----------
create table if not exists public.rate_limits (
  key          text primary key,
  count        int not null,
  window_start timestamptz not null
);
alter table public.rate_limits enable row level security;

create or replace function public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
returns boolean language plpgsql security definer set search_path = public as $$
declare r public.rate_limits;
begin
  insert into public.rate_limits as t (key, count, window_start) values (p_key, 1, now())
  on conflict (key) do update set
    count = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.count + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning * into r;
  return r.count <= p_max;
end $$;

-- ---------- storage accounting ----------
create or replace function public.total_storage_bytes()
returns bigint language sql stable security definer set search_path = public as $$
  select coalesce(sum(file_size_bytes), 0)::bigint from public.wishes;
$$;

-- Only the server (service role) may call these helpers.
revoke all on function public.check_rate_limit(text, int, int) from public, anon, authenticated;
revoke all on function public.total_storage_bytes()            from public, anon, authenticated;

-- ---------- after you create your admin user in Authentication > Users, run: ----------
-- insert into public.admins (email) values ('your-email@example.com');   -- must be lowercase
