import { notFound } from "next/navigation";
import { AnimeCard } from "@/components/anime-card";
import { getGenre } from "@/lib/anime-api/client";

const BLOCKED_GENRES = new Set(["hentai", "erotica", "ecchi", "adult"]);

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  if (BLOCKED_GENRES.has(slug.toLowerCase())) notFound();

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam || 1));
  const data = await getGenre(slug, page);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <a href="/" className="text-sm text-white/55 hover:text-white">← Home</a>
      <h1 className="mt-5 text-4xl font-black capitalize">{slug.replaceAll("-", " ")}</h1>
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {data.items.filter((x) => !x.adultContent).map((anime) => (
          <AnimeCard key={anime.id} anime={anime} />
        ))}
      </div>
      <div className="mt-10 flex gap-3">
        {page > 1 && (
          <a className="rounded-full border border-white/15 px-4 py-2" href={`?page=${page - 1}`}>
            Previous
          </a>
        )}
        {data.hasNextPage !== false && (
          <a className="rounded-full bg-ki px-4 py-2 font-bold text-black" href={`?page=${page + 1}`}>
            Next
          </a>
        )}
      </div>
    </main>
  );
}
