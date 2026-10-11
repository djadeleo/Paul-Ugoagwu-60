import { baseType } from './config-helpers';

export type VideoMeta = { duration: number; width: number; height: number };

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('toBlob'))), 'image/jpeg', q));

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

/* ---------- images ---------- */
async function loadBitmap(file: Blob): Promise<{ src: CanvasImageSource; w: number; h: number }> {
  if ('createImageBitmap' in window) {
    try {
      const b = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { src: b, w: b.width, h: b.height };
    } catch { /* fall through to <img> */ }
  }
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); res({ src: img, w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('We could not read that image. Please try a JPG or PNG.')); };
    img.src = url;
  });
}

/** Resize to at most maxW pixels wide and re-encode as JPEG. */
export async function resizeToJpeg(file: Blob, maxW: number, quality: number) {
  const { src, w, h } = await loadBitmap(file);
  const scale = Math.min(1, maxW / w);
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.drawImage(src, 0, 0, c.width, c.height);
  return toBlob(c, quality);
}

/* ---------- video ---------- */
export function normalizeVideoType(f: Blob): string | null {
  const t = baseType(f.type || '');
  if (['video/mp4', 'video/quicktime', 'video/webm'].includes(t)) return t;
  const ext = (f as File).name?.split('.').pop()?.toLowerCase();
  if (ext === 'mp4' || ext === 'm4v') return 'video/mp4';
  if (ext === 'mov') return 'video/quicktime';
  if (ext === 'webm') return 'video/webm';
  return null;
}

export function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ].find((m) => MediaRecorder.isTypeSupported(m));
}

export function readVideoMeta(src: Blob): Promise<VideoMeta> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(src);
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    const fail = () => { clearTimeout(timer); URL.revokeObjectURL(url); rej(new Error('We could not read that video. Please use MP4, MOV or WebM, or record in the browser.')); };
    const ok = () => { clearTimeout(timer); const m = { duration: v.duration, width: v.videoWidth, height: v.videoHeight }; URL.revokeObjectURL(url); res(m); };
    const timer = setTimeout(fail, 15000);
    v.onerror = fail;
    v.onloadedmetadata = () => {
      if (v.duration === Infinity) {
        // Browser-recorded WebM reports Infinity until we seek to the end.
        v.ontimeupdate = () => { v.ontimeupdate = null; ok(); };
        v.currentTime = 1e101;
      } else ok();
    };
    v.src = url;
  });
}

/** Small JPEG poster taken from the video (returns null if the browser can't do it). */
export async function videoThumb(src: Blob, width: number): Promise<Blob | null> {
  const url = URL.createObjectURL(src);
  try {
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    const loaded = await withTimeout(new Promise<boolean>((r) => { v.onloadeddata = () => r(true); v.onerror = () => r(false); }), 8000);
    if (!loaded) return null;
    const d = Number.isFinite(v.duration) ? v.duration : 1;
    v.currentTime = Math.min(1, d / 2);
    await withTimeout(new Promise<void>((r) => { v.onseeked = () => r(); }), 5000);
    const w = Math.min(width, v.videoWidth);
    const h = Math.round((w * v.videoHeight) / v.videoWidth);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    c.getContext('2d')!.drawImage(v, 0, 0, w, h);
    return await toBlob(c, 0.7);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Best-effort re-encode to ~720p / 2.5 Mbps by playing the video onto a canvas and recording it.
 * Runs in real time (takes as long as the clip, max 45 s). If the browser can't do it, returns the original.
 */
export async function compressVideo(src: Blob, onProgress: (pct: number) => void): Promise<Blob> {
  try {
    const mime = pickRecorderMime();
    if (!mime || !HTMLCanvasElement.prototype.captureStream) return src;

    const url = URL.createObjectURL(src);
    const v = document.createElement('video');
    v.playsInline = true;
    v.preload = 'auto';
    v.src = url;
    await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error('meta')); });

    const scale = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    const cw = Math.round((v.videoWidth * scale) / 2) * 2;
    const ch = Math.round((v.videoHeight * scale) / 2) * 2;
    const canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    const g = canvas.getContext('2d')!;
    const stream = canvas.captureStream(30);

    let actx: AudioContext | null = null;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      actx = new AC();
      await actx.resume();
      const node = actx.createMediaElementSource(v); // routed only to the recorder, so nothing plays out loud
      const dest = actx.createMediaStreamDestination();
      node.connect(dest);
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    } catch { /* no audio capture available: video-only is better than nothing */ }

    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 96_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const stopped = new Promise<void>((r) => { rec.onstop = () => r(); });

    let raf = 0;
    const draw = () => {
      g.drawImage(v, 0, 0, cw, ch);
      onProgress(Math.min(99, Math.round((v.currentTime / (v.duration || 1)) * 100)));
      raf = requestAnimationFrame(draw);
    };
    rec.start(500);
    await v.play();
    draw();
    await new Promise<void>((res) => { v.onended = () => res(); setTimeout(res, (v.duration + 8) * 1000); });
    cancelAnimationFrame(raf);
    if (rec.state !== 'inactive') rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
    actx?.close();
    URL.revokeObjectURL(url);

    const out = new Blob(chunks, { type: baseType(mime) });
    return out.size > 0 && out.size < src.size ? out : src;
  } catch {
    return src;
  }
}

/* ---------- upload with progress ---------- */
export function putFile(url: string, blob: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void) {
  return new Promise<void>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open('PUT', url);
    Object.entries(headers).forEach(([k, v]) => x.setRequestHeader(k, v));
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
    x.onload = () => (x.status >= 200 && x.status < 300 ? res() : rej(new Error(`Upload failed (${x.status}). Please try again.`)));
    x.onerror = () => rej(new Error('Network error while uploading. Please check your connection and try again.'));
    x.ontimeout = () => rej(new Error('The upload took too long. Please try again on a better connection.'));
    x.timeout = 10 * 60 * 1000;
    x.send(blob);
  });
}
