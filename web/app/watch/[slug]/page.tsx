import { anilistPlayer } from "@/lib/player";
import { getSeries } from "@/lib/anime-api/client";

export default async function WatchPage({ params, searchParams }: { params: Promise<{slug:string}>; searchParams: Promise<{ep?:string;lang?:string}> }) {
  const { slug } = await params;
  const q = await searchParams;
  const anime = await getSeries(slug);
  const ep = Math.max(1, Number(q.ep || 1));
  const lang = q.lang === "dub" ? "dub" : "sub";

  if (!anime.aniId) {
    return <main className="mx-auto max-w-4xl px-6 py-20"><h1 className="text-3xl font-black">Player unavailable</h1><p className="mt-3 text-white/60">This title does not expose an AniList player identifier yet.</p></main>;
  }

  const src = anilistPlayer(anime.aniId, ep, lang);

  return (
    <main className="min-h-screen bg-black">
      <div className="mx-auto max-w-[1500px] px-4 py-4">
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
          <div><h1 className="text-2xl font-black">{anime.title}</h1><p className="text-white/55">Episode {ep} · {lang.toUpperCase()}</p></div>
          <div className="flex gap-2">
            {ep > 1 && <a href={`?ep=${ep-1}&lang=${lang}`} className="rounded-full border border-white/15 px-4 py-2">Previous</a>}
            <a href={`?ep=${ep+1}&lang=${lang}`} className="rounded-full bg-ki px-4 py-2 font-bold text-black">Next</a>
          </div>
        </div>
      </div>
    </main>
  );
}
