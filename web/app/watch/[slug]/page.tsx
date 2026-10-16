import Link from "next/link";
import { Comments } from "@/components/comments";
import { WatchTracker } from "@/components/watch-tracker";
import { anilistPlayer } from "@/lib/player";
import { getSeries } from "@/lib/anime-api/client";

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ep?: string; lang?: string }>;
}) {
  const { slug } = await params;
  const q = await searchParams;
  const anime = await getSeries(slug);
  const maxEpisodes = Math.max(anime.languageAvailability.subEpisodes, anime.languageAvailability.dubEpisodes);
  const requestedEp = Math.max(1, Number(q.ep || 1));
  const ep = maxEpisodes > 0 ? Math.min(requestedEp, maxEpisodes) : requestedEp;
  const requestedLang = q.lang === "dub" ? "dub" : "sub";
  const lang =
    requestedLang === "dub" && anime.languageAvailability.dubEpisodes < ep
      ? "sub"
      : requestedLang === "sub" && anime.languageAvailability.subEpisodes < ep
        ? "dub"
        : requestedLang;

  if (!anime.aniId) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-20">
        <Link href={`/series/${slug}`} className="text-sm text-white/50 hover:text-white">← Back to series</Link>
        <h1 className="mt-5 text-3xl font-black">Player unavailable</h1>
        <p className="mt-3 text-white/60">This title does not expose an AniList player identifier yet.</p>
      </main>
    );
  }

  const src = anilistPlayer(anime.aniId, ep, lang);

  return (
    <main className="min-h-screen bg-black">
      <WatchTracker animeSlug={anime.slug} episode={ep} language={lang} />
      <div className="mx-auto max-w-[1500px] px-4 py-4">
        <div className="mb-4 flex items-center justify-between gap-4">
          <Link href={`/series/${anime.slug}`} className="text-sm text-white/50 hover:text-white">← {anime.title}</Link>
          <Link href="/library" className="text-sm text-ki hover:text-white">My Library</Link>
        </div>

        <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
          <iframe
            src={src}
            title={`${anime.title} episode ${ep}`}
            className="h-full w-full"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">{anime.title}</h1>
            <p className="text-white/55">Episode {ep} · {lang.toUpperCase()}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {anime.languageAvailability.subEpisodes >= ep && (
              <Link
                href={`?ep=${ep}&lang=sub`}
                className={`rounded-full px-4 py-2 ${lang === "sub" ? "bg-ki font-bold text-black" : "border border-white/15"}`}
              >
                SUB
              </Link>
            )}
            {anime.languageAvailability.dubEpisodes >= ep && (
              <Link
                href={`?ep=${ep}&lang=dub`}
                className={`rounded-full px-4 py-2 ${lang === "dub" ? "bg-ssj font-bold text-black" : "border border-white/15"}`}
              >
                DUB
              </Link>
            )}
            {ep > 1 && (
              <Link href={`?ep=${ep - 1}&lang=${lang}`} className="rounded-full border border-white/15 px-4 py-2">
                Previous
              </Link>
            )}
            {(maxEpisodes === 0 || ep < maxEpisodes) && (
              <Link href={`?ep=${ep + 1}&lang=${lang}`} className="rounded-full bg-ki px-4 py-2 font-bold text-black">
                Next
              </Link>
            )}
          </div>
        </div>

        <Comments animeSlug={anime.slug} episode={ep} />
      </div>
    </main>
  );
}
