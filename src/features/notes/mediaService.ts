import { supabase } from '@/lib/supabase'

export interface MediaAsset {
  id: string
  note_id: string
  type: 'image' | 'pdf'
  storage_url: string
  file_name: string | null
  file_size: number | null
  position_data: PositionData | null
  created_at: string
}

export interface PositionData {
  x: number
  y: number
  width: number
  height: number
}

// ── Upload image to Supabase Storage ──────────────────────────
export async function uploadNoteImage(
  userId: string,
  noteId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${userId}/${noteId}/${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from('note-images')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (error) throw new Error(`Storage upload failed: ${error.message}`)

  const { data } = supabase.storage.from('note-images').getPublicUrl(path)
  return data.publicUrl
}

// ── Insert media_asset record ──────────────────────────────────
export async function createMediaAsset(payload: {
  note_id: string
  type: 'image' | 'pdf'
  storage_url: string
  file_name?: string
  file_size?: number
  position_data?: PositionData
}): Promise<MediaAsset> {
  const { data, error } = await supabase
    .from('media_assets')
    .insert(payload)
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as MediaAsset
}

// ── Fetch all media_assets for a note ─────────────────────────
export async function fetchMediaAssets(noteId: string): Promise<MediaAsset[]> {
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('note_id', noteId)
    .eq('type', 'image')
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as MediaAsset[]
}

// ── Update position/size of a media_asset ─────────────────────
export async function updateMediaAssetPosition(
  id: string,
  position_data: PositionData,
): Promise<void> {
  const { error } = await supabase
    .from('media_assets')
    .update({ position_data })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

// ── Delete a media_asset record (and optionally its file) ─────
export async function deleteMediaAsset(id: string, storagePath?: string): Promise<void> {
  if (storagePath) {
    await supabase.storage.from('note-images').remove([storagePath])
  }
  const { error } = await supabase.from('media_assets').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
