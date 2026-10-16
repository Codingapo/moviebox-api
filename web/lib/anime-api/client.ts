import { homeSchema, seriesSchema, type RawAnimeCard } from "./schemas";
import type { AnimeCard, GenrePayload, HomePayload, SeriesPayload } from "./types";

const ANIME_BASE = process.env.NEXT_PUBLIC_ANIME_API_BASE || "https://anime.supaplay.fun";
const MOVIE_BASE = process.env.NEXT_PUBLIC_MOVIE_API_BASE || "https://movie.supaplay.fun";

function slugFromUrl(url?: string, fallback = "") {
  if (!url) return fallback;
  const clean = url.split("?")[0].replace(/\/$/, "");
  return clean.split("/").pop() || fallback;
}

function mapCard(x: RawAnimeCard): AnimeCard {
  return {
    id: x.id,
    dataId: x.data_id,
    slug: slugFromUrl(x.url, x.id),
    title: x.title,
    jname: x.jname,
    poster: x.poster,
    showType: x.tvInfo?.showType,
    sub: x.tvInfo?.sub,
    dub: x.tvInfo?.dub,
    episodes: x.tvInfo?.eps,
    adultContent: x.adultContent,
  };
}

async function apiFetch(url: string, revalidate = 300) {
  const res = await fetch(url, {
    next: { revalidate },
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Upstream request failed: ${res.status}`);
  return res.json();
}

export async function getHome(): Promise<HomePayload> {
  const raw = homeSchema.parse(await apiFetch(`${ANIME_BASE}/api/home`, 180));
  const normalizeNav = (v: unknown) => {
    if (typeof v === "string") return { name: v, slug: v.toLowerCase().replace(/\s+/g, "-") };
    const x = v as Record<string, unknown>;
    const name = String(x?.name ?? x?.title ?? x?.label ?? "");
    const slug = String(x?.slug ?? x?.id ?? name.toLowerCase().replace(/\s+/g, "-"));
    return { name, slug };
  };
  return {
    meta: raw.meta as HomePayload["meta"],
    navigation: {
      genres: raw.navigation.genres.map(normalizeNav).filter(x => x.name),
      types: raw.navigation.types.map(normalizeNav).filter(x => x.name),
    },
    sections: {
      hotest: raw.sections.hotest.map(mapCard),
      latestEpisode: raw.sections.latestEpisode.map(mapCard),
      upcomingAnime: raw.sections.upcomingAnime.map(mapCard),
    },
  };
}

export async function getGenre(slug: string, page = 1): Promise<GenrePayload> {
  const raw = await apiFetch(`${ANIME_BASE}/api/genre/${encodeURIComponent(slug)}?page=${page}`, 180);
  const list = Array.isArray(raw) ? raw : raw?.data ?? raw?.results ?? raw?.items ?? raw?.animes ?? [];
  return {
    items: Array.isArray(list) ? list.map((x) => mapCard(x as RawAnimeCard)) : [],
    page,
    hasNextPage: Boolean(raw?.hasNextPage ?? raw?.has_next_page ?? raw?.pagination?.hasNextPage),
  };
}

export async function getSeries(slug: string): Promise<SeriesPayload> {
  const x = seriesSchema.parse(await apiFetch(`${ANIME_BASE}/api/series/${encodeURIComponent(slug)}`, 180));
  return {
    slug: x.slug ?? slug,
    seriesId: x.series_id == null ? undefined : String(x.series_id),
    title: x.title ?? "Untitled",
    native: x.native,
    poster: x.poster,
    description: x.description,
    score: x.score,
    malId: x.mal_id,
    aniId: x.ani_id,
    backgroundImage: x.background_image,
    status: x.status,
    year: x.year,
    duration: x.duration,
    languageAvailability: {
      subEpisodes: x.language_availability.sub_episodes,
      dubEpisodes: x.language_availability.dub_episodes,
    },
  };
}

export async function getMovieHome() {
  return apiFetch(`${MOVIE_BASE}/api/clean`, 300);
}

export async function getJapaneseAnimation(page = 1, perPage = 12) {
  const q = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    channelId: "1",
    genre: "Animation",
    country: "Japan",
    year: "All",
    classify: "All",
  });
  return apiFetch(`${MOVIE_BASE}/get-tv-series?${q.toString()}`, 300);
}
