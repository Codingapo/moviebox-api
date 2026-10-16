create schema if not exists private;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username is null or char_length(username) between 3 and 32),
  display_name text,
  avatar_url text,
  banner_url text,
  bio text check (bio is null or char_length(bio) <= 500),
  role text not null default 'user' check (role in ('user','moderator','admin')),
  power_level bigint not null default 0 check (power_level >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_slug text not null,
  title text not null,
  poster text,
  created_at timestamptz not null default now(),
  primary key (user_id, anime_slug)
);

create table if not exists public.watch_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_slug text not null,
  episode integer not null check (episode > 0),
  language text not null check (language in ('sub','dub')),
  progress_seconds integer not null default 0 check (progress_seconds >= 0),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_slug, episode, language)
);

create table if not exists public.custom_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  visibility text not null default 'private' check (visibility in ('private','public','unlisted')),
  created_at timestamptz not null default now()
);

create table if not exists public.custom_list_items (
  list_id uuid not null references public.custom_lists(id) on delete cascade,
  anime_slug text not null,
  title text not null,
  poster text,
  created_at timestamptz not null default now(),
  primary key (list_id, anime_slug)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_slug text not null,
  episode integer check (episode is null or episode > 0),
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  spoiler boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comment_likes (
  user_id uuid not null references auth.users(id) on delete cascade,
  comment_id uuid not null references public.comments(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create table if not exists public.ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_slug text not null,
  score numeric(3,1) not null check (score >= 0 and score <= 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_slug)
);

create table if not exists public.preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  autoplay boolean not null default true,
  preferred_language text not null default 'sub' check (preferred_language in ('sub','dub')),
  reduced_motion boolean not null default false,
  sound_enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.favorites enable row level security;
alter table public.watch_history enable row level security;
alter table public.custom_lists enable row level security;
alter table public.custom_list_items enable row level security;
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.ratings enable row level security;
alter table public.preferences enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (username, display_name, avatar_url, banner_url, bio, updated_at) on public.profiles to authenticated;
grant select, insert, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.watch_history to authenticated;
grant select on public.custom_lists, public.custom_list_items to anon, authenticated;
grant insert, update, delete on public.custom_lists to authenticated;
grant insert, delete on public.custom_list_items to authenticated;
grant select on public.comments to anon, authenticated;
grant insert, update, delete on public.comments to authenticated;
grant select on public.comment_likes to anon, authenticated;
grant insert, delete on public.comment_likes to authenticated;
grant select on public.ratings to anon, authenticated;
grant insert, update, delete on public.ratings to authenticated;
grant select, insert, update on public.preferences to authenticated;

create policy "profiles_public_read" on public.profiles for select to anon, authenticated using (true);
create policy "profiles_owner_update" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "favorites_owner_read" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "favorites_owner_insert" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "favorites_owner_delete" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

create policy "history_owner_read" on public.watch_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "history_owner_insert" on public.watch_history for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "history_owner_update" on public.watch_history for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "history_owner_delete" on public.watch_history for delete to authenticated using ((select auth.uid()) = user_id);

create policy "lists_owner_or_public_read" on public.custom_lists for select to anon, authenticated using (visibility = 'public' or (select auth.uid()) = user_id);
create policy "lists_owner_insert" on public.custom_lists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "lists_owner_update" on public.custom_lists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "lists_owner_delete" on public.custom_lists for delete to authenticated using ((select auth.uid()) = user_id);

create policy "list_items_visible_with_parent" on public.custom_list_items for select to anon, authenticated using (
  exists (select 1 from public.custom_lists l where l.id = list_id and (l.visibility = 'public' or l.user_id = (select auth.uid())))
);
create policy "list_items_owner_insert" on public.custom_list_items for insert to authenticated with check (
  exists (select 1 from public.custom_lists l where l.id = list_id and l.user_id = (select auth.uid()))
);
create policy "list_items_owner_delete" on public.custom_list_items for delete to authenticated using (
  exists (select 1 from public.custom_lists l where l.id = list_id and l.user_id = (select auth.uid()))
);

create policy "comments_public_read" on public.comments for select to anon, authenticated using (true);
create policy "comments_owner_insert" on public.comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "comments_owner_update" on public.comments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "comments_owner_or_moderator_delete" on public.comments for delete to authenticated using (
  (select auth.uid()) = user_id
  or exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role in ('moderator','admin'))
);

create policy "likes_public_read" on public.comment_likes for select to anon, authenticated using (true);
create policy "likes_owner_insert" on public.comment_likes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "likes_owner_delete" on public.comment_likes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "ratings_public_read" on public.ratings for select to anon, authenticated using (true);
create policy "ratings_owner_insert" on public.ratings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "ratings_owner_update" on public.ratings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "ratings_owner_delete" on public.ratings for delete to authenticated using ((select auth.uid()) = user_id);

create policy "preferences_owner_read" on public.preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "preferences_owner_insert" on public.preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "preferences_owner_update" on public.preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists idx_favorites_user_created on public.favorites (user_id, created_at desc);
create index if not exists idx_history_user_updated on public.watch_history (user_id, updated_at desc);
create index if not exists idx_history_anime on public.watch_history (anime_slug, episode);
create index if not exists idx_lists_user_created on public.custom_lists (user_id, created_at desc);
create index if not exists idx_list_items_slug on public.custom_list_items (anime_slug);
create index if not exists idx_comments_anime_created on public.comments (anime_slug, created_at desc);
create index if not exists idx_comments_anime_episode on public.comments (anime_slug, episode, created_at desc);
create index if not exists idx_comments_parent on public.comments (parent_id);
create index if not exists idx_comments_user on public.comments (user_id, created_at desc);
create index if not exists idx_comment_likes_comment on public.comment_likes (comment_id);
create index if not exists idx_ratings_anime on public.ratings (anime_slug);

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Saiyan'
    )
  )
  on conflict (id) do nothing;

  insert into public.preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure private.handle_new_user();
