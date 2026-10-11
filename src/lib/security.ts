import 'server-only';
import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin';

export const json = (body: unknown, status = 200, headers?: Record<string, string>) =>
  Response.json(body, { status, headers });

export function clientIp(req: Request) {
  const f = req.headers.get('x-forwarded-for');
  return (f?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim();
}

export async function verifyTurnstile(token: string, ip: string) {
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response: token, remoteip: ip }),
    });
    const j = (await r.json()) as { success?: boolean };
    return !!j.success;
  } catch {
    return false;
  }
}

/* A Turnstile token can be verified only once, so we verify it once at /api/session and hand back
   a short-lived HMAC-signed session that the upload-url and wishes routes then require. */
const sign = (p: string) => crypto.createHmac('sha256', process.env.SESSION_SECRET!).update(p).digest('base64url');

export function issueSession(ttlSeconds = 15 * 60) {
  const p = `${Math.floor(Date.now() / 1000) + ttlSeconds}.${crypto.randomBytes(8).toString('hex')}`;
  return `${p}.${sign(p)}`;
}

export function validSession(req: Request) {
  const [exp, nonce, sig] = (req.headers.get('x-session') || '').split('.');
  if (!exp || !nonce || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(sign(`${exp}.${nonce}`));
  return a.length === b.length && crypto.timingSafeEqual(a, b) && Number(exp) > Date.now() / 1000;
}

/** Atomic per-key rate limit stored in Postgres (works across serverless instances). Fails closed. */
export async function allow(key: string, max: number, windowSeconds: number) {
  const { data, error } = await supabaseAdmin().rpc('check_rate_limit', {
    p_key: key,
    p_max: max,
    p_window_seconds: windowSeconds,
  });
  return !error && data === true;
}

export async function usedBytes() {
  const { data } = await supabaseAdmin().rpc('total_storage_bytes');
  return Number(data ?? 0);
}

export async function requireAdmin(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return false;
  const sb = supabaseAdmin();
  const { data, error } = await sb.auth.getUser(token);
  const email = data.user?.email?.toLowerCase();
  if (error || !email) return false;
  const { data: row } = await sb.from('admins').select('email').eq('email', email).maybeSingle();
  return !!row;
}
