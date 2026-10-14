'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type Slide = { src: string; type: 'image' | 'video'; alt: string };

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={dir === 'left' ? 'M14 5l-7 7 7 7' : 'M10 5l7 7-7 7'} />
    </svg>
  );
}

export default function HeroSlideshow({ slides, intervalMs, children }: { slides: Slide[]; intervalMs: number; children: React.ReactNode }) {
  const n = slides.length;
  const [i, setI] = useState(0);
  const [whole, setWhole] = useState<Record<string, boolean>>({});
  const box = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const reduce = useReducedMotion();

  const go = useCallback((d: number) => { if (n > 1) setI((v) => (v + d + n) % n); }, [n]);

  // Auto-advance. Every change of i (timer, arrow, key or swipe) restarts the timer.
  useEffect(() => {
    if (n < 2) return;
    const t = setTimeout(() => go(1), intervalMs);
    return () => clearTimeout(t);
  }, [i, n, intervalMs, go]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Photos whose shape differs a lot from the photo area are shown whole (never cropped) on a blurred copy.
  const decide = useCallback((src: string, w: number, h: number) => {
    const b = box.current;
    if (!b || !b.clientHeight || !h) return;
    const mismatch = Math.abs(Math.log(w / h / (b.clientWidth / b.clientHeight))) > 0.3;
    setWhole((c) => (c[src] === mismatch ? c : { ...c, [src]: mismatch }));
  }, []);

  // Cached images can finish loading before React attaches onLoad, so also check once after each change.
  useEffect(() => {
    const s = slides[i];
    if (!s) return;
    box.current?.querySelectorAll<HTMLImageElement>('img[data-main]').forEach((img) => {
      if (img.getAttribute('data-src') === s.src && img.complete && img.naturalWidth) decide(s.src, img.naturalWidth, img.naturalHeight);
    });
  }, [i, slides, decide]);

  const s = slides[i];
  const next = n > 1 ? slides[(i + 1) % n] : null;
  const showWhole = !!s && !!whole[s.src];
  const arrow =
    'absolute top-1/2 z-10 grid h-12 w-12 -translate-y-1/2 place-items-center rounded-full border border-platinum/40 bg-midnight/60 text-platinum backdrop-blur hover:bg-midnight/80 md:h-14 md:w-14';

  return (
    <section aria-label="Celebration photos" className="flex min-h-[100svh] flex-col bg-midnight md:h-[100svh] md:min-h-[560px] md:flex-row">
      {/* Text panel: below the photo on phones, to the left on desktop. Never covers a photo. */}
      <div className="order-2 flex flex-col items-center justify-center gap-4 px-6 pb-12 pt-8 text-center md:order-1 md:w-[28%] md:min-w-[300px] md:items-start md:px-8 md:pb-8 md:pt-24 md:text-left">
        {children}
      </div>

      <div
        ref={box}
        className="relative order-1 h-[62svh] overflow-hidden bg-midnight-soft md:order-2 md:h-auto md:flex-1"
        onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          const x0 = touchX.current;
          touchX.current = null;
          if (x0 == null) return;
          const dx = e.changedTouches[0].clientX - x0;
          if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        }}
      >
        <AnimatePresence initial={false}>
          {s && (
            <motion.div key={s.src} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.8 }}>
              {s.type === 'video' ? (
                <video src={s.src} autoPlay muted loop playsInline preload="metadata" aria-label={s.alt} className="h-full w-full object-cover object-[50%_22%]" />
              ) : (
                <>
                  {showWhole && <img src={s.src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />}
                  <motion.img
                    src={s.src} alt={s.alt} data-main="" data-src={s.src} fetchPriority={i === 0 ? 'high' : 'auto'}
                    onLoad={(e) => decide(s.src, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                    className={`absolute inset-0 h-full w-full ${showWhole ? 'object-contain' : 'object-cover object-[50%_22%]'}`}
                    initial={{ scale: 1 }} animate={{ scale: reduce || showWhole ? 1 : 1.05 }} transition={{ duration: intervalMs / 1000 + 1, ease: 'linear' }}
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {next?.type === 'image' && <img src={next.src} alt="" aria-hidden className="hidden" />}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-midnight/80 to-transparent" aria-hidden />

        {n > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${arrow} left-3 md:left-5`}><Chevron dir="left" /></button>
            <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${arrow} right-3 md:right-5`}><Chevron dir="right" /></button>
            <div className="absolute bottom-4 right-4 z-10 rounded-full bg-midnight/65 px-3 py-1 text-xs font-semibold text-platinum" aria-hidden="true">{i + 1} / {n}</div>
            <p className="sr-only" aria-live="polite">Photo {i + 1} of {n}</p>
          </>
        )}
      </div>
    </section>
  );
}
