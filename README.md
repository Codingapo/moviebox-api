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

Interactive docs:

- `/docs` — Swagger UI
- `/redoc` — ReDoc

---

# Watch / detail response shape

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
  "language_availability": {
    "sub_episodes": 0,
    "dub_episodes": 0
  },
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
