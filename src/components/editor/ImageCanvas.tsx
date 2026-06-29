import {
  useRef, useState, useEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import { ImageNode } from './ImageNode'
import {
  uploadNoteImage,
  createMediaAsset,
  fetchMediaAssets,
  deleteMediaAsset,
  type MediaAsset,
} from '@/features/notes/mediaService'

/* ─── Exposed handle ─────────────────────────────────────── */
export interface ImageCanvasHandle {
  triggerFileInput: () => void
}

interface ImageCanvasProps {
  noteId: string
  userId: string
}

export const ImageCanvas = forwardRef<ImageCanvasHandle, ImageCanvasProps>(
  function ImageCanvas({ noteId, userId }, ref) {
    const containerRef  = useRef<HTMLDivElement>(null)
    const fileInputRef  = useRef<HTMLInputElement>(null)

    const [assets, setAssets]       = useState<MediaAsset[]>([])
    const [uploading, setUploading] = useState(false)
    const [containerW, setContainerW] = useState(680)

    // ── Expose trigger to parent ─────────────────────────────
    useImperativeHandle(ref, () => ({
      triggerFileInput: () => fileInputRef.current?.click(),
    }))

    // ── Load existing images on mount ────────────────────────
    useEffect(() => {
      fetchMediaAssets(noteId).then(setAssets).catch(console.error)
    }, [noteId])

    // ── Track container width for default sizing ─────────────
    useEffect(() => {
      const el = containerRef.current
      if (!el) return
      const ro = new ResizeObserver(() => setContainerW(el.offsetWidth))
      ro.observe(el)
      return () => ro.disconnect()
    }, [])

    // ── Upload helper ────────────────────────────────────────
    const handleFiles = useCallback(async (files: FileList | null) => {
      if (!files || files.length === 0) return
      const images = Array.from(files).filter(f => f.type.startsWith('image/'))
      if (images.length === 0) return

      setUploading(true)
      try {
        for (const file of images) {
          const url   = await uploadNoteImage(userId, noteId, file)
          // Place each new image below the previous ones
          const yOffset = assets.length * 320 + 20
          const asset = await createMediaAsset({
            note_id:       noteId,
            type:          'image',
            storage_url:   url,
            file_name:     file.name,
            file_size:     file.size,
            position_data: {
              x:      20,
              y:      yOffset,
              width:  Math.min(480, containerW * 0.85),
              height: 300,
            },
          })
          setAssets(prev => [...prev, asset])
        }
      } catch (err) {
        console.error('Upload failed:', err)
      } finally {
        setUploading(false)
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }, [noteId, userId, assets.length, containerW])

    // ── Ctrl+V / paste ───────────────────────────────────────
    useEffect(() => {
      const handler = async (e: ClipboardEvent) => {
        const items = Array.from(e.clipboardData?.items ?? [])
        const imgItem = items.find(i => i.type.startsWith('image/'))
        if (!imgItem) return
        e.preventDefault()
        const file = imgItem.getAsFile()
        if (!file) return
        const dt = new DataTransfer()
        dt.items.add(file)
        await handleFiles(dt.files)
      }
      document.addEventListener('paste', handler)
      return () => document.removeEventListener('paste', handler)
    }, [handleFiles])

    // ── Delete ───────────────────────────────────────────────
    const handleDelete = async (id: string) => {
      setAssets(prev => prev.filter(a => a.id !== id))
      await deleteMediaAsset(id).catch(console.error)
    }

    // ── Canvas height = tallest asset bottom + padding ───────
    const totalHeight = assets.reduce((acc, a) => {
      const bottom = (a.position_data?.y ?? 0) + (a.position_data?.height ?? 300) + 40
      return Math.max(acc, bottom)
    }, 0)

    return (
      <div
        ref={containerRef}
        style={{
          position:   'relative',
          width:      '100%',
          minHeight:  assets.length > 0 ? Math.max(totalHeight, 100) : 0,
          marginTop:  assets.length > 0 ? '16px' : 0,
        }}
      >
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />

        {/* Uploading overlay */}
        {uploading && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            padding: '8px 12px', borderRadius: '8px',
            backgroundColor: 'rgba(77,141,255,0.08)',
            border: '1px solid #1E2E4A',
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#4D8DFF', fontSize: '13px',
          }}>
            <svg style={{ animation: 'spin 0.7s linear infinite', flexShrink: 0 }} width="14" height="14" viewBox="0 0 16 16">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" fill="none" strokeDasharray="20 18" />
            </svg>
            Görsel yükleniyor…
          </div>
        )}

        {/* Image nodes (absolutely positioned inside relative container) */}
        {assets.map(asset => (
          <ImageNode
            key={asset.id}
            asset={asset}
            containerWidth={containerW}
            onDelete={handleDelete}
          />
        ))}
      </div>
    )
  }
)
