# Running the site

## Add / change home slideshow photos and clips
1. Put files in `public/images/slidehome/` (delete the `placeholder-*.jpg` files).
2. Photos: JPG/WebP, about 1920 px wide, under ~400 KB each. Clips: MP4/WebM, under ~5 MB, a few seconds, no sound needed.
3. Files show in natural number order (`01.jpg`, `02.jpg` …).
4. Optional alt text: create `public/images/slidehome/alts.json`, e.g. `{ "01.jpg": "Paul at his graduation" }`.
5. Commit and push to GitHub; Vercel redeploys automatically (about a minute).

## Other edits (all in `site.config.ts`)
- Thank-you note, tagline, colors, upload limits.
- `wishesCloseDate`: e.g. `'2026-12-31T23:59:59Z'`. After that the form says "Wishes are now closed" (the server enforces it too).

## Approving wishes
1. Go to `/admin` and sign in.
2. **Pending** tab: preview each wish, then **Approve**, **Reject** or **Delete**. Use the checkboxes for bulk actions.
3. Delete removes the database row **and** its files from R2.
4. Approved wishes appear on Home (within a minute), Gallery and Slide show.

## Checking storage
- `/admin` shows used space against the cap. Yellow line = **8 GB**: video uploads close automatically (text wishes still work). At **9.5 GB** all uploads stop.
- Cloudflare dashboard → R2 also shows true bucket size (free allowance is 10 GB).
- To free space: delete unwanted wishes in `/admin`.

## Back up everything after the celebration
1. `/admin` → **Download backup (JSON)** (all text and links).
2. Download all media with rclone (free, rclone.org):
   - `rclone config` → new remote `r2` → storage **Amazon S3 Compliant** → provider **Cloudflare** → paste your R2 Access Key ID and Secret → endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
   - `rclone copy r2:YOUR_BUCKET ./paul60-backup --progress`
3. Keep the backup on an external drive or cloud storage you own, then verify a few videos open.
4. Afterwards you can leave the site up (it costs nothing) or delete the bucket.

## Troubleshooting
- **Upload fails with a CORS error:** the exact site URL (https, no trailing slash) must be in the R2 CORS list.
- **"Security check failed":** hostname missing in Turnstile, or wrong site/secret key pair.
- **Admin says "not an administrator":** run the `insert into public.admins` SQL with your lowercase email.
- **Supabase project paused:** check Vercel → Cron Jobs ran; you can also click Restore in Supabase.
