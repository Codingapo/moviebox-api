"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  animeSlug: string;
  title: string;
  poster?: string;
};

export function FavoriteButton({ animeSlug, title, poster }: Props) {
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = createClient();
        const { data: userData } = await supabase.auth.getUser();
        const id = userData.user?.id ?? null;
        if (!alive) return;
        setUserId(id);
        if (!id) return;
        const { data } = await supabase
          .from("favorites")
          .select("anime_slug")
          .eq("anime_slug", animeSlug)
          .maybeSingle();
        if (alive) setActive(Boolean(data));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [animeSlug]);

  async function toggle() {
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      if (active) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", userId)
          .eq("anime_slug", animeSlug);
        if (error) throw error;
        setActive(false);
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: userId,
          anime_slug: animeSlug,
          title,
          poster: poster || null,
        });
        if (error) throw error;
        setActive(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className="rounded-full border border-white/15 bg-white/5 px-6 py-3 font-bold transition hover:bg-white/10 disabled:opacity-50"
    >
      {active ? "★ In favorites" : "☆ Add to favorites"}
    </button>
  );
}
