# AnimeVerse Web

Next.js 15 frontend for the existing MovieBox/SupaPlay catalog API.

## Local setup

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

Set:

```env
NEXT_PUBLIC_ANIME_API_BASE=https://anime.supaplay.fun
NEXT_PUBLIC_MOVIE_API_BASE=https://movie.supaplay.fun
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Vercel

Create a Vercel project from this GitHub repository and set **Root Directory** to `web`. Add the same environment variables in Vercel.

## Supabase

Run the SQL in `supabase/migrations/001_animeverse.sql` in a dedicated Supabase project. The schema enables RLS and owner-scoped policies for user data. Do not expose a service-role/secret key in the browser.

## Data sources

Anime:
- `https://anime.supaplay.fun/api/home`
- `https://anime.supaplay.fun/api/genre/{slug}?page=N`
- `https://anime.supaplay.fun/api/series/{slug}`

Movie/TV:
- `https://movie.supaplay.fun/api/clean`
- `https://movie.supaplay.fun/get-tv-series`

Existing FastAPI backend in repository root remains intact.

## Current build

Implemented:
- Next.js/Tailwind scaffold
- typed anime API client + Zod validation
- cinematic R3F energy hero
- real home data
- genre pages
- series details
- AniList SupaPlay watch route
- Supabase SSR client scaffolding
- login/register UI
- RLS migration starter

Next:
- comments/replies/likes
- favorites, continue watching, custom lists
- movie API merge
- R2 adapter/caching
- full power-level/Ultra Instinct interactions
- Vercel deployment and production QA
