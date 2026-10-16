import Link from "next/link";
import Hero from "@/components/hero";
import { AnimeCard } from "@/components/anime-card";
import { getHome } from "@/lib/anime-api/client";
import { createClient } from "@/lib/supabase/server";

async function getContinueWatching() {
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return [];
    const { data } = await supabase
      .from("watch_history")
      .select("anime_slug,episode,language,updated_at")
      .order("updated_at", { ascending: false })
      .limit(8);
    return data || [];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const [home, history] = await Promise.all([getHome(), getContinueWatching()]);

  return (
    <main>
      <div className="absolute right-5 top-5 z-30 flex gap-2">
        <Link href="/library" className="rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm backdrop-blur hover:bg-black/60">Library</Link>
        <Link href="/profile" className="rounded-full border border-white/10 bg-black/35 px-4 py-2 text-sm backdrop-blur hover:bg-black/60">Profile</Link>
        <Link href="/login" className="rounded-full bg-ki px-4 py-2 text-sm font-bold text-black">Login</Link>
      </div>

      <Hero />

      <section className="mx-auto max-w-7xl px-6 py-14">
        {history.length > 0 && (
          <section className="mb-14">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.25em] text-ki">Your journey</p>
                <h2 className="mt-2 text-3xl font-black">Continue watching</h2>
              </div>
              <Link href="/library" className="text-sm text-white/50 hover:text-white">View library →</Link>
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {history.map((item) => (
                <Link
                  key={`${item.anime_slug}-${item.episode}-${item.language}`}
                  href={`/watch/${item.anime_slug}?ep=${item.episode}&lang=${item.language}`}
                  className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:-translate-y-0.5 hover:border-ki/40"
                >
                  <div className="line-clamp-1 font-bold capitalize">{item.anime_slug.replaceAll("-", " ")}</div>
                  <div className="mt-1 text-sm text-white/50">Episode {item.episode} · {String(item.language).toUpperCase()}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <div id="genres" className="flex flex-wrap gap-2">
          {home.navigation.genres.slice(0, 18).map((genre) => (
            <Link key={genre.slug} href={`/genre/${genre.slug}`} className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm text-white/75 transition hover:border-ki/60 hover:text-white">
              {genre.name}
            </Link>
          ))}
        </div>

        <section className="mt-14">
          <div className="mb-6">
            <p className="text-xs font-bold uppercase tracking-[.25em] text-ki">Spotlight</p>
            <h2 className="mt-2 text-3xl font-black">Hot right now</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {home.sections.hotest.slice(0, 12).filter((x) => !x.adultContent).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        <section id="latest" className="mt-16">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-ssj">Fresh energy</p>
          <h2 className="mt-2 text-3xl font-black">Latest episodes</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {home.sections.latestEpisode.slice(0, 12).filter((x) => !x.adultContent).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>

        <section className="mt-16">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-crimson">Incoming</p>
          <h2 className="mt-2 text-3xl font-black">Upcoming anime</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {home.sections.upcomingAnime.slice(0, 12).filter((x) => !x.adultContent).map((anime) => (
              <AnimeCard key={anime.id} anime={anime} />
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
