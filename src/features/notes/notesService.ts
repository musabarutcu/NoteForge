import { supabase } from '@/lib/supabase'
import type { Note, NoteInsert, NoteUpdate, NoteWithTags } from '@/types/database'

// ---- Helper: flatten tags join ----
function flattenTags(rows: Record<string, unknown>[]): NoteWithTags[] {
  return rows.map(note => ({
    ...note,
    tags: ((note.tags ?? []) as { tag: unknown }[]).map(t => t.tag).filter(Boolean),
  })) as NoteWithTags[]
}

const NOTE_TAGS_SELECT = `
  *,
  tags:notes_tags(
    tag:tags(*)
  )
`

// ---- Create a new note ----
export async function createNote(userId: string, folderId?: string | null): Promise<Note> {
  const payload: NoteInsert = {
    user_id:          userId,
    title:            'Başlıksız Not',
    content_markdown: '',
    folder_id:        folderId ?? null,
  }

  const { data, error } = await supabase
    .from('notes')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Note
}

// ---- Fetch all notes for a user ----
export async function fetchNotes(userId: string): Promise<NoteWithTags[]> {
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_TAGS_SELECT)
    .eq('user_id', userId)
    .eq('is_template', false)
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return flattenTags(data ?? [])
}

// ---- Fetch a single note by ID ----
export async function fetchNote(id: string): Promise<NoteWithTags> {
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_TAGS_SELECT)
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return flattenTags([data])[0]
}

// ---- Update a note ----
export async function updateNote(id: string, patch: NoteUpdate): Promise<Note> {
  const { data, error } = await supabase
    .from('notes')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as Note
}

// ---- Delete a note ----
export async function deleteNote(id: string): Promise<void> {
  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ---- Fetch notes in a folder (folderId=null → root/unassigned notes) ----
export async function fetchNotesByFolder(userId: string, folderId: string | null): Promise<NoteWithTags[]> {
  let query = supabase
    .from('notes')
    .select(NOTE_TAGS_SELECT)
    .eq('user_id', userId)
    .eq('is_template', false)
    .order('updated_at', { ascending: false })

  if (folderId === null) {
    query = query.is('folder_id', null)
  } else {
    query = query.eq('folder_id', folderId)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return flattenTags(data ?? [])
}

// ---- Fetch notes that have a specific tag ----
export async function fetchNotesByTag(userId: string, tagId: string): Promise<NoteWithTags[]> {
  const { data, error } = await supabase
    .from('notes_tags')
    .select(`
      note:notes(
        *,
        tags:notes_tags(
          tag:tags(*)
        )
      )
    `)
    .eq('tag_id', tagId)
    .eq('note.user_id', userId)
    .eq('note.is_template', false)

  if (error) throw new Error(error.message)

  // Unwrap the nested join: [{note: {...}}, ...]
  const notes = (data ?? [])
    .map((row: any) => row.note)
    .filter(Boolean) as Record<string, unknown>[]

  return flattenTags(notes)
}

// ---- Global Full-Text Search ----
export async function searchNotesGlobally(userId: string, query: string): Promise<NoteWithTags[]> {
  if (!query.trim()) return []
  
  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  let queryBuilder = supabase
    .from('notes')
    .select(NOTE_TAGS_SELECT)
    .eq('user_id', userId)
    .eq('is_template', false)
    
  // Her bir kelime için başlık VEYA içerikte geçme şartı (AND mantığıyla zincirlenir)
  for (const term of terms) {
    queryBuilder = queryBuilder.or(`title.ilike.%${term}%,content_markdown.ilike.%${term}%`)
  }

  const { data, error } = await queryBuilder
    .order('updated_at', { ascending: false })
    .limit(30)

  if (error) throw new Error(error.message)
  return flattenTags(data as Record<string, unknown>[])
}
