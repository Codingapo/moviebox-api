import { cardSchema, homeSchema, type RawAnimeCard } from "./schemas";
import type { AnimeCard, GenrePayload, HomePayload, SeriesPayload } from "./types";

const ANIME_BASE = process.env.NEXT_PUBLIC_ANIME_API_BASE || "https://anime.supaplay.fun";
const MOVIE_BASE = process.env.NEXT_PUBLIC_MOVIE_API_BASE || "https://movie.supaplay.fun";

const RESTRICTED_GENRES = new Set(["hentai", "erotica", "ecchi", "adult"]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function slugFromUrl(url?: string | null, fallback = "") {
  if (!url) return fallback;
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!parts.length) return fallback;
    const last = parts.at(-1) || fallback;
    if (/^(?:ep|episode)-?\d+$/i.test(last) && parts.length > 1) {
      return parts.at(-2) || fallback;
    }
    return last;
  } catch {
    const clean = url.split("?")[0].replace(/\/$/, "");
    const parts = clean.split("/").filter(Boolean);
    const last = parts.at(-1) || fallback;
    if (/^(?:ep|episode)-?\d+$/i.test(last) && parts.length > 1) {
      return parts.at(-2) || fallback;
    }
    return last;
  }
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isRestrictedText(...values: Array<unknown>) {
  const text = values
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
  return /(^|[^a-z])(hentai|erotica|ecchi)([^a-z]|$)/i.test(text);
}

function mapCard(input: RawAnimeCard | Record<string, unknown>): AnimeCard {
  const x = input as RawAnimeCard & Record<string, any>;
  const title = String(x.title || "Untitled");
  const fallbackId = x.id ?? x.data_id;
  const slug = String(
    x.slug ||
      slugFromUrl(x.url, fallbackId == null ? slugify(title) : String(fallbackId)) ||
      slugify(title)
  );
  const rawEpisodes = x.episodes;
  const episodeObject =
    rawEpisodes && typeof rawEpisodes === "object" && !Array.isArray(rawEpisodes)
      ? rawEpisodes as Record<string, unknown>
      : undefined;

  const sub = toNumber(x.tvInfo?.sub ?? episodeObject?.sub);
  const dub = toNumber(x.tvInfo?.dub ?? episodeObject?.dub);
  const episodes =
    toNumber(x.tvInfo?.eps ?? episodeObject?.total) ??
    (typeof rawEpisodes === "string" || typeof rawEpisodes === "number"
      ? toNumber(rawEpisodes)
      : undefined);

  return {
    id: String(fallbackId ?? slug),
    dataId: x.data_id == null ? undefined : String(x.data_id),
    slug,
    title,
    jname: x.jname ?? x.japaneseTitle ?? undefined,
    poster: x.poster ?? x.image ?? undefined,
    showType: x.tvInfo?.showType ?? x.type ?? undefined,
    sub,
    dub,
    episodes,
    adultContent:
      Boolean(x.adultContent ?? x.isAdult) ||
      isRestrictedText(title, x.jname, x.japaneseTitle, x.url),
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

function normalizeNav(value: unknown) {
  if (typeof value === "string") {
    return { name: value, slug: slugify(value) };
  }

  const x = (value || {}) as Record<string, unknown>;
  const name = String(x.name ?? x.title ?? x.label ?? "");
  const url = typeof x.url === "string" ? x.url : undefined;
  const slug = String(
    x.slug ??
      (url ? slugFromUrl(url, "") : "") ??
      x.id ??
      slugify(name)
  ) || slugify(name);

  return { name, slug };
}

function allowedNavigationItem(item: { name: string; slug: string }) {
  const name = item.name.toLowerCase().trim();
  const slug = item.slug.toLowerCase().trim();
  return Boolean(item.name) && !RESTRICTED_GENRES.has(name) && !RESTRICTED_GENRES.has(slug);
}

export async function getHome(): Promise<HomePayload> {
  const raw = homeSchema.parse(await apiFetch(`${ANIME_BASE}/api/home`, 180));

  const hotest = raw.sections.hotest.map(mapCard).filter((x) => !x.adultContent);
  const latestEpisode = raw.sections.latestEpisode.map(mapCard).filter((x) => !x.adultContent);
  const upcomingAnime = raw.sections.upcomingAnime.map(mapCard).filter((x) => !x.adultContent);

  return {
    meta: raw.meta as HomePayload["meta"],
    navigation: {
      genres: raw.navigation.genres.map(normalizeNav).filter(allowedNavigationItem),
      types: raw.navigation.types.map(normalizeNav).filter(allowedNavigationItem),
    },
    sections: {
      hotest,
      latestEpisode,
      upcomingAnime,
    },
  };
}

export async function getGenre(slug: string, page = 1): Promise<GenrePayload> {
  if (RESTRICTED_GENRES.has(slug.toLowerCase())) {
    return { items: [], page, hasNextPage: false };
  }

  const raw = await apiFetch(`${ANIME_BASE}/api/genre/${encodeURIComponent(slug)}?page=${page}`, 180);
  const results = raw?.results;
  const list =
    Array.isArray(raw) ? raw :
    Array.isArray(raw?.data) ? raw.data :
    Array.isArray(results) ? results :
    Array.isArray(results?.data) ? results.data :
    Array.isArray(raw?.items) ? raw.items :
    Array.isArray(raw?.animes) ? raw.animes :
    [];

  const currentPage = Number(results?.currentPage ?? raw?.currentPage ?? page) || page;
  const totalPages = Number(results?.totalPages ?? raw?.totalPages ?? currentPage) || currentPage;

  const items = list
    .map((x: unknown) => cardSchema.parse(x))
    .map(mapCard)
    .filter((x: AnimeCard) => !x.adultContent);

  return {
    items,
    page: currentPage,
    hasNextPage: Boolean(
      raw?.hasNextPage ??
      raw?.has_next_page ??
      raw?.pagination?.hasNextPage ??
      (currentPage < totalPages)
    ),
  };
}

export async function getSeries(slug: string): Promise<SeriesPayload> {
  if (isRestrictedText(slug)) {
    throw new Error("This title is not available.");
  }

  const raw = await apiFetch(`${ANIME_BASE}/api/series/${encodeURIComponent(slug)}`, 180);
  const data = raw?.data ?? raw ?? {};
  const anime = data?.anime ?? data ?? {};
  const language = data?.language_availability ?? anime?.language_availability ?? {};

  const title = String(anime?.title ?? data?.title ?? "Untitled");
  if (isRestrictedText(title, anime?.alternative, anime?.titles, data?.watch_url)) {
    throw new Error("This title is not available.");
  }

  return {
    slug: String(data?.slug ?? anime?.slug ?? slug),
    seriesId:
      data?.series_id == null && anime?.id == null
        ? undefined
        : String(data?.series_id ?? anime?.id),
    title,
    native: anime?.native ?? data?.native ?? undefined,
    poster: anime?.poster ?? data?.poster ?? undefined,
    description: anime?.description ?? data?.description ?? undefined,
    score: anime?.score ?? anime?.rating ?? data?.score ?? undefined,
    malId: anime?.mal_id ?? data?.mal_id ?? undefined,
    aniId: anime?.ani_id ?? anime?.anilist_id ?? data?.ani_id ?? data?.anilist_id ?? undefined,
    backgroundImage: anime?.background_image ?? data?.background_image ?? undefined,
    status: anime?.status ?? data?.status ?? undefined,
    year: anime?.year ?? data?.year ?? undefined,
    duration: anime?.duration ?? data?.duration ?? undefined,
    languageAvailability: {
      subEpisodes: toNumber(language?.sub_episodes ?? anime?.is_sub) ?? 0,
      dubEpisodes: toNumber(language?.dub_episodes ?? anime?.is_dub) ?? 0,
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
