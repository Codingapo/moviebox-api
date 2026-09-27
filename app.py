"""
MovieBox catalog API (Python / FastAPI)

Catalog-only proxy: home, search, trending, genre, filter, detail.
No video streaming, captions, or playback cookie logic.
Watch/embed links point at SUPAPLAY_PUBLIC_BASE (/mw/ and /jw/).
"""

from __future__ import annotations

import asyncio
import os
import re
import time
from datetime import datetime, timezone
from typing import Any, Optional
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

load_dotenv()

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

SUPAPLAY_PUBLIC_BASE = os.getenv("SUPAPLAY_PUBLIC_BASE", "https://supaplay.fun").rstrip("/")
MOVIEBOX_SITE = os.getenv("MOVIEBOX_SITE", "https://123movienow.cc").rstrip("/")
MOVIEBOX_DETAIL_API = os.getenv(
    "MOVIEBOX_DETAIL_API",
    "https://h5-api.aoneroom.com/wefeed-h5api-bff/detail",
)
SEARCH_API_DOMAIN = os.getenv("SEARCH_API_DOMAIN", "h5-api.aoneroom.com")
MOVIE_CHANNEL_ID = int(os.getenv("MOVIEWATCH_MOVIES_CHANNEL_ID", "1"))
TV_CHANNEL_ID = int(os.getenv("MOVIEWATCH_TV_CHANNEL_ID", "2"))
UPSTREAM_TIMEOUT = float(os.getenv("UPSTREAM_TIMEOUT", "20"))
DETAIL_TIMEOUT = float(os.getenv("DETAIL_TIMEOUT", "22"))
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

DEFAULT_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:152.0) "
    "Gecko/20100101 Firefox/152.0"
)

CANDIDATE_DOMAINS = [
    "movieboxhd.net",
    "moviebox.ph",
    "movie-box.tv",
    "moviebox.ac",
    "moviebox.biz",
    "moviebox.pk",
    "movieboxapp.in",
    "moviebox.id",
]

# Simple in-memory caches (process-local; fine for serverless cold starts)
_domain_cache: dict[str, Any] = {"domain": None, "expires": 0.0}
_genre_cache: dict[str, tuple[float, dict]] = {}
GENRE_CACHE_TTL = 60.0
DOMAIN_CACHE_TTL = 300.0

app = FastAPI(
    title="MovieBox Catalog API",
    description="Home, search, trending, genre, filter and detail endpoints. "
    "Embed URLs use Supaplay (no local video streaming).",
    version="1.0.0",
    default_response_class=ORJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS != ["*"] else ["*"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS", "HEAD"],
    allow_headers=["*"],
    expose_headers=["X-Cache", "X-Request-Id", "X-Upstream-Status"],
)


# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------

def _headers(
    *,
    origin: Optional[str] = None,
    referer: Optional[str] = None,
    extra: Optional[dict[str, str]] = None,
) -> dict[str, str]:
    h = {
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent": DEFAULT_UA,
        "Content-Type": "application/json",
    }
    if origin:
        h["Origin"] = origin
    if referer:
        h["Referer"] = referer
    if extra:
        h.update(extra)
    return h


async def _get_json(
    client: httpx.AsyncClient,
    url: str,
    *,
    headers: Optional[dict] = None,
    params: Optional[dict] = None,
    timeout: float = UPSTREAM_TIMEOUT,
) -> Any:
    r = await client.get(url, headers=headers or _headers(), params=params, timeout=timeout)
    r.raise_for_status()
    return r.json()


async def _post_json(
    client: httpx.AsyncClient,
    url: str,
    body: dict,
    *,
    headers: Optional[dict] = None,
    timeout: float = UPSTREAM_TIMEOUT,
) -> Any:
    r = await client.post(url, json=body, headers=headers or _headers(), timeout=timeout)
    r.raise_for_status()
    return r.json()


# ---------------------------------------------------------------------------
# Domain selection
# ---------------------------------------------------------------------------

async def get_working_domain(client: httpx.AsyncClient) -> str:
    now = time.time()
    if _domain_cache["domain"] and _domain_cache["expires"] > now:
        return _domain_cache["domain"]

    for domain in CANDIDATE_DOMAINS:
        try:
            url = f"https://{domain}/wefeed-h5-bff/web/home"
            r = await client.get(
                url,
                headers=_headers(origin=f"https://{domain}", referer=f"https://{domain}/"),
                timeout=8.0,
            )
            ct = r.headers.get("content-type", "")
            if r.status_code == 200 and "application/json" in ct:
                _domain_cache["domain"] = domain
                _domain_cache["expires"] = now + DOMAIN_CACHE_TTL
                return domain
        except Exception:
            continue

    # Fallback: still usable for some endpoints that hit aoneroom directly
    fallback = "moviebox.pk"
    _domain_cache["domain"] = fallback
    _domain_cache["expires"] = now + 60
    return fallback


# ---------------------------------------------------------------------------
# Normalizers / utils
# ---------------------------------------------------------------------------

def clean_int(value: Any, fallback: int = 0) -> int:
    try:
        n = int(float(value))
        return max(0, n)
    except (TypeError, ValueError):
        return fallback


def as_text(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    s = str(value).strip()
    return s or fallback


def slugify(value: str) -> str:
    s = as_text(value, "section").lower()
    s = s.replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "section"


def normalize_subject_type(subject_type: Any) -> str:
    t = clean_int(subject_type, -1)
    if t == 1:
        return "movie"
    if t == 2:
        return "series"
    if t == 3:
        return "anime"
    return "unknown"


def get_image_url(image: Any) -> str:
    if not image:
        return ""
    if isinstance(image, str):
        return image
    if isinstance(image, dict):
        return as_text(image.get("url"))
    return ""


def normalize_cover(cover: Any) -> dict:
    if not isinstance(cover, dict):
        return {
            "url": "",
            "width": None,
            "height": None,
            "thumbnail": "",
            "blurHash": "",
        }
    return {
        "url": as_text(cover.get("url")),
        "width": cover.get("width"),
        "height": cover.get("height"),
        "thumbnail": as_text(cover.get("thumbnail")),
        "blurHash": as_text(cover.get("blurHash")),
    }


def normalize_subject(item: dict) -> dict:
    subject_id = as_text(item.get("subjectId") or item.get("id") or item.get("subject_id"))
    subject_type = item.get("subjectType") if item.get("subjectType") is not None else item.get("type")
    genre_raw = item.get("genre") or ""
    genres = (
        [g.strip() for g in genre_raw.split(",") if g.strip()]
        if isinstance(genre_raw, str)
        else (item.get("genres") or [])
    )
    return {
        "subjectId": subject_id,
        "id": as_text(item.get("id") or subject_id),
        "subjectType": subject_type,
        "typeName": normalize_subject_type(subject_type),
        "title": as_text(item.get("title") or item.get("name"), "Untitled"),
        "originalTitle": as_text(item.get("originalTitle") or item.get("originTitle")),
        "description": as_text(item.get("description") or item.get("desc")),
        "detailPath": as_text(item.get("detailPath")),
        "releaseDate": as_text(item.get("releaseDate") or item.get("year")),
        "duration": clean_int(item.get("duration"), 0),
        "genre": as_text(genre_raw) if isinstance(genre_raw, str) else "",
        "genres": genres if isinstance(genres, list) else [],
        "countryName": as_text(item.get("countryName") or item.get("country")),
        "imdbRatingValue": item.get("imdbRatingValue") or item.get("rating"),
        "imdbRatingCount": clean_int(item.get("imdbRatingCount"), 0),
        "cover": normalize_cover(item.get("cover")),
        "hasResource": bool(item.get("hasResource")),
        "poster": get_image_url(item.get("cover")) or as_text(item.get("poster")),
    }


def extract_list(payload: Any) -> list:
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        return []
    for path in (
        ("data", "subjectList"),
        ("subjectList",),
        ("data", "results"),
        ("results",),
        ("data", "items"),
        ("items",),
        ("data",),
    ):
        cur: Any = payload
        ok = True
        for key in path:
            if not isinstance(cur, dict) or key not in cur:
                ok = False
                break
            cur = cur[key]
        if ok and isinstance(cur, list):
            return cur
    return []


def get_season_max_ep(season: dict) -> int:
    direct = clean_int(
        season.get("maxEp")
        or season.get("max_ep")
        or season.get("epNum")
        or season.get("episodeCount")
        or season.get("episodes"),
        0,
    )
    if direct > 0:
        return direct
    resolutions = season.get("resolutions") or []
    if isinstance(resolutions, list):
        return max((clean_int(r.get("epNum"), 0) for r in resolutions if isinstance(r, dict)), default=0)
    return 0


def normalize_dubs(dubs: Any) -> list[dict]:
    if not isinstance(dubs, list):
        return []
    out = []
    for dub in dubs:
        if not isinstance(dub, dict) or not dub.get("detailPath"):
            continue
        t = clean_int(dub.get("type"), -1)
        out.append(
            {
                "subjectId": as_text(dub.get("subjectId")),
                "lanName": as_text(dub.get("lanName")),
                "lanCode": as_text(dub.get("lanCode")),
                "original": bool(dub.get("original")),
                "type": t if t >= 0 else None,
                "typeLabel": "dub/audio" if t == 0 else "subtitles",
                "detailPath": as_text(dub.get("detailPath")),
            }
        )
    return out


def embed_urls(detail_path: str, season: int, episode: int) -> dict[str, str]:
    path = quote(detail_path, safe="")
    return {
        "hd-1": f"{SUPAPLAY_PUBLIC_BASE}/mw/{path}/{season}/{episode}",
        "hd-2": f"{SUPAPLAY_PUBLIC_BASE}/jw/{path}/{season}/{episode}",
    }


def movie_embed_url(detail_path: str) -> dict[str, str]:
    path = quote(detail_path, safe="")
    return {
        "hd-1": f"{SUPAPLAY_PUBLIC_BASE}/mw/{path}",
        "hd-2": f"{SUPAPLAY_PUBLIC_BASE}/jw/{path}",
    }


def build_watch_payload(payload: dict, requested_detail_path: str) -> dict:
    """
    Shape detail into the seasons / episodes / languages structure
    used by the frontend watch page.
    """
    subject = payload.get("subject") if isinstance(payload.get("subject"), dict) else payload
    resource = payload.get("resource") if isinstance(payload.get("resource"), dict) else {}
    if not resource and isinstance(subject.get("resource"), dict):
        resource = subject["resource"]

    selected_detail_path = as_text(
        subject.get("detailPath") or payload.get("detailPath") or requested_detail_path
    )
    subject_type = clean_int(subject.get("subjectType"), 0)
    is_movie = subject_type == 1

    title = as_text(subject.get("title"), "Untitled")
    description = as_text(subject.get("description"))
    release_date = as_text(subject.get("releaseDate"))
    year = release_date[:4] if re.match(r"^\d{4}", release_date) else ""
    genre_str = as_text(subject.get("genre"))
    genres = [g.strip() for g in genre_str.split(",") if g.strip()] if genre_str else []
    poster = get_image_url(subject.get("cover")) or get_image_url(subject.get("stills"))
    score = as_text(subject.get("imdbRatingValue") or subject.get("rating"))
    subject_id = as_text(subject.get("subjectId"))
    languages = normalize_dubs(subject.get("dubs"))

    now_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    base_anime = {
        "id": subject_id,
        "title": title,
        "alternative": title,
        "titles": title,
        "native": "",
        "slug": selected_detail_path,
        "poster": poster,
        "is_dub": 0,
        "is_sub": 0,
        "description": description,
        "aired": release_date,
        "season": "",
        "year": clean_int(year, 0) or None,
        "duration": as_text(subject.get("duration"), "0"),
        "status": "",
        "score": score,
        "rating": "",
        "mal_id": "",
        "ani_id": "",
        "genre": genres,
        "background_image": poster,
        "updated_at": now_iso,
        "next_air_schedule_time": None,
        "next_air_ep": None,
        "terms_by_type": {
            "genre": genres,
            "producers": [],
            "studios": [],
            "type": ["Movie"] if is_movie else ["TV"],
        },
    }

    if is_movie:
        embeds = movie_embed_url(selected_detail_path)
        return {
            "success": True,
            "type": "movie",
            "selected_detailPath": selected_detail_path,
            "subject": {
                "subjectId": subject_id,
                "subjectType": subject_type,
                "title": title,
                "description": description,
                "releaseDate": release_date,
                "duration": clean_int(subject.get("duration"), 0),
                "genre": genre_str,
                "countryName": as_text(subject.get("countryName")),
                "imdbRatingValue": subject.get("imdbRatingValue"),
                "cover": poster,
                "detailPath": selected_detail_path,
            },
            "languages": languages,
            "language_availability": {"sub_episodes": 0, "dub_episodes": 0},
            "seasons": [],
            "season_count": 0,
            "anime": {
                **base_anime,
                "episodes": "1",
                "total_episodes": 1,
            },
            "episodes": [
                {
                    "season": 0,
                    "episode_number": 1,
                    "title": title or "Movie",
                    "embed_url": embeds,
                    "updated_at": now_iso,
                }
            ],
            "embed_url": embeds,
        }

    seasons_raw = resource.get("seasons") if isinstance(resource.get("seasons"), list) else []
    seasons_summary: list[dict] = []
    episodes_list: list[dict] = []
    total_eps = 0

    for season in seasons_raw:
        if not isinstance(season, dict):
            continue
        season_number = clean_int(season.get("se") or season.get("season"), 1)
        max_ep = get_season_max_ep(season)
        if max_ep <= 0:
            continue
        seasons_summary.append({"season": season_number, "episodes": max_ep})
        total_eps += max_ep
        for ep in range(1, max_ep + 1):
            episodes_list.append(
                {
                    "season": season_number,
                    "episode_number": ep,
                    "title": f"Episode {ep}",
                    "embed_url": embed_urls(selected_detail_path, season_number, ep),
                    "updated_at": now_iso,
                }
            )

    seasons_summary.sort(key=lambda x: x["season"])
    episodes_list.sort(key=lambda x: (x["season"], x["episode_number"]))

    return {
        "success": True,
        "type": "series",
        "selected_detailPath": selected_detail_path,
        "subject": {
            "subjectId": subject_id,
            "subjectType": subject_type,
            "title": title,
            "description": description,
            "releaseDate": release_date,
            "duration": clean_int(subject.get("duration"), 0),
            "genre": genre_str,
            "countryName": as_text(subject.get("countryName")),
            "imdbRatingValue": subject.get("imdbRatingValue"),
            "cover": poster,
            "detailPath": selected_detail_path,
        },
        "seasons": seasons_summary,
        "season_count": len(seasons_summary),
        "language_availability": {"sub_episodes": 0, "dub_episodes": 0},
        "languages": languages,
        "anime": {
            **base_anime,
            "episodes": str(total_eps),
            "total_episodes": total_eps,
        },
        "episodes": episodes_list,
        "first_embed_url": episodes_list[0]["embed_url"] if episodes_list else {},
    }


# ---------------------------------------------------------------------------
# Search (Bearer token from suggest endpoint)
# ---------------------------------------------------------------------------

async def fetch_bearer_token(client: httpx.AsyncClient, domain: str) -> str:
    url = f"https://{SEARCH_API_DOMAIN}/wefeed-h5api-bff/subject/search-suggest"
    r = await client.post(
        url,
        json={"keyword": "avatar", "perPage": 0},
        headers=_headers(
            origin=f"https://{domain}",
            referer="https://moviebox.pk/",
            extra={"X-Client-Info": '{"timezone":"Africa/Johannesburg"}'},
        ),
        timeout=15.0,
    )
    r.raise_for_status()
    x_user = r.headers.get("x-user")
    if not x_user:
        raise RuntimeError("Missing x-user header for Bearer token")
    import json as _json

    data = _json.loads(x_user)
    token = data.get("token")
    if not token:
        raise RuntimeError("Failed to extract Bearer token")
    return token


async def search_video(
    client: httpx.AsyncClient,
    keyword: str,
    page: int = 1,
    per_page: int = 24,
    subject_type: int = 0,
) -> Any:
    domain = SEARCH_API_DOMAIN
    token = await fetch_bearer_token(client, domain)
    url = f"https://{domain}/wefeed-h5api-bff/subject/search"
    return await _post_json(
        client,
        url,
        {
            "keyword": keyword.strip(),
            "page": page,
            "perPage": per_page,
            "subjectType": subject_type,
        },
        headers=_headers(
            origin=f"https://{domain}",
            referer="https://moviebox.pk/",
            extra={
                "Authorization": f"Bearer {token}",
                "X-Client-Info": '{"timezone":"Africa/Johannesburg"}',
                "X-Request-Lang": "en",
            },
        ),
    )


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.get("/")
async def root():
    return {
        "success": True,
        "service": "moviebox-catalog-api",
        "docs": "/docs",
        "health": "/health",
        "endpoints": {
            "home_raw": "GET /crack/home",
            "home_clean": "GET /api/clean",
            "search": "POST /search  body: {keyword, page?, perPage?, subjectType?}",
            "trending": "GET /trending?page=&perPage=",
            "genre": "GET /genre/{genre}?page=&perPage=&type=all|movie|tv&country=&year=",
            "filter": "GET /get-tv-series?channelId=&page=&perPage=&genre=&country=&year=&classify=",
            "detail_by_id": "GET /detail/{subjectId}",
            "detail_rec": "GET /detailRec/{subjectId}?page=",
            "watch_detail": "GET /zdetail/{detailPath}  or  GET /watch/{detailPath}",
        },
    }


@app.get("/health")
async def health():
    return {
        "success": True,
        "service": "moviebox-catalog-api",
        "supaplay": SUPAPLAY_PUBLIC_BASE,
        "time": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


@app.post("/search")
async def search(request: Request):
    try:
        body = await request.json()
    except Exception:
        body = {}
    keyword = as_text((body or {}).get("keyword"))
    if not keyword:
        raise HTTPException(400, detail="Keyword is required")
    page = max(1, clean_int((body or {}).get("page"), 1))
    per_page = min(100, max(1, clean_int((body or {}).get("perPage"), 24)))
    subject_type = clean_int((body or {}).get("subjectType"), 0)

    async with httpx.AsyncClient() as client:
        try:
            data = await search_video(client, keyword, page, per_page, subject_type)
            return data
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to search movies: {e}") from e


@app.get("/crack/home")
async def crack_home():
    async with httpx.AsyncClient() as client:
        domain = await get_working_domain(client)
        url = f"https://{domain}/wefeed-h5-bff/web/home"
        try:
            data = await _get_json(
                client,
                url,
                headers=_headers(origin=f"https://{domain}", referer=f"https://{domain}/"),
            )
            return data
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to fetch home: {e}") from e


@app.get("/api/clean")
async def api_clean(raw: int = Query(0)):
    async with httpx.AsyncClient() as client:
        domain = await get_working_domain(client)
        url = f"https://{domain}/wefeed-h5-bff/web/home"
        try:
            data = await _get_json(
                client,
                url,
                headers=_headers(
                    origin=f"https://{domain}",
                    referer=f"https://{domain}/",
                    extra={"X-Forwarded-For": "127.0.0.1", "X-Real-IP": "127.0.0.1"},
                ),
            )
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to process clean home data: {e}") from e

    operating = []
    if isinstance(data, dict):
        operating = data.get("data", {}).get("operatingList") or []
        if not isinstance(operating, list):
            operating = []

    def get_subjects_from_operation(operation: dict) -> list:
        for key in ("subjects", "items", "list", "cards", "contents", "data"):
            lst = operation.get(key)
            if isinstance(lst, list):
                return lst
        return []

    def normalize_operation(operation: dict, index: int) -> dict:
        title = as_text(operation.get("title") or operation.get("name"), f"Section {index + 1}")
        subjects = [normalize_subject(s) for s in get_subjects_from_operation(operation) if isinstance(s, dict)]
        return {
            "key": slugify(title),
            "title": title,
            "type": as_text(operation.get("type")),
            "style": as_text(operation.get("style") or operation.get("showStyle")),
            "sort": clean_int(operation.get("sort"), index),
            "count": len(subjects),
            "subjects": subjects,
        }

    banner_section = next((o for o in operating if isinstance(o, dict) and o.get("type") == "BANNER"), None)
    filter_section = next((o for o in operating if isinstance(o, dict) and o.get("type") == "FILTER"), None)

    banners = []
    if banner_section and isinstance(banner_section.get("banner"), dict):
        items = banner_section["banner"].get("items") or []
        for item in items:
            if not isinstance(item, dict):
                continue
            sub = item.get("subject") if isinstance(item.get("subject"), dict) else item
            banners.append(
                {
                    "id": item.get("id") or sub.get("id") or sub.get("subjectId"),
                    "title": as_text(item.get("title") or sub.get("title")),
                    "description": as_text(item.get("description") or sub.get("description")),
                    "image": as_text(item.get("image")) or get_image_url(item.get("cover") or sub.get("cover")),
                    "cover": normalize_cover(item.get("cover") or sub.get("cover")),
                    "subject": normalize_subject(sub if isinstance(sub, dict) else {}),
                }
            )

    filters = []
    if filter_section and isinstance(filter_section.get("filters"), list):
        for f in filter_section["filters"]:
            if isinstance(f, dict):
                filters.append(
                    {
                        "id": f.get("id") or f.get("key") or f.get("value"),
                        "title": as_text(f.get("title") or f.get("name") or f.get("label")),
                        "value": as_text(f.get("value") or f.get("key")),
                        "type": as_text(f.get("type")),
                    }
                )

    home_sections = []
    for i, op in enumerate(operating):
        if not isinstance(op, dict):
            continue
        t = op.get("type") or ""
        if t in ("BANNER", "FILTER"):
            continue
        subjects = get_subjects_from_operation(op)
        if subjects:
            home_sections.append(normalize_operation(op, i))

    section_map: dict[str, dict] = {}
    for section in home_sections:
        key = section["key"]
        counter = 2
        while key in section_map:
            key = f"{section['key']}-{counter}"
            counter += 1
        section_map[key] = {
            "title": section["title"],
            "type": section["type"],
            "count": section["count"],
            "subjects": section["subjects"],
        }

    all_subjects_map: dict[str, dict] = {}
    for section in home_sections:
        for sub in section["subjects"]:
            uk = sub.get("subjectId") or sub.get("detailPath") or sub.get("title")
            if uk and uk not in all_subjects_map:
                all_subjects_map[uk] = sub
    all_subjects = list(all_subjects_map.values())

    keyword_buckets = {
        "saDrama": ["sa-drama", "south african", "south africa"],
        "western": ["western"],
        "anime": ["anime", "animation"],
        "trending": ["trending", "hot", "popular"],
        "hollywood": ["hollywood"],
        "bollywood": ["bollywood", "india", "indian"],
        "teenRomance": ["teen romance", "t-romance"],
        "nollywood": ["nollywood", "nigeria", "nigerian"],
        "kDrama": ["k-drama", "korean drama", "korea"],
        "cDrama": ["c-drama", "chinese drama", "china"],
        "thaiDrama": ["thai-drama", "thai drama", "thailand"],
        "action": ["action"],
        "comedy": ["comedy"],
        "horror": ["horror"],
        "romance": ["romance"],
        "latest": ["latest", "new", "recent"],
        "topRated": ["top rated", "imdb", "rating"],
    }
    buckets: dict[str, list] = {}
    for bucket_key, keywords in keyword_buckets.items():
        items = []
        for section in home_sections:
            title_l = section["title"].lower()
            if any(k in title_l for k in keywords):
                items.extend(section["subjects"])
        unique: dict[str, dict] = {}
        for item in items:
            k = item.get("subjectId") or item.get("detailPath") or item.get("title")
            if k and k not in unique:
                unique[k] = item
        if unique:
            buckets[bucket_key] = list(unique.values())

    movies = [s for s in all_subjects if s.get("typeName") == "movie"]
    series = [s for s in all_subjects if s.get("typeName") == "series"]
    anime = [
        s
        for s in all_subjects
        if s.get("typeName") == "anime"
        or "anime" in f"{s.get('title','')} {s.get('genre','')} {s.get('description','')}".lower()
    ]

    result = {
        "success": True,
        "source": {"domain": domain, "endpoint": "/wefeed-h5-bff/web/home"},
        "meta": {
            "operatingCount": len(operating),
            "bannerCount": len(banners),
            "filterCount": len(filters),
            "sectionCount": len(home_sections),
            "subjectCount": len(all_subjects),
            "movieCount": len(movies),
            "seriesCount": len(series),
            "animeCount": len(anime),
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        },
        "banner": banners,
        "categories": filters,
        "homeSections": home_sections,
        "sectionMap": section_map,
        "sections": buckets,
        "allSubjects": all_subjects,
        "movies": movies,
        "series": series,
        "anime": anime,
    }
    if raw == 1:
        result["raw"] = data
    return result


@app.get("/trending")
async def trending(
    page: int = Query(1, ge=1),
    perPage: int = Query(18, ge=1, le=100),
):
    async with httpx.AsyncClient() as client:
        domain = await get_working_domain(client)
        url = (
            f"https://{domain}/wefeed-h5-bff/web/subject/trending"
            f"?uid=5089247895077929680&page={page}&perPage={perPage}"
        )
        try:
            json_data = await _get_json(
                client,
                url,
                headers=_headers(origin=f"https://{domain}", referer=f"https://{domain}/"),
            )
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to fetch trending: {e}") from e

    if isinstance(json_data, dict) and json_data.get("code") not in (None, 0):
        raise HTTPException(502, detail=f"MovieBox API error: {json_data.get('message')}")

    subject_list = []
    if isinstance(json_data, dict):
        subject_list = json_data.get("data", {}).get("subjectList") or []
        if not isinstance(subject_list, list):
            subject_list = []

    movies = []
    for movie in subject_list:
        if not isinstance(movie, dict):
            continue
        detail_path = as_text(movie.get("detailPath"))
        subject_id = as_text(movie.get("subjectId"))
        movies.append(
            {
                "title": as_text(movie.get("title")),
                "releaseDate": movie.get("releaseDate"),
                "genre": as_text(movie.get("genre")),
                "subjectId": subject_id or None,
                "subjectType": movie.get("subjectType"),
                "detailPath": detail_path,
                "country": as_text(movie.get("countryName")),
                "rating": movie.get("imdbRatingValue"),
                "poster": get_image_url(movie.get("cover")),
                "link": f"/zdetail/{quote(detail_path, safe='')}" if detail_path else "",
            }
        )
    return movies


ALIASES = {
    "sci-fi": "Sci-Fi",
    "science-fiction": "Sci-Fi",
    "reality-tv": "Reality-TV",
    "tv-movie": "TV Movie",
    "film-noir": "Film-Noir",
}


def display_genre(slug: str) -> str:
    if slug in ALIASES:
        return ALIASES[slug]
    return " ".join(w.capitalize() for w in slug.split("-") if w)


def parse_type(value: Optional[str]) -> str:
    t = as_text(value, "all").lower()
    if t in ("1", "movie", "movies", "film"):
        return "movie"
    if t in ("2", "tv", "series", "show", "shows", "tv-series"):
        return "tv"
    return "all"


async def fetch_channel(
    client: httpx.AsyncClient,
    domain: str,
    channel_id: int,
    subject_type: int,
    genre: str,
    page: int,
    per_page: int,
    country: str,
    year: str,
    classify: str,
) -> dict:
    url = f"https://{domain}/wefeed-h5-bff/web/filter"
    last_error: Optional[Exception] = None
    for attempt in range(2):
        try:
            payload = await _post_json(
                client,
                url,
                {
                    "page": page,
                    "perPage": per_page,
                    "channelId": channel_id,
                    "genre": genre,
                    "country": country,
                    "year": year,
                    "classify": classify,
                },
                headers=_headers(origin=f"https://{domain}", referer=f"https://{domain}/"),
            )
            if isinstance(payload, dict) and payload.get("code") not in (None, 0):
                raise RuntimeError(as_text(payload.get("message"), "MovieBox API error"))

            raw_list = extract_list(payload)
            seen = set()
            items = []
            for raw_item in raw_list:
                item = raw_item.get("subject") if isinstance(raw_item, dict) and isinstance(raw_item.get("subject"), dict) else raw_item
                if not isinstance(item, dict):
                    continue
                subject_id = as_text(item.get("subjectId") or (raw_item or {}).get("subjectId") if isinstance(raw_item, dict) else "")
                detail_path = as_text(item.get("detailPath") or (raw_item or {}).get("detailPath") if isinstance(raw_item, dict) else "")
                if not subject_id or not detail_path:
                    continue
                st = clean_int(item.get("subjectType") or (raw_item or {}).get("subjectType") if isinstance(raw_item, dict) else 0, subject_type)
                if st > 0 and st != subject_type:
                    continue
                key = subject_id or detail_path
                if key in seen:
                    continue
                seen.add(key)
                release = as_text(item.get("releaseDate") or (raw_item or {}).get("releaseDate") if isinstance(raw_item, dict) else "")
                rating_n = item.get("imdbRatingValue") or item.get("rating") or (raw_item or {}).get("rating") if isinstance(raw_item, dict) else None
                try:
                    rating = float(rating_n) if rating_n is not None else None
                except (TypeError, ValueError):
                    rating = None
                items.append(
                    {
                        "title": as_text(item.get("title") or (raw_item or {}).get("title") if isinstance(raw_item, dict) else "", "Untitled"),
                        "releaseDate": release or None,
                        "year": release[:4] if re.match(r"^\d{4}", release) else None,
                        "genre": as_text(item.get("genre")),
                        "subjectId": subject_id,
                        "subjectType": st,
                        "type": "movie" if st == 1 else "tv" if st == 2 else "unknown",
                        "detailPath": detail_path,
                        "country": as_text(item.get("countryName") or item.get("country")),
                        "rating": rating,
                        "poster": get_image_url(item.get("cover")) or as_text(item.get("poster")),
                        "description": as_text(item.get("description") or item.get("overview")),
                        "link": f"/zdetail/{quote(detail_path, safe='')}",
                    }
                )
            return {"items": items, "hasMore": len(raw_list) >= per_page}
        except Exception as e:
            last_error = e
            if attempt == 0:
                await asyncio.sleep(0.4)
    raise last_error or RuntimeError("MovieBox genre request failed")


@app.get("/genre/{genre}")
async def genre_endpoint(
    genre: str,
    page: int = Query(1, ge=1),
    perPage: int = Query(24, ge=1, le=100),
    type: Optional[str] = Query(None, alias="type"),
    subjectType: Optional[str] = Query(None),
    country: str = Query("All"),
    year: str = Query("All"),
    classify: str = Query("All"),
):
    genre_slug = re.sub(r"[^a-z0-9-]+", "-", genre.lower()).strip("-")
    if not genre_slug:
        raise HTTPException(400, detail="A valid genre is required")

    media_type = parse_type(type or subjectType)
    genre_label = display_genre(genre_slug)

    async with httpx.AsyncClient() as client:
        domain = await get_working_domain(client)

        cache_key = f"{domain}|{genre_slug}|{page}|{perPage}|{media_type}|{country}|{year}|{classify}"
        cached = _genre_cache.get(cache_key)
        if cached and cached[0] > time.time():
            payload = dict(cached[1])
            payload["requestId"] = f"cache-{int(time.time())}"
            return ORJSONResponse(payload, headers={"X-Cache": "HIT"})

        jobs = []
        if media_type in ("all", "movie"):
            jobs.append(
                fetch_channel(
                    client, domain, MOVIE_CHANNEL_ID, 1, genre_label, page, perPage, country, year, classify
                )
            )
        if media_type in ("all", "tv"):
            jobs.append(
                fetch_channel(
                    client, domain, TV_CHANNEL_ID, 2, genre_label, page, perPage, country, year, classify
                )
            )

        results = await asyncio.gather(*jobs, return_exceptions=True)
        successful = [r for r in results if not isinstance(r, Exception)]
        if not successful:
            err = next((r for r in results if isinstance(r, Exception)), None)
            raise HTTPException(502, detail=f"Failed to fetch titles for this genre: {err}")

        merged = []
        seen = set()
        for result in successful:
            for item in result["items"]:
                key = item.get("subjectId") or item.get("detailPath")
                if key in seen:
                    continue
                seen.add(key)
                merged.append(item)

        merged.sort(
            key=lambda x: (
                as_text(x.get("releaseDate"), ""),
                float(x.get("rating") or 0),
            ),
            reverse=True,
        )

        data = merged[:perPage] if media_type == "all" else merged
        has_more = any(r.get("hasMore") for r in successful)

        payload = {
            "success": True,
            "data": data,
            "pagination": {
                "page": page,
                "perPage": perPage,
                "count": len(data),
                "total": None,
                "hasMore": has_more,
                "nextPage": page + 1 if has_more else None,
                "previousPage": page - 1 if page > 1 else None,
            },
            "filters": {
                "genre": genre_label,
                "genreSlug": genre_slug,
                "type": media_type,
                "subjectType": 1 if media_type == "movie" else 2 if media_type == "tv" else 0,
                "country": country,
                "year": year,
                "classify": classify,
            },
            "source": {
                "provider": "MovieBox",
                "domain": domain,
                "movieChannelId": MOVIE_CHANNEL_ID,
                "tvChannelId": TV_CHANNEL_ID,
                "fetchedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            },
            "requestId": f"{int(time.time())}",
        }
        _genre_cache[cache_key] = (time.time() + GENRE_CACHE_TTL, payload)
        if len(_genre_cache) > 200:
            oldest = next(iter(_genre_cache))
            _genre_cache.pop(oldest, None)

        return ORJSONResponse(payload, headers={"X-Cache": "MISS", "Cache-Control": "public, max-age=30"})


@app.get("/get-tv-series")
async def get_tv_series(
    channelId: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    perPage: int = Query(24, ge=1, le=100),
    genre: str = Query("All"),
    country: str = Query("All"),
    year: str = Query("All"),
    classify: str = Query("All"),
):
    if not channelId:
        raise HTTPException(400, detail="channelId is required")
    try:
        numeric_channel = int(channelId)
    except ValueError as e:
        raise HTTPException(400, detail="channelId must be a number") from e

    body = {
        "page": page,
        "perPage": perPage,
        "channelId": numeric_channel,
        "genre": genre or "All",
        "country": country or "All",
        "year": year or "All",
        "classify": classify or "All",
    }
    async with httpx.AsyncClient() as client:
        try:
            data = await _post_json(
                client,
                "https://h5-api.aoneroom.com/wefeed-h5api-bff/subject/filter",
                body,
                headers=_headers(origin="https://movieboxhd.net", referer="https://movieboxhd.net/"),
            )
            return data
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to fetch filtered movies: {e}") from e


@app.get("/detailRec/{subjectId}")
async def detail_rec(subjectId: str, page: int = Query(1, ge=1), perPage: int = Query(16, ge=1, le=50)):
    async with httpx.AsyncClient() as client:
        domain = await get_working_domain(client)
        url = (
            f"https://{domain}/wefeed-h5-bff/web/subject/detail-rec"
            f"?subjectId={quote(subjectId)}&page={page}&perPage={perPage}"
        )
        try:
            json_data = await _get_json(
                client,
                url,
                headers=_headers(origin=f"https://{domain}", referer=f"https://{domain}/"),
            )
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to fetch recommendations: {e}") from e

    if isinstance(json_data, dict) and json_data.get("code") not in (None, 0):
        return {"subjectId": subjectId, "page": page, "results": []}
    items = []
    if isinstance(json_data, dict):
        items = json_data.get("data", {}).get("items") or []
        if not isinstance(items, list):
            items = []
    return {"subjectId": subjectId, "page": page, "results": items}


@app.get("/detail/{subjectId}")
async def detail_by_id(subjectId: str):
    async with httpx.AsyncClient() as client:
        domain = await get_working_domain(client)
        url = f"https://{domain}/wefeed-h5-bff/web/subject/detail?subjectId={quote(subjectId)}"
        try:
            json_data = await _get_json(
                client,
                url,
                headers=_headers(
                    origin=f"https://{domain}",
                    referer=f"https://{domain}/",
                    extra={
                        "X-Forwarded-For": "127.0.0.1",
                        "X-Real-IP": "127.0.0.1",
                        "Client-IP": "127.0.0.1",
                    },
                ),
            )
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to fetch movie details: {e}") from e

    if isinstance(json_data, dict) and json_data.get("code") not in (None, 0):
        raise HTTPException(502, detail=f"MovieBox API error: {json_data.get('message')}")
    return json_data.get("data") if isinstance(json_data, dict) else json_data


async def _fetch_detail_by_path(detail_path: str) -> dict:
    detail_path = as_text(detail_path)
    if not detail_path:
        raise HTTPException(400, detail="detailPath is required")

    upstream = f"{MOVIEBOX_DETAIL_API}?detailPath={quote(detail_path)}"
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get(
                upstream,
                headers=_headers(origin="https://h5.aoneroom.com", referer="https://h5.aoneroom.com/"),
                timeout=DETAIL_TIMEOUT,
            )
            if r.status_code >= 400:
                raise HTTPException(
                    r.status_code,
                    detail=f"Upstream error: {r.status_code} {r.reason_phrase}",
                )
            json_data = r.json()
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(500, detail=f"Failed to fetch movie details: {e}") from e

    if isinstance(json_data, dict) and "code" in json_data and clean_int(json_data.get("code"), -1) != 0:
        raise HTTPException(502, detail=f"MovieBox API error: {json_data.get('message') or 'Unknown error'}")

    payload = json_data.get("data") if isinstance(json_data, dict) else json_data
    if not isinstance(payload, dict):
        payload = {}
    return build_watch_payload(payload, detail_path)


@app.get("/zdetail/{detailPath:path}")
async def zdetail(detailPath: str):
    return await _fetch_detail_by_path(detailPath)


@app.get("/watch/{detailPath:path}")
async def watch_detail(detailPath: str):
    """Alias for zdetail — returns seasons, episodes, languages, embed_url (hd-1 / hd-2)."""
    return await _fetch_detail_by_path(detailPath)


# Vercel / ASGI entry
# uvicorn app:app --host 0.0.0.0 --port 8000
