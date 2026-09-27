# MovieBox Catalog API (Python)

FastAPI catalog proxy for MovieBox-style metadata: **home**, **search**, **trending**, **genre**, **filter**, and **detail/watch**.

There is **no local video streaming**. Playback links are embed URLs on Supaplay:

- `hd-1` → `https://supaplay.fun/mw/{detailPath}/...`
- `hd-2` → `https://supaplay.fun/jw/{detailPath}/...`

Stripped from the original Node server:

- `/fetchVideo`, `/fetchCaptions`, `/streamVideo`, `/subtitle`
- Session / account cookie handling for playback
- SSRF-safe video proxy

---

## Features

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service index + endpoint list |
| `/health` | GET | Health check |
| `/api/clean` | GET | Normalized home (banners, sections, buckets) |
| `/crack/home` | GET | Raw upstream home JSON |
| `/search` | POST | Search by keyword |
| `/trending` | GET | Trending titles |
| `/genre/{genre}` | GET | Genre browse (movies + TV) |
| `/get-tv-series` | GET | Filter by channel / genre / year / country |
| `/detail/{subjectId}` | GET | Raw subject detail by ID |
| `/detailRec/{subjectId}` | GET | Recommendations |
| `/zdetail/{detailPath}` | GET | **Watch payload** (seasons, episodes, embeds) |
| `/watch/{detailPath}` | GET | Alias of `/zdetail` |

Interactive docs: `/docs` (Swagger) and `/redoc`.

---

## Watch / detail response shape

`GET /zdetail/{detailPath}` or `GET /watch/{detailPath}` returns a structure suitable for a watch page:

```json
{
  "success": true,
  "type": "series",
  "selected_detailPath": "rick-and-morty-aPze2KlOcN2",
  "seasons": [
    { "season": 1, "episodes": 11 },
    { "season": 2, "episodes": 10 }
  ],
  "season_count": 2,
  "language_availability": { "sub_episodes": 0, "dub_episodes": 0 },
  "languages": [
    {
      "subjectId": "...",
      "lanName": "Original Audio",
      "lanCode": "en",
      "original": true,
      "type": 0,
      "detailPath": "rick-and-morty-aPze2KlOcN2"
    }
  ],
  "anime": {
    "id": "...",
    "title": "...",
    "slug": "rick-and-morty-aPze2KlOcN2",
    "poster": "https://...",
    "description": "...",
    "genre": ["Animation", "Comedy"],
    "total_episodes": 21,
    "score": "9.0"
  },
  "episodes": [
    {
      "season": 1,
      "episode_number": 1,
      "title": "Episode 1",
      "embed_url": {
        "hd-1": "https://supaplay.fun/mw/rick-and-morty-aPze2KlOcN2/1/1",
        "hd-2": "https://supaplay.fun/jw/rick-and-morty-aPze2KlOcN2/1/1"
      },
      "updated_at": "2026-09-27T13:17:41.347Z"
    }
  ]
}
```

Movies get a single episode entry with season `0` and movie-level `embed_url`.

Fields like `jp_title` and local `/watch/...` path strings are **not** included; only `embed_url.hd-1` / `hd-2` are used for playback.

---

## Local development

### Requirements

- Python 3.10+
- `pip`

### Setup

```bash
git clone <your-repo-url>
cd moviebox-api

python -m venv .venv
# Windows: .venv\Scripts\activate
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env   # optional; edit if needed
```

### Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8000 --reload
```

Open:

- API: http://localhost:8000  
- Docs: http://localhost:8000/docs  
- Health: http://localhost:8000/health  

### Quick examples

```bash
# Clean home
curl -s http://localhost:8000/api/clean | head -c 400

# Search
curl -s -X POST http://localhost:8000/search \
  -H "Content-Type: application/json" \
  -d '{"keyword":"avatar","page":1,"perPage":12}'

# Trending
curl -s "http://localhost:8000/trending?page=1&perPage=10"

# Genre
curl -s "http://localhost:8000/genre/action?type=movie&page=1&perPage=12"

# Watch detail (series or movie)
curl -s "http://localhost:8000/zdetail/rick-and-morty-aPze2KlOcN2"
```

---

## Environment variables

See `.env.example`. All are optional.

| Variable | Default | Purpose |
|----------|---------|---------|
| `SUPAPLAY_PUBLIC_BASE` | `https://supaplay.fun` | Base for embed links |
| `MOVIEBOX_DETAIL_API` | aoneroom detail URL | Detail by `detailPath` |
| `SEARCH_API_DOMAIN` | `h5-api.aoneroom.com` | Search + token |
| `MOVIEWATCH_MOVIES_CHANNEL_ID` | `1` | Genre filter (movies) |
| `MOVIEWATCH_TV_CHANNEL_ID` | `2` | Genre filter (TV) |
| `UPSTREAM_TIMEOUT` | `20` | HTTP timeout (seconds) |
| `DETAIL_TIMEOUT` | `22` | Detail timeout |
| `CORS_ORIGINS` | `*` | Comma-separated origins |

---

## Deploy on Render

1. Push this repo to GitHub.
2. [Render](https://render.com) → **New** → **Web Service** → connect the repo.
3. Settings:
   - **Runtime**: Python
   - **Build command**: `pip install -r requirements.txt`
   - **Start command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
4. Optional: set env vars from the table above.
5. Deploy. Health check path: `/health`.

You can also use the included `render.yaml` (Blueprint):

```bash
# In Render dashboard: New → Blueprint → select this repo
```

---

## Deploy on Vercel

1. Install [Vercel CLI](https://vercel.com/docs/cli) or use the dashboard.
2. From the project root:

```bash
npm i -g vercel   # if needed
vercel
```

3. `vercel.json` routes all traffic to `app.py` via `@vercel/python`.
4. Set any env vars in the Vercel project settings.
5. After deploy, open `https://<project>.vercel.app/health`.

**Note:** Vercel serverless has a max duration on the free plan. Catalog calls are short; if you hit limits, raise the function timeout in the project settings or use Render for longer upstream waits.

---

## Project layout

```
moviebox-api/
├── app.py              # FastAPI application (all routes)
├── requirements.txt
├── Procfile            # Render / Heroku-style process
├── render.yaml         # Render Blueprint
├── vercel.json         # Vercel routing
├── .env.example
├── .gitignore
└── README.md
```

---

## Notes

- Domain discovery tries several MovieBox mirror hosts and caches a working one for a few minutes.
- Genre responses are cached in-process for ~60s.
- Upstream APIs can change; if search or home fails, check domain / headers and update env vars.
- This service only exposes **metadata and embed URLs**. Actual video delivery is handled by Supaplay (or whatever you set in `SUPAPLAY_PUBLIC_BASE`).

---

## License

Use at your own risk. Respect the terms of any upstream content providers and local copyright law.
