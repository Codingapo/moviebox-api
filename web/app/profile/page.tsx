import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

export default async function ProfilePage() {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    redirect("/login");
  }

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const [{ data: profile }, { count: favorites }, { count: watched }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", auth.user.id).single(),
    supabase.from("favorites").select("*", { count: "exact", head: true }),
    supabase.from("watch_history").select("*", { count: "exact", head: true }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-white/50 hover:text-white">← Home</Link>

      <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[.04]">
        <div className="h-32 bg-[radial-gradient(circle_at_70%_10%,rgba(39,179,255,.35),transparent_40%),linear-gradient(90deg,#090d17,#05070b)]" />
        <div className="p-7">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-ki">Fighter profile</p>
          <h1 className="mt-2 text-4xl font-black">{profile?.display_name || profile?.username || auth.user.email?.split("@")[0] || "Saiyan"}</h1>
          <p className="mt-2 text-white/50">{auth.user.email}</p>
          {profile?.bio && <p className="mt-4 max-w-2xl text-white/70">{profile.bio}</p>}

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-black/25 p-5">
              <div className="text-sm text-white/45">Power level</div>
              <div className="mt-1 text-3xl font-black text-ki">{profile?.power_level ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-black/25 p-5">
              <div className="text-sm text-white/45">Favorites</div>
              <div className="mt-1 text-3xl font-black">{favorites ?? 0}</div>
            </div>
            <div className="rounded-2xl bg-black/25 p-5">
              <div className="text-sm text-white/45">Episodes opened</div>
              <div className="mt-1 text-3xl font-black">{watched ?? 0}</div>
            </div>
          </div>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/library" className="rounded-full bg-ki px-5 py-3 font-black text-black">Open library</Link>
            <LogoutButton />
          </div>
        </div>
      </section>
    </main>
  );
}
