'use client';
import { motion } from 'framer-motion';
import type { Wish } from '@/lib/types';

export default function WishCard({ wish, onOpen }: { wish: Wish; onOpen?: (w: Wish) => void }) {
  const media = wish.thumbnail_url || wish.photo_url;
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={media!}
      alt={`${wish.video_url ? 'Video thumbnail' : 'Photo'} from ${wish.name}`}
      loading="lazy"
      decoding="async"
      className="h-auto w-full"
    />
  );
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5 }}
      className="card mb-4 break-inside-avoid overflow-hidden"
    >
      {media &&
        (onOpen ? (
          <button type="button" onClick={() => onOpen(wish)} className="relative block w-full" aria-label={wish.video_url ? `Play video wish from ${wish.name}` : `Open photo from ${wish.name}`}>
            {img}
            {wish.video_url && (
              <span aria-hidden className="absolute inset-0 grid place-items-center bg-black/20">
                <span className="grid h-14 w-14 place-items-center rounded-full bg-platinum/90 text-2xl text-midnight">▶</span>
              </span>
            )}
          </button>
        ) : (
          img
        ))}
      <div className="p-5">
        <p className={`whitespace-pre-line leading-relaxed ${onOpen ? 'line-clamp-8' : ''}`}>{wish.message}</p>
        <footer className="mt-4 text-sm">
          <span className="font-semibold">{wish.name}</span>
          {wish.location && <span className="text-platinum-dim"> · {wish.location}</span>}
        </footer>
      </div>
    </motion.article>
  );
}
