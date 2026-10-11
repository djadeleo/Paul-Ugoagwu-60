'use client';
import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

export type Slide = { src: string; type: 'image' | 'video'; alt: string };

export default function HeroSlideshow({ slides, intervalMs, children }: { slides: Slide[]; intervalMs: number; children: React.ReactNode }) {
  const [i, setI] = useState(0);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (slides.length < 2) return;
    const t = setTimeout(() => setI((v) => (v + 1) % slides.length), intervalMs);
    return () => clearTimeout(t);
  }, [i, slides.length, intervalMs]);

  const s = slides[i];
  const next = slides.length > 1 ? slides[(i + 1) % slides.length] : null;

  return (
    <section aria-label="Celebration photos" className="relative h-[100svh] min-h-[560px] w-full overflow-hidden bg-gradient-to-b from-midnight-soft to-midnight">
      <AnimatePresence initial={false}>
        {s && (
          <motion.div key={s.src} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 1.2 }}>
            {s.type === 'video' ? (
              <video src={s.src} autoPlay muted loop playsInline preload="metadata" aria-label={s.alt} className="h-full w-full object-cover" />
            ) : (
              <motion.img
                src={s.src} alt={s.alt} fetchPriority={i === 0 ? 'high' : 'auto'}
                className="h-full w-full object-cover"
                initial={{ scale: 1 }} animate={{ scale: reduce ? 1 : 1.08 }} transition={{ duration: intervalMs / 1000 + 1.5, ease: 'linear' }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {next?.type === 'image' && <img src={next.src} alt="" aria-hidden className="hidden" />}
      <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/55 to-midnight/30" aria-hidden />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center">{children}</div>
    </section>
  );
}
