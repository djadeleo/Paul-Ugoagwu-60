'use client';
import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Wish } from '@/lib/types';

export default function Lightbox({ wish, onClose }: { wish: Wish | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!wish) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [wish, onClose]);

  return (
    <AnimatePresence>
      {wish && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          role="dialog" aria-modal="true" aria-label={`Wish from ${wish.name}`}
          onClick={onClose}
        >
          <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-midnight-soft" onClick={(e) => e.stopPropagation()}>
            {wish.video_url ? (
              <video src={wish.video_url} poster={wish.thumbnail_url ?? undefined} controls autoPlay playsInline preload="metadata" className="aspect-video w-full bg-black" />
            ) : wish.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wish.photo_url} alt={`Photo from ${wish.name}`} className="max-h-[70vh] w-full object-contain bg-black" />
            ) : null}
            <div className="p-6">
              <p className="whitespace-pre-line text-lg leading-relaxed">{wish.message}</p>
              <p className="mt-4 font-semibold">{wish.name}{wish.location && <span className="font-normal text-platinum-dim"> · {wish.location}</span>}</p>
            </div>
          </div>
          <button ref={closeRef} onClick={onClose} aria-label="Close" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-platinum text-xl text-midnight">✕</button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
