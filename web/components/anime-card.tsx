import Image from "next/image";
import Link from "next/link";
import type { AnimeCard as AnimeCardType } from "@/lib/anime-api/types";

export function AnimeCard({ anime }: { anime: AnimeCardType }) {
  return (
    <Link href={`/series/${anime.slug}`} className="group block">
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl transition duration-300 group-hover:-translate-y-1 group-hover:border-ki/50 group-hover:shadow-ki">
        {anime.poster ? (
          <Image src={anime.poster} alt={anime.title} fill sizes="(max-width:768px) 45vw, 220px" className="object-cover transition duration-500 group-hover:scale-105" />
        ) : <div className="h-full w-full bg-gradient-to-br from-ki/20 to-white/5" />}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/75 to-transparent p-4 pt-16">
          <h3 className="line-clamp-2 font-semibold">{anime.title}</h3>
          <div className="mt-2 flex gap-2 text-xs text-white/65">
            {anime.sub ? <span>SUB {anime.sub}</span> : null}
            {anime.dub ? <span>DUB {anime.dub}</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}
