import Hero from "@/components/hero";
import { AnimeCard } from "@/components/anime-card";
import { getHome } from "@/lib/anime-api/client";

export default async function HomePage() {
  const home = await getHome();

  return (
    <main>
      <Hero />
      <section className="mx-auto max-w-7xl px-6 py-14">
        <div id="genres" className="flex flex-wrap gap-2">
          {home.navigation.genres.slice(0, 18).map((genre) => (
            <a key={genre.slug} href={`/genre/${genre.slug}`} className="rounded-full border border-white/10 bg-white/[.04] px-4 py-2 text-sm text-white/75 transition hover:border-ki/60 hover:text-white">
              {genre.name}
            </a>
          ))}
        </div>

        <section className="mt-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.25em] text-ki">Spotlight</p>
              <h2 className="mt-2 text-3xl font-black">Hot right now</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {home.sections.hotest.slice(0, 12).filter(x => !x.adultContent).map((anime) => <AnimeCard key={anime.id} anime={anime} />)}
          </div>
        </section>

        <section id="latest" className="mt-16">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-ssj">Fresh energy</p>
          <h2 className="mt-2 text-3xl font-black">Latest episodes</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {home.sections.latestEpisode.slice(0, 12).filter(x => !x.adultContent).map((anime) => <AnimeCard key={anime.id} anime={anime} />)}
          </div>
        </section>
      </section>
    </main>
  );
}
