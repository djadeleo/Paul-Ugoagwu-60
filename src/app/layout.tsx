import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import Link from 'next/link';
import { siteConfig } from '@site';
import './globals.css';

const display = Playfair_Display({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const sans = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: { default: siteConfig.title, template: `%s | ${siteConfig.title}` },
  description: siteConfig.description,
  openGraph: { type: 'website', siteName: siteConfig.title, title: siteConfig.title, description: siteConfig.description },
  twitter: { card: 'summary_large_image', title: siteConfig.title, description: siteConfig.description },
};
export const viewport: Viewport = { themeColor: siteConfig.theme.bg, width: 'device-width', initialScale: 1 };

const links = [
  { href: '/', label: 'Home' },
  { href: '/wish', label: 'Add wish' },
  { href: '/wishes/slide', label: 'Slide show' },
  { href: '/gallery', label: 'Gallery' },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded focus:bg-platinum focus:px-4 focus:py-2 focus:text-midnight">
          Skip to content
        </a>
        <header className="absolute inset-x-0 top-0 z-30">
          <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4">
            <Link href="/" className="font-display text-lg font-semibold">{siteConfig.title}</Link>
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {links.map((l) => (
                <li key={l.href}><Link href={l.href} className="py-2 text-platinum/90 hover:text-white">{l.label}</Link></li>
              ))}
            </ul>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="border-t border-platinum/10 px-4 py-8 text-center text-sm text-platinum-dim">
          © {new Date().getFullYear()} {siteConfig.title}. With love from family and friends around the world.
        </footer>
      </body>
    </html>
  );
}
