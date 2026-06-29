-- ============================================================
-- NoteForge — Migration 001: Initial Schema
-- ============================================================
-- Run this in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

comment on table public.profiles is 'Extended user profile data, linked 1:1 with auth.users';

-- Auto-create profile on user sign-up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- FOLDERS (nested, self-referencing)
-- ============================================================
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   uuid references public.folders(id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.folders is 'Nested folder hierarchy for organizing notes';
comment on column public.folders.parent_id is 'Self-referencing FK for nested folders; NULL = root level';

create index if not exists folders_user_id_idx    on public.folders(user_id);
create index if not exists folders_parent_id_idx  on public.folders(parent_id);

-- ============================================================
-- NOTES
-- ============================================================
create table if not exists public.notes (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  folder_id         uuid references public.folders(id) on delete set null,
  title             text not null default 'Başlıksız Not',
  content_json      jsonb,          -- TipTap ProseMirror JSON (Phase 2)
  content_markdown  text,           -- Plain text / Markdown fallback
  is_template       boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.notes is 'Core notes table; content stored as ProseMirror JSON + markdown fallback';
comment on column public.notes.content_json is 'TipTap/ProseMirror JSON document — used by rich editor in Phase 2';
comment on column public.notes.content_markdown is 'Markdown/plain text fallback; used in Phase 1 basic editor';
comment on column public.notes.is_template is 'If true, note appears in template picker rather than note list';

create index if not exists notes_user_id_idx       on public.notes(user_id);
create index if not exists notes_folder_id_idx     on public.notes(folder_id);
create index if not exists notes_updated_at_idx    on public.notes(updated_at desc);
create index if not exists notes_is_template_idx   on public.notes(user_id, is_template);

-- Full-text search index (Phase 4 feature)
alter table public.notes add column if not exists search_vector tsvector
  generated always as (
    to_tsvector('turkish', coalesce(title, '') || ' ' || coalesce(content_markdown, ''))
  ) stored;

create index if not exists notes_search_vector_idx on public.notes using gin(search_vector);

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists notes_set_updated_at on public.notes;
create trigger notes_set_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();

drop trigger if exists folders_set_updated_at on public.folders;
create trigger folders_set_updated_at
  before update on public.folders
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- TAGS
-- ============================================================
create table if not exists public.tags (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  name      text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

comment on table public.tags is 'User-defined tags for cross-category note organization';

create index if not exists tags_user_id_idx on public.tags(user_id);

-- ============================================================
-- NOTES_TAGS (many-to-many)
-- ============================================================
create table if not exists public.notes_tags (
  note_id  uuid not null references public.notes(id) on delete cascade,
  tag_id   uuid not null references public.tags(id) on delete cascade,
  primary key (note_id, tag_id)
);

create index if not exists notes_tags_note_id_idx on public.notes_tags(note_id);
create index if not exists notes_tags_tag_id_idx  on public.notes_tags(tag_id);

-- ============================================================
-- MEDIA ASSETS (images + PDFs embedded in notes)
-- ============================================================
create table if not exists public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  note_id       uuid not null references public.notes(id) on delete cascade,
  type          text not null check (type in ('image', 'pdf')),
  storage_url   text not null,
  file_name     text,
  file_size     bigint,
  position_data jsonb,   -- { x, y, width, height } for canvas positioning
  created_at    timestamptz not null default now()
);

comment on table public.media_assets is 'Images and PDFs attached to notes; position_data used by canvas overlay layer';
comment on column public.media_assets.position_data is 'Konva.js/Fabric.js position: {x, y, width, height} — Phase 2';

create index if not exists media_assets_note_id_idx on public.media_assets(note_id);

-- ============================================================
-- PDF ANNOTATIONS
-- ============================================================
create table if not exists public.pdf_annotations (
  id             uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  page_number    integer not null check (page_number > 0),
  coordinates    jsonb not null,   -- { x1, y1, x2, y2 } normalized 0-1
  color          text not null default '#FFEB3B',
  note_text      text,
  created_at     timestamptz not null default now()
);

comment on table public.pdf_annotations is 'PDF highlight + note annotations; stored separately, original PDF is never modified';

create index if not exists pdf_annotations_asset_id_idx on public.pdf_annotations(media_asset_id);

-- ============================================================
-- USER PREFERENCES
-- ============================================================
create table if not exists public.user_preferences (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  font_family  text not null default 'Geist',
  font_size    integer not null default 15 check (font_size between 12 and 24),
  line_height  numeric not null default 1.6 check (line_height between 1.2 and 2.5),
  page_width   text not null default 'narrow' check (page_width in ('narrow', 'medium', 'full')),
  theme        text not null default 'dark' check (theme in ('dark', 'sepia', 'cool', 'dim')),
  updated_at   timestamptz not null default now()
);

comment on table public.user_preferences is 'Per-user typography and appearance settings; applied via CSS custom properties';

-- Auto-create preferences on profile creation
create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_profile_created on public.profiles;
create trigger on_profile_created
  after insert on public.profiles
  for each row execute procedure public.handle_new_profile();
