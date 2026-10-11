# Paul Ugoagwu @ 60 — Birthday Wishes Site

Next.js (App Router) · TypeScript · Tailwind · Framer Motion · Supabase (Postgres + Auth only) · Cloudflare R2 (all media) · Cloudflare Turnstile · Vercel Hobby. Free tiers only.

## Docs
- `docs/SETUP.md` — beginner step-by-step: Supabase, R2, Turnstile, GitHub, Vercel, custom domain
- `docs/OPERATIONS.md` — slideshow photos, approving wishes, storage usage, backing up all videos
- `supabase/schema.sql` — tables, RLS policies, helper functions
- `.env.example` — every environment variable

## Structure
```
site.config.ts            name, age, colors, thank-you note, close date, upload limits
supabase/schema.sql       run once in the Supabase SQL editor
scripts/                  builds the home slideshow list from public/images/slidehome
src/app/                  pages: / , /wish , /wishes/slide , /gallery , /admin
src/app/api/              session, upload-url, wishes, status, admin/*, cron/ping
src/components/           WishForm, VideoRecorder, Turnstile, Lightbox, AdminClient ...
src/lib/                  r2.ts (presigned URLs), security.ts, media.ts (client compression)
```

## How uploads work
1. Visitor passes Turnstile → `/api/session` returns a 15-minute signed session.
2. Browser compresses photo (1600 px) / video (≈720p), makes JPEG thumbnails.
3. For each file the browser asks `/api/upload-url` for a presigned R2 URL (type, size, rate limit and storage cap checked) and uploads **directly to R2**.
4. `/api/wishes` re-checks real file sizes in R2, then inserts a `pending` row in Supabase.
5. Admin approves in `/admin`; only approved rows are readable by the public (RLS).

## Local run
```bash
npm install
cp .env.example .env.local   # fill in values (see docs/SETUP.md)
npm run dev
```
