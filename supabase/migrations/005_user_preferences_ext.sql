-- ============================================================
-- NoteForge — Migration 005: Extend user_preferences
-- ============================================================
-- Run this in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste → Run

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS language              TEXT    NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS notifications_email   BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notifications_weekly  BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_preferences.language             IS 'UI language: tr | en';
COMMENT ON COLUMN public.user_preferences.notifications_email  IS 'Receive important update emails';
COMMENT ON COLUMN public.user_preferences.notifications_weekly IS 'Receive weekly digest emails';
