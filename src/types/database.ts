// ============================================================
// NoteForge — TypeScript Database Types
// Maps to Supabase PostgreSQL schema
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ---- Database row types ----

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  created_at: string
}

export interface Folder {
  id: string
  user_id: string
  parent_id: string | null
  name: string
  created_at: string
  updated_at: string
}

export interface Note {
  id: string
  user_id: string
  folder_id: string | null
  title: string
  content_json: Json | null
  content_markdown: string | null
  is_template: boolean
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  user_id: string
  name: string
  created_at: string
}

export interface NoteTag {
  note_id: string
  tag_id: string
}

export interface MediaAsset {
  id: string
  note_id: string
  type: 'image' | 'pdf'
  storage_url: string
  file_name: string | null
  file_size: number | null
  position_data: Json | null
  created_at: string
}

export interface PdfAnnotation {
  id: string
  media_asset_id: string
  page_number: number
  coordinates: Json
  color: string
  note_text: string | null
  created_at: string
}

export interface UserPreferences {
  user_id: string
  font_family: string
  font_size: number
  line_height: number
  page_width: 'narrow' | 'medium' | 'full'
  theme: 'dark' | 'light' | 'sepia'
  language: 'tr' | 'en'
  notifications_email: boolean
  notifications_weekly: boolean
  updated_at: string
}

// ---- Extended types (joins) ----

export interface NoteWithTags extends Note {
  tags: Tag[]
}

export interface FolderWithChildren extends Folder {
  children: FolderWithChildren[]
}

// ---- Insert / Update payloads ----

export type NoteInsert = Pick<Note, 'user_id' | 'title'> &
  Partial<Pick<Note, 'folder_id' | 'content_markdown' | 'content_json' | 'is_template'>>

export type NoteUpdate = Partial<Pick<Note, 'title' | 'content_markdown' | 'content_json' | 'folder_id' | 'is_template'>>

export type FolderInsert = Pick<Folder, 'user_id' | 'name'> & Partial<Pick<Folder, 'parent_id'>>

export type TagInsert = Pick<Tag, 'user_id' | 'name'>

export type ProfileUpdate = Partial<Pick<Profile, 'display_name' | 'avatar_url'>>

export type UserPreferencesUpdate = Partial<
  Pick<UserPreferences,
    | 'font_family'
    | 'font_size'
    | 'line_height'
    | 'page_width'
    | 'theme'
    | 'language'
    | 'notifications_email'
    | 'notifications_weekly'
  >
>
