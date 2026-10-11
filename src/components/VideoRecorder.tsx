'use client';
import { useEffect, useRef, useState } from 'react';
import { baseType } from '@/lib/config-helpers';
import { pickRecorderMime } from '@/lib/media';

type Props = { maxSeconds: number; onRecorded: (blob: Blob) => void; onCancel: () => void };

export default function VideoRecorder({ maxSeconds, onRecorded, onCancel }: Props) {
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [state, setState] = useState<'idle' | 'live' | 'recording'>('idle');
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  const stopStream = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; };
  useEffect(() => () => stopStream(), []);

  useEffect(() => {
    if (state !== 'idle' && liveRef.current && streamRef.current) {
      liveRef.current.srcObject = streamRef.current;
      liveRef.current.play().catch(() => {});
    }
  }, [state]);

  useEffect(() => {
    if (state !== 'recording') return;
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    if (state === 'recording' && secs >= maxSeconds) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secs, state]);

  async function openCamera() {
    setErr(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('unsupported');
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      setState('live');
    } catch (e) {
      setErr(
        (e as Error).message === 'unsupported'
          ? 'In-browser recording is not supported here. Use "Open phone camera" or upload a video instead.'
          : 'We could not access your camera/microphone. Please allow access in your browser, or upload a video instead.',
      );
    }
  }

  function start() {
    const mime = pickRecorderMime();
    const rec = new MediaRecorder(streamRef.current!, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 2_500_000,
      audioBitsPerSecond: 96_000,
    });
    chunks.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks.current, { type: baseType(rec.mimeType || mime || 'video/webm') });
      stopStream();
      setState('idle');
      onRecorded(blob);
    };
    recRef.current = rec;
    rec.start(1000);
    setSecs(0);
    setState('recording');
  }
  function stop() { if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop(); }

  return (
    <div className="rounded-xl border border-platinum/20 bg-midnight-soft p-4">
      {state !== 'idle' && (
        <div className="relative mb-3 overflow-hidden rounded-lg bg-black">
          <video ref={liveRef} muted playsInline autoPlay className="aspect-video w-full -scale-x-100 object-cover" aria-label="Camera preview" />
          {state === 'recording' && (
            <span className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-sm font-semibold text-white" role="timer">
              ● {secs}s / {maxSeconds}s
            </span>
          )}
        </div>
      )}
      {err && <p role="alert" className="mb-3 text-sm text-red-300">{err}</p>}
      <div className="flex flex-wrap gap-2">
        {state === 'idle' && <button type="button" className="btn btn-primary" onClick={openCamera}>Turn on camera</button>}
        {state === 'live' && <button type="button" className="btn btn-primary" onClick={start}>Start recording</button>}
        {state === 'recording' && <button type="button" className="btn btn-primary" onClick={stop}>Stop recording</button>}
        <button type="button" className="btn btn-ghost" onClick={() => { stopStream(); onCancel(); }}>Cancel</button>
      </div>
      <p className="mt-2 text-xs text-platinum-dim">Recording stops automatically at {maxSeconds} seconds.</p>
    </div>
  );
}
