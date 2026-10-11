import { isClosed } from '@/lib/config-helpers';
import { allow, clientIp, issueSession, json, verifyTurnstile } from '@/lib/security';

export async function POST(req: Request) {
  if (isClosed()) return json({ error: 'closed' }, 403);
  const ip = clientIp(req);
  let b: { turnstileToken?: string; hp?: string };
  try { b = await req.json(); } catch { return json({ error: 'bad' }, 400); }
  if (b.hp) return json({ error: 'bad' }, 400); // honeypot filled = bot
  if (!(await allow(`sess:${ip}`, 20, 3600))) return json({ error: 'rate' }, 429);
  if (!b.turnstileToken || !(await verifyTurnstile(b.turnstileToken, ip))) return json({ error: 'turnstile' }, 400);
  return json({ session: issueSession() });
}
