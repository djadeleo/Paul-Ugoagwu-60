'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { Wish } from '@/lib/types';

const kindOf = (w: Wish) => (w.video_url ? 'video' : w.photo_url ? 'photo' : 'text');

/** Shrinks the text until all of it fits its box, so nothing is cut off. It scrolls only as a last resort. */
function FitText({ text, max, min = 13 }: { text: string; max: number; min?: number }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      let s = max;
      el.style.fontSize = `${s}px`;
      while (s > min && el.scrollHeight > el.clientHeight + 1) {
        s -= 1;
        el.style.fontSize = `${s}px`;
      }
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    document.fonts?.ready.then(fit);
    return () => ro.disconnect();
  }, [text, max, min]);
  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <blockquote className="my-auto whitespace-pre-line break-words font-display leading-snug">{text}</blockquote>
    </div>
  );
}

export default function SlideshowClient() {
  const [wishes, setWishes] = useState<Wish[] | null>(null);
  const [started, setStarted] = useState(false);
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [canFs, setCanFs] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    setCanFs(!!document.documentElement.requestFullscreen);
    supabaseBrowser().from('wishes').select('*').eq('status', 'approved').order('created_at', { ascending: true }).limit(500)
      .then(({ data }) => setWishes((data as Wish[]) ?? []));
  }, []);

  const n = wishes?.length ?? 0;
  const w = wishes?.[i];
  const kind = w ? kindOf(w) : null;
  const next = useCallback(() => n && setI((v) => (v + 1) % n), [n]);
  const prev = useCallback(() => n && setI((v) => (v - 1 + n) % n), [n]);

  // Photos and text advance on a timer (longer messages stay longer); videos advance when they end.
  useEffect(() => {
    if (!started || !playing || !w || kind === 'video') return;
    const ms = Math.min(25000, 6000 + w.message.length * 40);
    const t = setTimeout(next, ms);
    return () => clearTimeout(t);
  }, [started, playing, w, kind, next]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      const v = vid.current;
      if (v) (p ? v.pause() : v.play().catch(() => {}));
      return !p;
    });
  }, []);

  const toggleFs = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen();
    else box.current?.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      else if (e.key.toLowerCase() === 'f') toggleFs();
      else if (e.key.toLowerCase() === 'm') setMuted((m) => !m);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started, next, prev, togglePlay, toggleFs]);

  if (wishes === null) return <p className="grid min-h-screen place-items-center text-platinum-dim">Loading…</p>;
  if (!n) return <p className="grid min-h-screen place-items-center px-4 text-center text-platinum-dim">No approved wishes yet. Check back soon!</p>;

  const hasMedia = kind === 'video' || kind === 'photo';

  return (
    <div ref={box} className="relative flex h-[100svh] min-h-[480px] flex-col overflow-hidden bg-midnight">
      {!started ? (
        <div className="grid flex-1 place-items-center px-4 text-center">
          <div>
            <h1 className="font-display text-4xl sm:text-5xl">Wishes slide show</h1>
            <p className="mt-3 text-platinum-dim">{n} wishes · keyboard: ← → space F M</p>
            <button className="btn btn-primary mt-8 px-10 py-4 text-lg" onClick={() => setStarted(true)}>Start slide show</button>
          </div>
        </div>
      ) : (
        <>
          <div className="relative min-h-0 flex-1" aria-live="off">
            <AnimatePresence mode="wait">
              <motion.div key={w!.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}
                className="absolute inset-0 flex px-4 pb-24 pt-16 md:px-10">
                <div className={`mx-auto flex h-full w-full flex-col items-stretch gap-4 ${hasMedia ? 'max-w-6xl lg:flex-row lg:gap-10' : 'max-w-4xl'}`}>
                  {kind === 'video' && (
                    <div className="h-[36%] w-full shrink-0 lg:h-full lg:w-[55%]">
                      <video
                        ref={vid} src={w!.video_url!} poster={w!.thumbnail_url ?? undefined}
                        autoPlay playsInline muted={muted} preload="metadata"
                        onLoadedData={(e) => { const v = e.currentTarget; if (!playing) return; v.play().catch(() => { setMuted(true); v.muted = true; v.play().catch(() => {}); }); }}
                        onEnded={next} onError={() => setTimeout(next, 1500)}
                        className="h-full w-full rounded-xl bg-black object-contain"
                      />
                    </div>
                  )}
                  {kind === 'photo' && (
                    <div className="h-[36%] w-full shrink-0 lg:h-full lg:w-[55%]">
                      <img src={w!.photo_url!} alt={`Photo from ${w!.name}`} className="h-full w-full rounded-xl object-contain" />
                    </div>
                  )}
                  <figure className={`flex min-h-0 w-full flex-1 flex-col ${hasMedia ? 'text-center lg:text-left' : 'text-center'}`}>
                    <FitText text={w!.message} max={hasMedia ? 30 : 44} />
                    <figcaption className="mt-3 shrink-0 text-platinum-dim">— {w!.name}{w!.location && `, ${w!.location}`}</figcaption>
                  </figure>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-midnight to-transparent p-4" role="toolbar" aria-label="Slide show controls">
            <button className="btn btn-ghost px-4 py-2" onClick={prev} aria-label="Previous wish">‹</button>
            <button className="btn btn-primary px-6 py-2" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
            <button className="btn btn-ghost px-4 py-2" onClick={next} aria-label="Next wish">›</button>
            {kind === 'video' && <button className="btn btn-ghost px-4 py-2" onClick={() => setMuted((m) => !m)} aria-pressed={muted}>{muted ? '🔇' : '🔊'}</button>}
            {canFs && <button className="btn btn-ghost px-4 py-2" onClick={toggleFs} aria-label="Toggle fullscreen">⛶</button>}
            <span className="ml-2 text-sm text-platinum-dim">{i + 1} / {n}</span>
          </div>
        </>
      )}
    </div>
  );
}
