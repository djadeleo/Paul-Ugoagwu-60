# Free setup guide (beginner friendly)

You need: a computer, an email address, a GitHub account, a Cloudflare account, a Supabase account, a Vercel account. All free. No credit card is required for Supabase, Vercel Hobby or Turnstile. **Cloudflare R2 may ask for a payment method to activate** even though the free allowance is 10 GB; the site stops uploads before you reach it.

**Golden rule:** secret keys (marked SECRET) go only into `.env.local` or the Vercel settings. Never paste them into chat, email or GitHub.

## 0. Install the tools
1. Install Node.js (LTS) from nodejs.org.
2. Install Git from git-scm.com, and (optional) GitHub Desktop.
3. In a terminal inside this folder: `npm install`.
4. Copy `.env.example` to `.env.local`. You'll fill it in as you go.

## 1. Supabase (database + admin login)
1. supabase.com → **Start your project** → **New project**. Pick the Free plan, a name, a strong database password (save it), and a region near most guests.
2. Left menu → **SQL Editor** → **New query**. Paste all of `supabase/schema.sql` → **Run**. You should see "Success".
3. **Authentication → Users → Add user → Create new user**: your admin email + a strong password, tick **Auto Confirm User**.
4. **Authentication → Sign In / Providers** (or Settings): turn **OFF** "Allow new users to sign up". This keeps strangers from creating accounts.
5. Back in **SQL Editor**, run (lowercase email, exactly the one from step 3):
   `insert into public.admins (email) values ('your-email@example.com');`
6. **Project Settings → API** (or API Keys). Copy into `.env.local`:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / publishable key → `NEXT_PUBLIC_SUPABASE_ANON_KEY` (safe to be public)
   - `service_role` / secret key → `SUPABASE_SERVICE_ROLE_KEY` (**SECRET**)

## 2. Cloudflare R2 (photos + videos)
1. dash.cloudflare.com → **R2 Object Storage** → activate (free plan).
2. **Create bucket**: name e.g. `paul60-wishes`, location automatic.
3. Open the bucket → **Settings → Public access → R2.dev subdomain → Allow Access**. Copy the URL (looks like `https://pub-xxxx.r2.dev`) → `R2_PUBLIC_URL`. Bucket name → `R2_BUCKET`.
4. Same Settings page → **CORS policy → Add**, paste (replace the site URL after you deploy in step 6):
   ```json
   [{
     "AllowedOrigins": ["http://localhost:3000", "https://YOUR-SITE.vercel.app"],
     "AllowedMethods": ["GET", "PUT", "HEAD"],
     "AllowedHeaders": ["*"],
     "ExposeHeaders": ["ETag"],
     "MaxAgeSeconds": 3600
   }]
   ```
5. R2 overview page → **Manage API Tokens → Create API token**. Permission: **Object Read & Write**, apply to your bucket only. Copy:
   - Access Key ID → `R2_ACCESS_KEY_ID`
   - Secret Access Key → `R2_SECRET_ACCESS_KEY` (**SECRET**, shown once)
   - Account ID (top of the R2 page) → `R2_ACCOUNT_ID`

## 3. Cloudflare Turnstile (spam protection)
1. Cloudflare dashboard → **Turnstile → Add widget**.
2. Hostnames: add your Vercel hostname (after step 6) and `localhost`. Mode: **Managed**.
3. Copy Site Key → `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; Secret Key → `TURNSTILE_SECRET_KEY` (**SECRET**).
   (The test keys already in `.env.example` always pass, for local testing only.)

## 4. Two random secrets
Run twice: `openssl rand -hex 32` (or use any long random string). Put one in `SESSION_SECRET`, the other in `CRON_SECRET`.

## 5. Test locally
`npm run dev` → open http://localhost:3000. Submit a test wish at `/wish`, then sign in at `/admin` and approve it.

## 6. GitHub + Vercel
1. Create a **private** repo on github.com and push this folder (`.env.local` is git-ignored, so secrets stay off GitHub).
2. vercel.com → **Add New → Project** → import the repo (Hobby plan, framework Next.js).
3. Before deploying, open **Environment Variables** and add every variable from `.env.example` (use real Turnstile keys; set `NEXT_PUBLIC_SITE_URL` to your final URL).
4. **Deploy**. Then:
   - add the final URL to the R2 CORS list (step 2.4) and the Turnstile hostnames (step 3.2);
   - **Settings → Cron Jobs** should show the daily `/api/cron/ping` (keeps Supabase awake and cleans up unattached uploads).

## 7. Optional custom domain
Vercel → project **Settings → Domains → Add**, then follow the DNS instructions at your registrar. Update `NEXT_PUBLIC_SITE_URL`, R2 CORS and Turnstile hostnames to the new domain and redeploy.
(Optional: connect a custom domain to the R2 bucket for `R2_PUBLIC_URL`; r2.dev is fine for this event.)
