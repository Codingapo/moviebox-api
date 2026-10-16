import Image from "next/image";
import Link from "next/link";
import { Comments } from "@/components/comments";
import { FavoriteButton } from "@/components/favorite-button";
import { getSeries } from "@/lib/anime-api/client";

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const anime = await getSeries(slug);
  const maxEpisodes = Math.max(anime.languageAvailability.subEpisodes, anime.languageAvailability.dubEpisodes);
  const defaultLanguage = anime.languageAvailability.subEpisodes ? "sub" : "dub";

  return (
    <main className="min-h-screen">
      <div className="relative min-h-[58vh] overflow-hidden border-b border-white/10">
        {anime.backgroundImage && (
          <Image src={anime.backgroundImage} alt="" fill priority className="object-cover opacity-35" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-black/20" />
        <div className="relative z-10 mx-auto flex min-h-[58vh] max-w-7xl items-end gap-7 px-6 pb-10 pt-28">
          {anime.poster && (
            <Image
              src={anime.poster}
              alt={anime.title}
              width={230}
              height={345}
              className="hidden rounded-2xl border border-white/10 shadow-2xl sm:block"
            />
          )}
          <div className="max-w-3xl">
            <Link href="/" className="text-sm text-white/50 hover:text-white">← Home</Link>
            <p className="mt-5 text-sm font-bold uppercase tracking-[.25em] text-ki">
              {anime.status || "Series"} · {anime.year || "—"}
            </p>
            <h1 className="mt-2 text-4xl font-black sm:text-6xl">{anime.title}</h1>
            {anime.native && <p className="mt-2 text-lg text-white/45">{anime.native}</p>}
            <p className="mt-4 max-w-2xl text-white/70">{anime.description || "No synopsis available yet."}</p>

            <div className="mt-6 flex flex-wrap gap-3">
              {maxEpisodes > 0 && (
                <Link
                  href={`/watch/${anime.slug}?ep=1&lang=${defaultLanguage}`}
                  className="rounded-full bg-ki px-6 py-3 font-bold text-black shadow-ki"
                >
                  ▶ Watch episode 1
                </Link>
              )}
              <FavoriteButton animeSlug={anime.slug} title={anime.title} poster={anime.poster} />
            </div>
          </div>
        </div>
      </div>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="text-sm text-white/50">Score</div>
            <div className="mt-1 text-2xl font-black">{anime.score ?? "—"}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="text-sm text-white/50">SUB</div>
            <div className="mt-1 text-2xl font-black">{anime.languageAvailability.subEpisodes}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="text-sm text-white/50">DUB</div>
            <div className="mt-1 text-2xl font-black">{anime.languageAvailability.dubEpisodes}</div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[.03] p-5">
            <div className="text-sm text-white/50">Duration</div>
            <div className="mt-1 text-2xl font-black">{anime.duration ?? "—"}</div>
          </div>
        </div>

        <Comments animeSlug={anime.slug} />
      </section>
    </main>
  );
}
