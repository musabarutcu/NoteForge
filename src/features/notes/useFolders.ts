import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'
import { fetchFolders, createFolder, deleteFolder } from './foldersService'
import type { Folder } from '@/types/database'

export function useFolders() {
  const user = useAuthStore(s => s.user)
  const [folders,  setFolders]  = useState<Folder[]>([])
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const data = await fetchFolders(user.id)
      setFolders(data)
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [user])

  useEffect(() => { load() }, [load])

  const addFolder = useCallback(async (
    name: string,
    parentId: string | null = null,
  ) => {
    if (!user) return null
    try {
      const folder = await createFolder(user.id, name, parentId)
      setFolders(prev => [...prev, folder].sort((a, b) => a.name.localeCompare(b.name)))
      return folder
    } catch { return null }
  }, [user])

  const removeFolder = useCallback(async (id: string) => {
    try {
      await deleteFolder(id)
      setFolders(prev => prev.filter(f => f.id !== id && f.parent_id !== id))
    } catch { /* silent */ }
  }, [])

  // Helpers for building the tree
  const rootFolders = folders.filter(f => f.parent_id === null)
  const childFolders = (parentId: string) =>
    folders.filter(f => f.parent_id === parentId)

  return { folders, loading, rootFolders, childFolders, addFolder, removeFolder, reload: load }
}
