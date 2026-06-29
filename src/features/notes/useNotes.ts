import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { fetchNotes, fetchNotesByFolder, fetchNotesByTag, createNote, deleteNote } from './notesService'
import type { NoteWithTags } from '@/types/database'

interface UseNotesOptions {
  /** If set, only load notes in this folder */
  folderId?: string | null
  /** If set, only load notes with this tag */
  tagId?: string | null
}

export function useNotes(opts: UseNotesOptions = {}) {
  const { folderId, tagId } = opts
  const user = useAuthStore(s => s.user)
  const [notes, setNotes]     = useState<NoteWithTags[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    try {
      let data: NoteWithTags[]
      if (tagId) {
        data = await fetchNotesByTag(user.id, tagId)
      } else if (folderId !== undefined) {
        // folderId=null means "root / no folder", folderId=string means specific folder
        data = await fetchNotesByFolder(user.id, folderId ?? null)
      } else {
        data = await fetchNotes(user.id)
      }
      setNotes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Notlar yüklenemedi.')
    } finally {
      setLoading(false)
    }
  }, [user, folderId, tagId])

  useEffect(() => { load() }, [load])

  const addNote = useCallback(async (targetFolderId?: string | null) => {
    if (!user) return null
    try {
      const note = await createNote(user.id, targetFolderId)
      await load()
      return note
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Not oluşturulamadı.')
      return null
    }
  }, [user, load])

  const removeNote = useCallback(async (id: string) => {
    try {
      await deleteNote(id)
      setNotes(prev => prev.filter(n => n.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Not silinemedi.')
    }
  }, [])

  return { notes, loading, error, reload: load, addNote, removeNote }
}
