import type { Metadata } from 'next';
import WishForm from '@/components/WishForm';

export const metadata: Metadata = { title: 'Add your wish' };

export default function WishPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pb-20 pt-28">
      <h1 className="text-center font-display text-4xl sm:text-5xl">Add your wish</h1>
      <p className="mx-auto mb-10 mt-3 max-w-xl text-center text-platinum-dim">Leave a message, a prayer, a photo or a video. It will mean the world.</p>
      <WishForm />
    </div>
  );
}
