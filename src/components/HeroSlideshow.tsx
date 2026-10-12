'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type Slide = { src: string; type: 'image' | 'video'; alt: string };

export default function HeroSlideshow({ slides, intervalMs, children }: { slides: Slide[]; intervalMs: number; children: React.ReactNode }) {
  const [i, setI] = useState(0);
  const [whole, setWhole] = useState<Record<string, boolean>>({});
  const reduce = useReducedMotion();

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % slides.length), intervalMs);
    return () => clearTimeout(t);
  }, [i, slides.length, intervalMs]);

  const decide = (src: string, w: number, h: number) => {
    const mismatch = Math.abs(Math.log(w / h / (window.innerWidth / window.innerHeight))) > 0.3;
    setWhole((c) => (c[src] === mismatch ? c : { ...c, [src]: mismatch }));
  };

  const s = slides[i];
  const next = slides.length > 1 ? slides[(i + 1) % slides.length] : null;
  const showWhole = !!s && !!whole[s.src];

  return (
    <section aria-label="Celebration photos" className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-gradient-to-b from-midnight-soft to-midnight">
      <AnimatePresence initial={false}>
        {s && (
          <motion.div key={s.src} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 1.2 }}>
            {s.type === 'video' ? (
              <video src={s.src} autoPlay muted loop playsInline preload="metadata" aria-label={s.alt} className="h-full w-full object-cover object-[50%_22%]" />
            ) : (
              <>
                {showWhole && (
                  <img src={s.src} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-2xl" />
                )}
                <motion.img
                  src={s.src} alt={s.alt} fetchPriority={i === 0 ? 'high' : 'auto'}
                  onLoad={(e) => decide(s.src, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                  className={`absolute inset-0 h-full w-full ${showWhole ? 'object-contain' : 'object-cover object-[50%_22%]'}`}
                  initial={{ scale: 1 }} animate={{ scale: reduce || showWhole ? 1 : 1.06 }} transition={{ duration: intervalMs / 1000 + 1.5, ease: 'linear' }}
                />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {next?.type === 'image' && <img src={next.src} alt="" aria-hidden className="hidden" />}
      <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/30 to-transparent" aria-hidden />
      <div className="relative z-10 flex h-full flex-col items-center justify-end px-4 pb-14 text-center">{children}</div>
    </section>
  );
}
