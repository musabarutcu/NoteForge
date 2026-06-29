import { supabase } from '@/lib/supabase'
import type { Tag } from '@/types/database'

// ---- Fetch all tags for a user ----
export async function fetchTags(userId: string): Promise<Tag[]> {
  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .eq('user_id', userId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Tag[]
}

// ---- Create or get tag by name (upsert) ----
export async function createTag(userId: string, name: string): Promise<Tag> {
  const normalised = name.toLowerCase().trim()
  const { data, error } = await supabase
    .from('tags')
    .upsert(
      { user_id: userId, name: normalised },
      { onConflict: 'user_id,name', ignoreDuplicates: false },
    )
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Tag
}

// ---- Delete a tag ----
export async function deleteTag(id: string): Promise<void> {
  const { error } = await supabase.from('tags').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Add tag to a note (upsert — safe to call twice) ----
export async function addTagToNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('notes_tags')
    .upsert({ note_id: noteId, tag_id: tagId })
  if (error) throw new Error(error.message)
}

// ---- Remove tag from a note ----
export async function removeTagFromNote(noteId: string, tagId: string): Promise<void> {
  const { error } = await supabase
    .from('notes_tags')
    .delete()
    .eq('note_id', noteId)
    .eq('tag_id', tagId)
  if (error) throw new Error(error.message)
}
