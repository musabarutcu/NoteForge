import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { fetchTags, createTag, deleteTag } from './tagsService'
import type { Tag } from '@/types/database'

export function useTags() {
  const user = useAuthStore(s => s.user)
  const [tags,    setTags]    = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchTags(user.id)
      setTags(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load])

  const addTag = useCallback(async (name: string) => {
    if (!user) return null
    try {
      const tag = await createTag(user.id, name)
      setTags(prev => {
        if (prev.some(t => t.id === tag.id)) return prev
        return [...prev, tag].sort((a, b) => a.name.localeCompare(b.name))
      })
      return tag
    } catch { return null }
  }, [user])

  const removeTag = useCallback(async (id: string) => {
    try {
      await deleteTag(id)
      setTags(prev => prev.filter(t => t.id !== id))
    } catch { /* silent */ }
  }, [])

  return { tags, loading, addTag, removeTag, reload: load }
}
