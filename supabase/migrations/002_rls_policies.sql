-- ============================================================
-- NoteForge — Migration 002: Row Level Security Policies
-- ============================================================
-- Run AFTER 001_initial_schema.sql

-- Enable RLS on all tables
alter table public.profiles         enable row level security;
alter table public.folders          enable row level security;
alter table public.notes            enable row level security;
alter table public.tags             enable row level security;
alter table public.notes_tags       enable row level security;
alter table public.media_assets     enable row level security;
alter table public.pdf_annotations  enable row level security;
alter table public.user_preferences enable row level security;

-- ============================================================
-- PROFILES
-- ============================================================
create policy "profiles: users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- FOLDERS
-- ============================================================
create policy "folders: users can view own folders"
  on public.folders for select
  using (auth.uid() = user_id);

create policy "folders: users can create folders"
  on public.folders for insert
  with check (auth.uid() = user_id);

create policy "folders: users can update own folders"
  on public.folders for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "folders: users can delete own folders"
  on public.folders for delete
  using (auth.uid() = user_id);

-- ============================================================
-- NOTES
-- ============================================================
create policy "notes: users can view own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "notes: users can create notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "notes: users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notes: users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

-- ============================================================
-- TAGS
-- ============================================================
create policy "tags: users can view own tags"
  on public.tags for select
  using (auth.uid() = user_id);

create policy "tags: users can create tags"
  on public.tags for insert
  with check (auth.uid() = user_id);

create policy "tags: users can update own tags"
  on public.tags for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tags: users can delete own tags"
  on public.tags for delete
  using (auth.uid() = user_id);

-- ============================================================
-- NOTES_TAGS
-- ============================================================
create policy "notes_tags: users can view own note tags"
  on public.notes_tags for select
  using (
    exists (
      select 1 from public.notes n
      where n.id = notes_tags.note_id and n.user_id = auth.uid()
    )
  );

create policy "notes_tags: users can add tags to own notes"
  on public.notes_tags for insert
  with check (
    exists (
      select 1 from public.notes n
      where n.id = notes_tags.note_id and n.user_id = auth.uid()
    )
  );

create policy "notes_tags: users can remove tags from own notes"
  on public.notes_tags for delete
  using (
    exists (
      select 1 from public.notes n
      where n.id = notes_tags.note_id and n.user_id = auth.uid()
    )
  );

-- ============================================================
-- MEDIA ASSETS
-- ============================================================
create policy "media_assets: users can view own media"
  on public.media_assets for select
  using (
    exists (
      select 1 from public.notes n
      where n.id = media_assets.note_id and n.user_id = auth.uid()
    )
  );

create policy "media_assets: users can insert own media"
  on public.media_assets for insert
  with check (
    exists (
      select 1 from public.notes n
      where n.id = media_assets.note_id and n.user_id = auth.uid()
    )
  );

create policy "media_assets: users can update own media"
  on public.media_assets for update
  using (
    exists (
      select 1 from public.notes n
      where n.id = media_assets.note_id and n.user_id = auth.uid()
    )
  );

create policy "media_assets: users can delete own media"
  on public.media_assets for delete
  using (
    exists (
      select 1 from public.notes n
      where n.id = media_assets.note_id and n.user_id = auth.uid()
    )
  );

-- ============================================================
-- PDF ANNOTATIONS
-- ============================================================
create policy "pdf_annotations: users can view own annotations"
  on public.pdf_annotations for select
  using (
    exists (
      select 1 from public.media_assets ma
      join public.notes n on n.id = ma.note_id
      where ma.id = pdf_annotations.media_asset_id and n.user_id = auth.uid()
    )
  );

create policy "pdf_annotations: users can create annotations"
  on public.pdf_annotations for insert
  with check (
    exists (
      select 1 from public.media_assets ma
      join public.notes n on n.id = ma.note_id
      where ma.id = pdf_annotations.media_asset_id and n.user_id = auth.uid()
    )
  );

create policy "pdf_annotations: users can update own annotations"
  on public.pdf_annotations for update
  using (
    exists (
      select 1 from public.media_assets ma
      join public.notes n on n.id = ma.note_id
      where ma.id = pdf_annotations.media_asset_id and n.user_id = auth.uid()
    )
  );

create policy "pdf_annotations: users can delete own annotations"
  on public.pdf_annotations for delete
  using (
    exists (
      select 1 from public.media_assets ma
      join public.notes n on n.id = ma.note_id
      where ma.id = pdf_annotations.media_asset_id and n.user_id = auth.uid()
    )
  );

-- ============================================================
-- USER PREFERENCES
-- ============================================================
create policy "user_preferences: users can view own preferences"
  on public.user_preferences for select
  using (auth.uid() = user_id);

create policy "user_preferences: users can update own preferences"
  on public.user_preferences for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_preferences: users can insert own preferences"
  on public.user_preferences for insert
  with check (auth.uid() = user_id);

-- ============================================================
-- STORAGE BUCKET (run after enabling Storage in Supabase dashboard)
-- ============================================================
-- insert into storage.buckets (id, name, public)
-- values ('media', 'media', false);

-- create policy "media: authenticated users can upload"
--   on storage.objects for insert
--   with check (bucket_id = 'media' and auth.role() = 'authenticated');

-- create policy "media: users can view own media"
--   on storage.objects for select
--   using (bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]);
