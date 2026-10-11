import Link from 'next/link';
import { siteConfig } from '@site';
import HeroSlideshow, { type Slide } from '@/components/HeroSlideshow';
import WishCard from '@/components/WishCard';
import slides from '@/generated/slides.json';
import { isClosed } from '@/lib/config-helpers';
import { fetchApproved } from '@/lib/public-wishes';

export const revalidate = 60; // home page refreshes at most once a minute -> very few database requests

export default async function Home() {
  const wishes = await fetchApproved(6);
  const closed = isClosed();
  const note = siteConfig.thankYouNote;

  return (
    <>
      <HeroSlideshow slides={slides as Slide[]} intervalMs={siteConfig.slideshow.intervalMs}>
        <p className="text-sm uppercase tracking-[0.3em] text-platinum-dim">Celebrating</p>
        <h1 className="mt-3 font-display text-5xl font-semibold sm:text-7xl">{siteConfig.title}</h1>
        <p className="mt-4 max-w-xl text-lg text-platinum/90">{siteConfig.tagline}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {closed ? (
            <Link href="/gallery" className="btn btn-primary text-lg">View the wishes</Link>
          ) : (
            <Link href="/wish" className="btn btn-primary px-8 py-4 text-lg shadow-lg shadow-black/40">Add your wish</Link>
          )}
          <Link href="/wishes/slide" className="btn btn-ghost">Watch the slide show</Link>
        </div>
      </HeroSlideshow>

      <section aria-labelledby="wishes-h" className="mx-auto max-w-6xl px-4 py-20">
        <h2 id="wishes-h" className="text-center font-display text-4xl">Wishes &amp; Prayers</h2>
        {wishes.length ? (
          <div className="mt-10 columns-1 gap-4 sm:columns-2 lg:columns-3">
            {wishes.map((w) => <WishCard key={w.id} wish={w} />)}
          </div>
        ) : (
          <p className="mt-8 text-center text-platinum-dim">Be the first to leave a wish.</p>
        )}
        <div className="mt-8 text-center"><Link href="/gallery" className="btn btn-ghost">See all wishes</Link></div>
      </section>

      <section aria-labelledby="thanks-h" className="mx-auto max-w-2xl px-4 pb-24 text-center">
        <div className="card p-8 sm:p-12">
          <h2 id="thanks-h" className="font-display text-3xl">{note.heading}</h2>
          {note.body.map((p) => <p key={p} className="mt-4 leading-relaxed text-platinum/90">{p}</p>)}
          <p className="mt-6 font-display text-2xl italic">{note.signature}</p>
        </div>
      </section>
    </>
  );
}
