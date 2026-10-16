import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login");
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: favorites } = await supabase
    .from("favorites")
    .select("anime_slug,title,poster,created_at")
    .order("created_at", { ascending: false });

  const { data: history } = await supabase
    .from("watch_history")
    .select("anime_slug,episode,language,updated_at")
    .order("updated_at", { ascending: false })
    .limit(12);

  return (
    <main className="mx-auto max-w-7xl px-6 py-12">
      <Link href="/" className="text-sm text-white/50 hover:text-white">← Home</Link>
      <h1 className="mt-5 text-4xl font-black">My Library</h1>

      <section className="mt-10">
        <h2 className="text-2xl font-black">Favorites</h2>
        {!favorites?.length ? (
          <p className="mt-4 text-white/50">No favorites yet.</p>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {favorites.map((item) => (
              <Link key={item.anime_slug} href={`/series/${item.anime_slug}`} className="group">
                <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                  {item.poster && <Image src={item.poster} alt={item.title} fill className="object-cover transition group-hover:scale-105" />}
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-semibold">{item.title}</h3>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-black">Continue watching</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(history || []).map((item) => (
            <Link
              key={`${item.anime_slug}-${item.episode}-${item.language}`}
              href={`/watch/${item.anime_slug}?ep=${item.episode}&lang=${item.language}`}
              className="rounded-2xl border border-white/10 bg-white/[.03] p-4 transition hover:border-ki/40"
            >
              <div className="font-bold">{item.anime_slug.replaceAll("-", " ")}</div>
              <div className="mt-1 text-sm text-white/50">Episode {item.episode} · {String(item.language).toUpperCase()}</div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
