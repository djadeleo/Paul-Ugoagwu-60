'use client';
import { useCallback, useEffect, useState } from 'react';
import Lightbox from './Lightbox';
import WishCard from './WishCard';
import { supabaseBrowser } from '@/lib/supabase-browser';
import type { Wish } from '@/lib/types';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'videos', label: 'Videos' },
  { id: 'photos', label: 'Photos' },
  { id: 'messages', label: 'Messages' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];
const PAGE = 24;

export default function GalleryClient() {
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<Wish[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [open, setOpen] = useState<Wish | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async (f: Filter, from: number) => {
    setLoading(true);
    setFailed(false);
    let q = supabaseBrowser().from('wishes').select('*').eq('status', 'approved').order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (f === 'videos') q = q.not('video_url', 'is', null);
    if (f === 'photos') q = q.is('video_url', null).not('photo_url', 'is', null);
    if (f === 'messages') q = q.is('video_url', null).is('photo_url', null);
    const { data, error } = await q;
    if (error) setFailed(true);
    const rows = (data as Wish[]) ?? [];
    setItems((prev) => (from === 0 ? rows : [...prev, ...rows]));
    setMore(rows.length === PAGE);
    setLoading(false);
  }, []);

  useEffect(() => { load(filter, 0); }, [filter, load]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-20 pt-28">
      <h1 className="text-center font-display text-4xl sm:text-5xl">Gallery of wishes</h1>
      <div role="group" aria-label="Filter wishes" className="my-8 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => (
          <button key={f.id} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}
            className={`btn px-5 py-2 text-sm ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}>{f.label}</button>
        ))}
      </div>

      {failed && <p role="alert" className="text-center text-red-300">We couldn&apos;t load the wishes. Please refresh the page.</p>}
      {!loading && !failed && items.length === 0 && <p className="text-center text-platinum-dim">Nothing here yet.</p>}

      <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
        {items.map((w) => <WishCard key={w.id} wish={w} onOpen={setOpen} />)}
      </div>

      <div className="mt-8 text-center" aria-live="polite">
        {loading && <p className="text-platinum-dim">Loading…</p>}
        {!loading && more && <button className="btn btn-ghost" onClick={() => load(filter, items.length)}>Load more</button>}
      </div>
      <Lightbox wish={open} onClose={() => setOpen(null)} />
    </div>
  );
}
