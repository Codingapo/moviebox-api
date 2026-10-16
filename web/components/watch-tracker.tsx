"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function WatchTracker({
  animeSlug,
  episode,
  language,
}: {
  animeSlug: string;
  episode: number;
  language: "sub" | "dub";
}) {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getUser();
        if (cancelled || !data.user) return;

        await supabase.from("watch_history").upsert(
          {
            user_id: data.user.id,
            anime_slug: animeSlug,
            episode,
            language,
            progress_seconds: 0,
            duration_seconds: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,anime_slug,episode,language" }
        );
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [animeSlug, episode, language]);

  return null;
}
