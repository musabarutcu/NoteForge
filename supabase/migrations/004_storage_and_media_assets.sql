-- ============================================================
-- NoteForge — Migration 004: Supabase Storage for note images
-- ============================================================
-- Run this in Supabase SQL Editor

-- Create storage bucket for note images (if not exists)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-images',
  'note-images',
  true,
  10485760,  -- 10 MB limit per file
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
on conflict (id) do nothing;

-- RLS policy: authenticated users can upload to their own folder
create policy "note-images: users can upload own images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policy: anyone can read (public bucket)
create policy "note-images: public read"
  on storage.objects for select
  to public
  using (bucket_id = 'note-images');

-- RLS policy: users can delete their own images
create policy "note-images: users can delete own images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'note-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS policies for media_assets table
-- (These may already exist but using IF NOT EXISTS pattern via DO block)

do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'media_assets' and policyname = 'media_assets: users can view own assets'
  ) then
    execute $policy$
      create policy "media_assets: users can view own assets"
        on public.media_assets for select
        using (
          note_id in (select id from public.notes where user_id = auth.uid())
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'media_assets' and policyname = 'media_assets: users can insert own assets'
  ) then
    execute $policy$
      create policy "media_assets: users can insert own assets"
        on public.media_assets for insert
        with check (
          note_id in (select id from public.notes where user_id = auth.uid())
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'media_assets' and policyname = 'media_assets: users can update own assets'
  ) then
    execute $policy$
      create policy "media_assets: users can update own assets"
        on public.media_assets for update
        using (
          note_id in (select id from public.notes where user_id = auth.uid())
        )
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where tablename = 'media_assets' and policyname = 'media_assets: users can delete own assets'
  ) then
    execute $policy$
      create policy "media_assets: users can delete own assets"
        on public.media_assets for delete
        using (
          note_id in (select id from public.notes where user_id = auth.uid())
        )
    $policy$;
  end if;
end;
$$;
