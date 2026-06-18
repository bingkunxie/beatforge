# Beatforge backend setup

1. **Create a Supabase project** at supabase.com (free tier).
2. **Run the schema:** open SQL Editor → paste `supabase-schema.sql` → Run.
3. **Get API keys:** Settings → API. Copy the Project URL and the `anon` public
   key into `config.js`.
4. **Enable email auth:** Authentication → Providers → Email → enabled.
5. **Enable Google auth (optional):**
   - In Google Cloud Console, create an OAuth 2.0 Client (Web application).
   - Authorized redirect URI: `https://YOUR-PROJECT.supabase.co/auth/v1/callback`.
   - Copy the Client ID + Secret into Supabase → Authentication → Providers → Google.
6. **Allowed redirect URLs:** Authentication → URL Configuration → add your site
   origin (e.g. `https://bingkunxie.github.io` and `http://localhost:4173`).

Accounts require the site to be served over http(s) (GitHub Pages or a local
server); the offline sequencer still works from `file://` without an account.
