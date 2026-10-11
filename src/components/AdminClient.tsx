'use client';
import { useCallback, useEffect, useState } from 'react';
import { siteConfig } from '@site';
import { fmtBytes } from '@/lib/config-helpers';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { Wish, WishStatus } from '@/lib/types';

type Data = { wishes: Wish[]; counts: Record<string, number>; usedBytes: number; videoCloseAtBytes: number; hardCapBytes: number };
const TABS: WishStatus[] = ['pending', 'approved', 'rejected'];

export default function AdminClient() {
  const sb = supabaseBrowser();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authErr, setAuthErr] = useState<string | null>(null);
  const [tab, setTab] = useState<WishStatus>('pending');
  const [data, setData] = useState<Data | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const token = useCallback(async () => (await sb.auth.getSession()).data.session?.access_token ?? null, [sb]);

  const call = useCallback(async (path: string, init?: RequestInit) => {
    const t = await token();
    return fetch(path, { ...init, headers: { ...(init?.headers || {}), authorization: `Bearer ${t}`, 'content-type': 'application/json' } });
  }, [token]);

  const refresh = useCallback(async (status: WishStatus) => {
    const r = await call(`/api/admin/wishes?status=${status}`);
    if (r.status === 403) { setMsg('This account is not an administrator. Add its email to the admins table (see setup guide).'); setData(null); return; }
    if (!r.ok) { setMsg('Could not load wishes.'); return; }
    setData(await r.json());
    setSel(new Set());
    setMsg(null);
  }, [call]);

  useEffect(() => {
    sb.auth.getSession().then(({ data: s }) => setSignedIn(!!s.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSignedIn(!!s));
    return () => sub.subscription.unsubscribe();
  }, [sb]);

  useEffect(() => { if (signedIn) refresh(tab); }, [signedIn, tab, refresh]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setAuthErr(null);
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) setAuthErr('Incorrect email or password.');
  }

  async function act(action: 'approve' | 'reject' | 'delete', ids: string[]) {
    if (!ids.length) return;
    if (action === 'delete' && !confirm(`Permanently delete ${ids.length} wish(es) and their files? This cannot be undone.`)) return;
    setBusy(true);
    const r = await call('/api/admin/wishes', { method: 'POST', body: JSON.stringify({ action, ids }) });
    setBusy(false);
    if (!r.ok) setMsg(r.status === 502 ? 'Could not delete files from storage. Nothing was removed; please try again.' : 'That action failed. Please try again.');
    else await refresh(tab);
  }

  async function exportJson() {
    const r = await call('/api/admin/export');
    if (!r.ok) return setMsg('Export failed.');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await r.blob());
    a.download = 'wishes-backup.json';
    a.click();
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (signedIn === null) return <p className="grid min-h-screen place-items-center">Loading…</p>;

  if (!signedIn)
    return (
      <div className="mx-auto max-w-sm px-4 pt-32">
        <form onSubmit={login} className="card space-y-4 p-6">
          <h1 className="font-display text-3xl">Admin sign in</h1>
          <label className="block"><span className="label">Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></label>
          <label className="block"><span className="label">Password</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
          {authErr && <p role="alert" className="text-sm text-red-300">{authErr}</p>}
          <button className="btn btn-primary w-full">Sign in</button>
        </form>
      </div>
    );

  const pct = data ? Math.min(100, (data.usedBytes / data.hardCapBytes) * 100) : 0;
  const closePct = data ? (data.videoCloseAtBytes / data.hardCapBytes) * 100 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-20 pt-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl">Moderation</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost px-4 py-2 text-sm" onClick={exportJson}>Download backup (JSON)</button>
          <button className="btn btn-ghost px-4 py-2 text-sm" onClick={() => sb.auth.signOut()}>Sign out</button>
        </div>
      </div>

      {data && (
        <section aria-label="Storage usage" className="card mt-6 p-4">
          <div className="flex justify-between text-sm"><span>Storage used (R2)</span><span>{fmtBytes(data.usedBytes)} of {fmtBytes(data.hardCapBytes)} cap</span></div>
          <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-midnight-soft" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className={`h-full ${data.usedBytes >= data.videoCloseAtBytes ? 'bg-red-400' : 'bg-platinum'}`} style={{ width: `${pct}%` }} />
            <div className="absolute inset-y-0 w-0.5 bg-yellow-300" style={{ left: `${closePct}%` }} title="Video uploads close here" />
          </div>
          <p className="mt-2 text-xs text-platinum-dim">
            Yellow line = video uploads close at {siteConfig.limits.videoCloseAtGB} GB (written wishes still accepted).
            {data.usedBytes >= data.videoCloseAtBytes && ' Video uploads are currently CLOSED.'}
          </p>
        </section>
      )}

      <div role="tablist" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`btn px-5 py-2 text-sm capitalize ${tab === t ? 'btn-primary' : 'btn-ghost'}`}>
            {t} ({data?.counts[t] ?? '…'})
          </button>
        ))}
      </div>

      {msg && <p role="alert" className="mt-4 rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{msg}</p>}

      {data && data.wishes.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <label className="mr-2 inline-flex items-center gap-2">
            <input type="checkbox" checked={sel.size === data.wishes.length} onChange={(e) => setSel(e.target.checked ? new Set(data.wishes.map((w) => w.id)) : new Set())} />
            Select all ({sel.size})
          </label>
          <button disabled={!sel.size || busy} className="btn btn-primary px-4 py-2 text-sm disabled:opacity-50" onClick={() => act('approve', [...sel])}>Approve selected</button>
          <button disabled={!sel.size || busy} className="btn btn-ghost px-4 py-2 text-sm disabled:opacity-50" onClick={() => act('reject', [...sel])}>Reject selected</button>
          <button disabled={!sel.size || busy} className="btn btn-ghost border-red-400/60 px-4 py-2 text-sm text-red-300 disabled:opacity-50" onClick={() => act('delete', [...sel])}>Delete selected</button>
        </div>
      )}

      <ul className="mt-4 space-y-4">
        {data?.wishes.map((w) => (
          <li key={w.id} className="card flex flex-col gap-4 p-4 sm:flex-row">
            <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={sel.has(w.id)} onChange={() => toggle(w.id)} aria-label={`Select wish from ${w.name}`} />
            <div className="w-full shrink-0 sm:w-64">
              {w.video_url ? (
                <video src={w.video_url} poster={w.thumbnail_url ?? undefined} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-black" />
              ) : w.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={w.photo_url} alt={`Photo from ${w.name}`} loading="lazy" className="w-full rounded-lg" />
              ) : <div className="grid aspect-video place-items-center rounded-lg bg-midnight-soft text-sm text-platinum-dim">Text only</div>}
            </div>
            <div className="min-w-0 flex-1">
              <p className="whitespace-pre-line break-words">{w.message}</p>
              <p className="mt-2 text-sm"><b>{w.name}</b>{w.location && <span className="text-platinum-dim"> · {w.location}</span>}</p>
              <p className="text-xs text-platinum-dim">{new Date(w.created_at).toLocaleString()} · {fmtBytes(w.file_size_bytes)}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {w.status !== 'approved' && <button disabled={busy} className="btn btn-primary px-4 py-2 text-sm" onClick={() => act('approve', [w.id])}>Approve</button>}
                {w.status !== 'rejected' && <button disabled={busy} className="btn btn-ghost px-4 py-2 text-sm" onClick={() => act('reject', [w.id])}>Reject</button>}
                <button disabled={busy} className="btn btn-ghost border-red-400/60 px-4 py-2 text-sm text-red-300" onClick={() => act('delete', [w.id])}>Delete</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {data && !data.wishes.length && <p className="mt-8 text-center text-platinum-dim">Nothing in {tab}.</p>}
    </div>
  );
}
