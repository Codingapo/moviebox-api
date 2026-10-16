"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Comment = {
  id: string;
  user_id: string;
  anime_slug: string;
  episode: number | null;
  parent_id: string | null;
  body: string;
  spoiler: boolean;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export function Comments({ animeSlug, episode }: { animeSlug: string; episode?: number }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [likes, setLikes] = useState<Record<string, number>>({});
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [posting, setPosting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? null;
    setUserId(uid);

    let query = supabase
      .from("comments")
      .select("id,user_id,anime_slug,episode,parent_id,body,spoiler,created_at")
      .eq("anime_slug", animeSlug)
      .order("created_at", { ascending: true });

    query = episode == null ? query.is("episode", null) : query.eq("episode", episode);
    const { data: rows, error } = await query;
    if (error) throw error;

    const list = (rows || []) as Comment[];
    setComments(list);

    const userIds = [...new Set(list.map((c) => c.user_id))];
    if (userIds.length) {
      const { data: p } = await supabase
        .from("profiles")
        .select("id,display_name,username,avatar_url")
        .in("id", userIds);
      setProfiles(Object.fromEntries(((p || []) as Profile[]).map((x) => [x.id, x])));
    } else {
      setProfiles({});
    }

    const commentIds = list.map((c) => c.id);
    if (commentIds.length) {
      const { data: l } = await supabase
        .from("comment_likes")
        .select("comment_id,user_id")
        .in("comment_id", commentIds);

      const count: Record<string, number> = {};
      const mine = new Set<string>();
      for (const row of l || []) {
        count[row.comment_id] = (count[row.comment_id] || 0) + 1;
        if (uid && row.user_id === uid) mine.add(row.comment_id);
      }
      setLikes(count);
      setLiked(mine);
    } else {
      setLikes({});
      setLiked(new Set());
    }
  }, [animeSlug, episode]);

  useEffect(() => {
    load().catch(() => setMessage("Comments could not be loaded."));
  }, [load]);

  const roots = useMemo(() => comments.filter((c) => !c.parent_id), [comments]);
  const children = useMemo(() => {
    const map: Record<string, Comment[]> = {};
    for (const c of comments) {
      if (!c.parent_id) continue;
      (map[c.parent_id] ||= []).push(c);
    }
    return map;
  }, [comments]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    const form = new FormData(e.currentTarget);
    const body = String(form.get("body") || "").trim();
    const spoiler = form.get("spoiler") === "on";
    if (!body) return;

    setPosting(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("comments").insert({
        user_id: userId,
        anime_slug: animeSlug,
        episode: episode ?? null,
        parent_id: replyTo,
        body,
        spoiler,
      });
      if (error) throw error;
      e.currentTarget.reset();
      setReplyTo(null);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not post comment.");
    } finally {
      setPosting(false);
    }
  }

  async function toggleLike(commentId: string) {
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    const supabase = createClient();
    if (liked.has(commentId)) {
      const { error } = await supabase
        .from("comment_likes")
        .delete()
        .eq("user_id", userId)
        .eq("comment_id", commentId);
      if (!error) {
        setLiked((old) => {
          const next = new Set(old);
          next.delete(commentId);
          return next;
        });
        setLikes((old) => ({ ...old, [commentId]: Math.max(0, (old[commentId] || 1) - 1) }));
      }
    } else {
      const { error } = await supabase.from("comment_likes").insert({
        user_id: userId,
        comment_id: commentId,
      });
      if (!error) {
        setLiked((old) => new Set([...old, commentId]));
        setLikes((old) => ({ ...old, [commentId]: (old[commentId] || 0) + 1 }));
      }
    }
  }

  function Card({ c, nested = false }: { c: Comment; nested?: boolean }) {
    const profile = profiles[c.user_id];
    const name = profile?.display_name || profile?.username || "Saiyan";
    return (
      <article className={`rounded-2xl border border-white/10 bg-white/[.03] p-4 ${nested ? "ml-6 mt-3" : "mt-4"}`}>
        <div className="flex items-center justify-between gap-3">
          <strong>{name}</strong>
          <time className="text-xs text-white/40">{new Date(c.created_at).toLocaleString()}</time>
        </div>
        <p className={`mt-3 whitespace-pre-wrap text-sm leading-6 ${c.spoiler ? "select-none blur-sm transition hover:blur-none" : "text-white/75"}`}>
          {c.body}
        </p>
        <div className="mt-3 flex gap-4 text-xs text-white/55">
          <button onClick={() => toggleLike(c.id)} className={liked.has(c.id) ? "text-ki" : "hover:text-white"}>
            {liked.has(c.id) ? "♥" : "♡"} {likes[c.id] || 0}
          </button>
          {!nested && <button onClick={() => setReplyTo(c.id)} className="hover:text-white">Reply</button>}
        </div>
        {(children[c.id] || []).map((child) => <Card key={child.id} c={child} nested />)}
      </article>
    );
  }

  return (
    <section className="mt-10">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.25em] text-ki">Community</p>
          <h2 className="mt-2 text-2xl font-black">Comments</h2>
        </div>
        <span className="text-sm text-white/45">{comments.length}</span>
      </div>

      <form onSubmit={submit} className="mt-5 rounded-2xl border border-white/10 bg-white/[.03] p-4">
        {replyTo && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-ki/10 px-3 py-2 text-xs text-ki">
            <span>Replying to a comment</span>
            <button type="button" onClick={() => setReplyTo(null)}>Cancel</button>
          </div>
        )}
        <textarea name="body" required maxLength={5000} rows={3} placeholder={userId ? "Join the discussion…" : "Sign in to comment"} className="w-full resize-none rounded-xl border border-white/10 bg-black/25 p-3 outline-none focus:border-ki" />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs text-white/60">
            <input type="checkbox" name="spoiler" /> Mark as spoiler
          </label>
          <button disabled={posting} className="rounded-full bg-ki px-5 py-2 text-sm font-black text-black disabled:opacity-50">
            {posting ? "Posting…" : "Post comment"}
          </button>
        </div>
      </form>

      {message && <p className="mt-3 text-sm text-crimson">{message}</p>}
      <div>{roots.map((c) => <Card key={c.id} c={c} />)}</div>
    </section>
  );
}
