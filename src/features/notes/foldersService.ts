import { supabase } from '@/lib/supabase'
import type { Folder, FolderInsert } from '@/types/database'

// ---- Fetch all folders for a user ----
export async function fetchFolders(userId: string): Promise<Folder[]> {
  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .eq('user_id', userId)
    .order('name')
  if (error) throw new Error(error.message)
  return (data ?? []) as Folder[]
}

// ---- Create a folder ----
export async function createFolder(
  userId: string,
  name: string,
  parentId: string | null = null,
): Promise<Folder> {
  const payload: FolderInsert = { user_id: userId, name: name.trim(), parent_id: parentId }
  const { data, error } = await supabase
    .from('folders')
    .insert(payload)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Folder
}

// ---- Delete a folder (cascades children via ON DELETE CASCADE) ----
export async function deleteFolder(id: string): Promise<void> {
  const { error } = await supabase.from('folders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ---- Rename a folder ----
export async function updateFolderName(id: string, name: string): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .update({ name: name.trim() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data as Folder
}
