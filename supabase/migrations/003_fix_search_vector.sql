-- ============================================================
-- NoteForge — Migration 003: Fix Search Vector Language
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor → New Query
--
-- WHY: 'turkish' text search config may not be available in
-- all Supabase regions. This replaces it with 'simple' which
-- is always available and works for basic search.
--
-- SAFE TO RUN MULTIPLE TIMES (idempotent).
-- ============================================================

-- 1. Drop the existing generated column (if it exists)
alter table public.notes
  drop column if exists search_vector;

-- 2. Re-add with 'simple' config (universally available)
alter table public.notes
  add column if not exists search_vector tsvector
    generated always as (
      to_tsvector('simple',
        coalesce(title, '') || ' ' || coalesce(content_markdown, '')
      )
    ) stored;

-- 3. Recreate the GIN index
drop index if exists public.notes_search_vector_idx;
create index if not exists notes_search_vector_idx
  on public.notes using gin(search_vector);

-- ============================================================
-- VERIFY: Run this SELECT to confirm everything is set up.
-- You should see all 8 tables listed.
-- ============================================================
-- select table_name
-- from information_schema.tables
-- where table_schema = 'public'
--   and table_name in (
--     'profiles', 'folders', 'notes', 'tags',
--     'notes_tags', 'media_assets', 'pdf_annotations', 'user_preferences'
--   )
-- order by table_name;
