'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import confetti from 'canvas-confetti';
import { motion } from 'framer-motion';
import { siteConfig } from '@site';
import { MB, fmtBytes, isClosed } from '@/lib/config-helpers';
import { compressVideo, normalizeVideoType, putFile, readVideoMeta, resizeToJpeg, videoThumb } from '@/lib/media';
import Turnstile from './Turnstile';
import VideoRecorder from './VideoRecorder';

const L = siteConfig.limits;

class ApiError extends Error { constructor(public code: string, public status: number) { super(code); } }

const MESSAGES: Record<string, string> = {
  closed: 'Wishes are now closed.',
  session: 'Your security check expired. Please try again.',
  turnstile: 'The security check failed. Please wait a moment and try again.',
  rate: 'Too many attempts from your connection. Please try again in an hour.',
  video_closed: 'Video uploads are closed, but you can still send your written wish (and a photo). Please remove the video and submit again.',
  storage_full: 'Our storage is full, so we can only accept written wishes now. Please remove any photo/video and submit again.',
  type: 'That file type is not supported.',
  size: 'That file is too large.',
  upload_missing: 'An upload did not finish. Please try again.',
};

async function api<T = Record<string, string>>(path: string, body: unknown, session?: string): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(session ? { 'x-session': session } : {}) },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new ApiError(j.error || 'error', r.status);
  return j as T;
}

function useObjectUrl(blob: Blob | null) {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

export default function WishForm() {
  const [closed, setClosed] = useState(isClosed());
  const [videosOpen, setVideosOpen] = useState(true);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [message, setMessage] = useState('');
  const [hp, setHp] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; pct: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const token = useRef<string | null>(null);
  const session = useRef<{ value: string; exp: number } | null>(null);
  const photoUrl = useObjectUrl(photo);
  const videoUrl = useObjectUrl(video);

  useEffect(() => {
    fetch('/api/status').then((r) => r.json()).then((s) => { setClosed((c) => c || !!s.closed); setVideosOpen(!!s.videosOpen); }).catch(() => {});
  }, []);

  function pickPhoto(f: File | undefined) {
    if (!f) return;
    if (!f.type.startsWith('image/')) return setError('Please choose an image file (JPG, PNG or WebP).');
    setError(null);
    setPhoto(f);
  }

  function pickVideo(f: File | undefined) {
    if (!f) return;
    if (!normalizeVideoType(f)) return setError('Please choose an MP4, MOV or WebM video.');
    if (f.size > 1024 * MB) return setError('That video is very large. Please pick a shorter clip (max 45 seconds).');
    setError(null);
    setVideo(f);
  }

  async function getSession() {
    if (session.current && Date.now() < session.current.exp) return session.current.value;
    if (!token.current) throw new Error('Please wait for the security check to finish (a few seconds), then try again.');
    const { session: s } = await api('/api/session', { turnstileToken: token.current, hp });
    session.current = { value: s, exp: Date.now() + 14 * 60 * 1000 };
    token.current = null;
    window.turnstile?.reset();
    return s;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (hp) return; // honeypot
    setError(null);
    const n = name.trim(), m = message.trim();
    if (!n) return setError('Please tell us your name.');
    if (!m) return setError('Please write a short message.');
    if (m.length > L.messageMaxChars) return setError(`Please keep your message under ${L.messageMaxChars} characters.`);

    setBusy(true);
    try {
      const s = await getSession();
      const uploads: { kind: 'photo' | 'video' | 'thumb'; blob: Blob; type: string }[] = [];
      let thumb: Blob | null = null;

      if (photo) {
        setProgress({ label: 'Preparing photo…', pct: 0 });
        const pb = await resizeToJpeg(photo, L.photoMaxWidth, 0.82);
        if (pb.size > L.photoMaxMB * MB) throw new Error(`That photo is still larger than ${L.photoMaxMB} MB. Please choose a smaller one.`);
        uploads.push({ kind: 'photo', blob: pb, type: 'image/jpeg' });
        thumb = await resizeToJpeg(pb, L.thumbWidth, 0.7);
      }

      if (video) {
        setProgress({ label: 'Checking video…', pct: 0 });
        const origType = normalizeVideoType(video)!;
        const meta = await readVideoMeta(video);
        if (meta.duration > L.videoMaxSeconds + 1) throw new Error(`Videos can be up to ${L.videoMaxSeconds} seconds. Yours is ${Math.round(meta.duration)} seconds.`);
        let vb: Blob = video;
        if (Math.max(meta.width, meta.height) > 1280 || video.size > 25 * MB) {
          setProgress({ label: 'Optimizing video (keep this tab open)…', pct: 0 });
          vb = await compressVideo(video, (pct) => setProgress({ label: 'Optimizing video (keep this tab open)…', pct }));
        }
        if (vb.size > L.videoMaxMB * MB)
          throw new Error(`This video is ${fmtBytes(vb.size)}, above the ${L.videoMaxMB} MB limit. Please record or choose a shorter clip.`);
        const vThumb = await videoThumb(vb === video ? video : vb, L.thumbWidth);
        if (vThumb) thumb = vThumb;
        uploads.push({ kind: 'video', blob: vb, type: vb === video ? origType : (normalizeVideoType(vb) as string) });
      }
      if (thumb) uploads.push({ kind: 'thumb', blob: thumb, type: 'image/jpeg' });

      const total = uploads.reduce((a, u) => a + u.blob.size, 0) || 1;
      let sent = 0;
      const keys: Partial<Record<'photo' | 'video' | 'thumb', string>> = {};
      for (const u of uploads) {
        const r = await api<{ uploadUrl: string; key: string; headers: Record<string, string> }>(
          '/api/upload-url', { kind: u.kind, contentType: u.type, size: u.blob.size }, s);
        await putFile(r.uploadUrl, u.blob, r.headers, (loaded) =>
          setProgress({ label: 'Uploading…', pct: Math.round(((sent + loaded) / total) * 100) }));
        sent += u.blob.size;
        keys[u.kind] = r.key;
      }

      setProgress({ label: 'Sending your wish…', pct: 100 });
      await api('/api/wishes', { name: n, location: location.trim(), message: m, photoKey: keys.photo, videoKey: keys.video, thumbKey: keys.thumb, hp }, s);

      setDone(true);
      const end = Date.now() + 1800;
      (function frame() {
        confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0 }, colors: ['#E5E4E2', '#C0C0C0', '#6D8BFF'] });
        confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1 }, colors: ['#E5E4E2', '#C0C0C0', '#6D8BFF'] });
        if (Date.now() < end) requestAnimationFrame(frame);
      })();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'session' || err.code === 'turnstile') { session.current = null; window.turnstile?.reset(); }
        setError(MESSAGES[err.code] || 'Something went wrong. Please try again.');
        if (err.code === 'closed') setClosed(true);
      } else setError((err as Error).message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  if (closed)
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <h2 className="font-display text-3xl">Wishes are now closed</h2>
        <p className="mt-3 text-platinum-dim">Thank you to everyone who sent their love. You can still enjoy every wish in the gallery.</p>
        <Link href="/gallery" className="btn btn-primary mt-6">Visit the gallery</Link>
      </div>
    );

  if (done)
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="card mx-auto max-w-xl p-8 text-center" role="status">
        <h2 className="font-display text-4xl">Thank you, {name.trim().split(' ')[0]}! 🎉</h2>
        <p className="mt-4 text-platinum-dim">Your wish was received. It will appear on the site once it has been reviewed.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/" className="btn btn-primary">Back home</Link>
          <Link href="/gallery" className="btn btn-ghost">See the gallery</Link>
        </div>
      </motion.div>
    );

  return (
    <form onSubmit={submit} className="card mx-auto max-w-2xl space-y-6 p-6 sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="label">Your name *</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" required />
        </label>
        <label className="block">
          <span className="label">Country / city (optional)</span>
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={100} autoComplete="address-level2" />
        </label>
      </div>

      <label className="block">
        <span className="label">Your wish or prayer *</span>
        <textarea className="input min-h-36" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={L.messageMaxChars} required />
        <span className="mt-1 block text-right text-xs text-platinum-dim">{message.length}/{L.messageMaxChars}</span>
      </label>

      {/* Photo */}
      <fieldset className="space-y-3">
        <legend className="label">Add a photo (optional)</legend>
        {photoUrl ? (
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Preview of your chosen photo" className="h-24 w-24 rounded-lg object-cover" />
            <button type="button" className="btn btn-ghost" onClick={() => setPhoto(null)}>Remove photo</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-ghost cursor-pointer">Choose photo
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <label className="btn btn-ghost cursor-pointer">Take a photo
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        )}
        <p className="text-xs text-platinum-dim">Photos are resized automatically. Max {L.photoMaxMB} MB.</p>
      </fieldset>

      {/* Video */}
      <fieldset className="space-y-3">
        <legend className="label">Add a video message (optional)</legend>
        {!videosOpen ? (
          <p className="rounded-lg bg-midnight-soft p-3 text-sm text-platinum-dim">Video uploads are now closed, but you can still send a written wish and photo.</p>
        ) : recording ? (
          <VideoRecorder maxSeconds={L.videoMaxSeconds} onCancel={() => setRecording(false)} onRecorded={(b) => { setRecording(false); setVideo(b); }} />
        ) : videoUrl ? (
          <div className="space-y-3">
            <video src={videoUrl} controls playsInline preload="metadata" className="aspect-video w-full rounded-lg bg-black" aria-label="Preview of your video message" />
            <button type="button" className="btn btn-ghost" onClick={() => setVideo(null)}>Remove video</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-ghost cursor-pointer">Upload a video
              <input type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="sr-only" onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
            <button type="button" className="btn btn-ghost" onClick={() => setRecording(true)}>Record in browser</button>
            <label className="btn btn-ghost cursor-pointer">Open phone camera
              <input type="file" accept="video/*" capture="user" className="sr-only" onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ''; }} />
            </label>
          </div>
        )}
        <p className="text-xs text-platinum-dim">MP4, MOV or WebM · up to {L.videoMaxSeconds} seconds · up to {L.videoMaxMB} MB. Larger videos are shrunk to 720p where your browser allows.</p>
      </fieldset>

      {/* Honeypot: real people never see or fill this */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>Website<input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></label>
      </div>

      <Turnstile onToken={(t) => { token.current = t; }} />

      {progress && (
        <div role="progressbar" aria-valuenow={progress.pct} aria-valuemin={0} aria-valuemax={100} aria-label={progress.label}>
          <div className="mb-1 flex justify-between text-sm"><span>{progress.label}</span><span>{progress.pct}%</span></div>
          <div className="h-2 overflow-hidden rounded-full bg-midnight-soft">
            <div className="h-full rounded-full bg-platinum transition-all" style={{ width: `${progress.pct}%` }} />
          </div>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-950/60 p-3 text-sm text-red-200">{error}</p>}

      <button type="submit" className="btn btn-primary w-full disabled:opacity-60" disabled={busy || recording}>
        {busy ? 'Please wait…' : 'Send my wish'}
      </button>
      <p className="text-center text-xs text-platinum-dim">Wishes are reviewed before they appear on the site.</p>
    </form>
  );
}
