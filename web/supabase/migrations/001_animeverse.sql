create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  banner_url text,
  bio text,
  role text not null default 'user' check (role in ('user','moderator','admin')),
  power_level bigint not null default 0,
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
  episode int not null,
  language text not null check (language in ('sub','dub')),
  progress_seconds int not null default 0,
  duration_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, anime_slug, episode, language)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  anime_slug text not null,
  episode int,
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
alter table public.comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.preferences enable row level security;

create policy "profiles readable" on public.profiles for select using (true);
create policy "profile owner updates" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "favorite owner read" on public.favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "favorite owner insert" on public.favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "favorite owner delete" on public.favorites for delete to authenticated using ((select auth.uid()) = user_id);

create policy "history owner read" on public.watch_history for select to authenticated using ((select auth.uid()) = user_id);
create policy "history owner insert" on public.watch_history for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "history owner update" on public.watch_history for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "comments readable" on public.comments for select using (true);
create policy "comments own insert" on public.comments for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "comments own update" on public.comments for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "comments own delete" on public.comments for delete to authenticated using ((select auth.uid()) = user_id);

create policy "likes readable" on public.comment_likes for select using (true);
create policy "likes own insert" on public.comment_likes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "likes own delete" on public.comment_likes for delete to authenticated using ((select auth.uid()) = user_id);

create policy "preferences own read" on public.preferences for select to authenticated using ((select auth.uid()) = user_id);
create policy "preferences own insert" on public.preferences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "preferences own update" on public.preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create index if not exists idx_comments_anime_episode on public.comments (anime_slug, episode, created_at desc);
create index if not exists idx_comments_parent on public.comments (parent_id);
create index if not exists idx_history_user_updated on public.watch_history (user_id, updated_at desc);
create index if not exists idx_favorites_user_created on public.favorites (user_id, created_at desc);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
