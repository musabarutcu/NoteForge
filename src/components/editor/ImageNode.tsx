import { useRef, useState, useEffect, useCallback } from 'react'
import { Trash2, GripVertical } from 'lucide-react'
import { updateMediaAssetPosition, type MediaAsset, type PositionData } from '@/features/notes/mediaService'
import { debounce } from '@/lib/utils'

/* ─── Constants ───────────────────────────────────────────── */
const MIN_W = 80
const MIN_H = 60
const HANDLE_SIZE = 10

/* ─── Resize handle positions ────────────────────────────── */
type HandlePos = 'nw' | 'ne' | 'sw' | 'se'
const HANDLES: HandlePos[] = ['nw', 'ne', 'sw', 'se']

const handleStyle = (pos: HandlePos): React.CSSProperties => {
  const base: React.CSSProperties = {
    position: 'absolute',
    width: HANDLE_SIZE, height: HANDLE_SIZE,
    backgroundColor: '#4D8DFF',
    border: '2px solid #fff',
    borderRadius: '2px',
    zIndex: 10,
  }
  if (pos === 'nw') return { ...base, top: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: 'nw-resize' }
  if (pos === 'ne') return { ...base, top: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: 'ne-resize' }
  if (pos === 'sw') return { ...base, bottom: -HANDLE_SIZE / 2, left: -HANDLE_SIZE / 2, cursor: 'sw-resize' }
  return       { ...base, bottom: -HANDLE_SIZE / 2, right: -HANDLE_SIZE / 2, cursor: 'se-resize' }
}

/* ─── Props ───────────────────────────────────────────────── */
interface ImageNodeProps {
  asset: MediaAsset
  containerWidth: number
  onDelete: (id: string) => void
}

/* ─── Component ───────────────────────────────────────────── */
export function ImageNode({ asset, containerWidth, onDelete }: ImageNodeProps) {
  const DEFAULT_W = Math.min(400, containerWidth * 0.8)
  const DEFAULT_H = 280

  const pd = asset.position_data
  const [pos, setPos] = useState<PositionData>({
    x: pd?.x ?? 0,
    y: pd?.y ?? 0,
    width: pd?.width ?? DEFAULT_W,
    height: pd?.height ?? DEFAULT_H,
  })
  const [selected, setSelected]   = useState(false)
  const [dragging, setDragging]   = useState(false)
  const [resizing, setResizing]   = useState<HandlePos | null>(null)

  const posRef     = useRef(pos)
  const dragStart  = useRef({ mx: 0, my: 0, ox: 0, oy: 0 })
  const resizeStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0, ow: 0, oh: 0 })
  const assetId    = asset.id

  posRef.current = pos

  // ── Debounced Supabase save ──────────────────────────────
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const persistPos = useCallback(
    debounce((p: PositionData) => {
      updateMediaAssetPosition(assetId, p).catch(console.error)
    }, 600),
    [assetId],
  )

  // ── Click outside → deselect ─────────────────────────────
  useEffect(() => {
    if (!selected) return
    const handler = (e: MouseEvent) => {
      const el = document.getElementById(`img-node-${assetId}`)
      if (el && !el.contains(e.target as Node)) setSelected(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [selected, assetId])

  // ── Drag (move) ──────────────────────────────────────────
  const onDragMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(true)
    setSelected(true)
    dragStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: posRef.current.x,
      oy: posRef.current.y,
    }
  }

  useEffect(() => {
    if (!dragging) return
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - dragStart.current.mx
      const dy = e.clientY - dragStart.current.my
      const next = { ...posRef.current, x: dragStart.current.ox + dx, y: dragStart.current.oy + dy }
      setPos(next)
      posRef.current = next
    }
    const onUp = () => {
      setDragging(false)
      persistPos(posRef.current)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [dragging, persistPos])

  // ── Resize ───────────────────────────────────────────────
  const onResizeMouseDown = (e: React.MouseEvent, handle: HandlePos) => {
    e.preventDefault()
    e.stopPropagation()
    setResizing(handle)
    setSelected(true)
    resizeStart.current = {
      mx: e.clientX,
      my: e.clientY,
      ox: posRef.current.x,
      oy: posRef.current.y,
      ow: posRef.current.width,
      oh: posRef.current.height,
    }
  }

  useEffect(() => {
    if (!resizing) return
    const { mx, my, ox, oy, ow, oh } = resizeStart.current
    const onMove = (e: MouseEvent) => {
      const dx = e.clientX - mx
      const dy = e.clientY - my
      let { x, y, width, height } = posRef.current

      if (resizing === 'se') {
        width  = Math.max(MIN_W, ow + dx)
        height = Math.max(MIN_H, oh + dy)
      } else if (resizing === 'sw') {
        width  = Math.max(MIN_W, ow - dx)
        height = Math.max(MIN_H, oh + dy)
        x      = ox + ow - width
      } else if (resizing === 'ne') {
        width  = Math.max(MIN_W, ow + dx)
        height = Math.max(MIN_H, oh - dy)
        y      = oy + oh - height
      } else if (resizing === 'nw') {
        width  = Math.max(MIN_W, ow - dx)
        height = Math.max(MIN_H, oh - dy)
        x      = ox + ow - width
        y      = oy + oh - height
      }

      const next: PositionData = { x, y, width, height }
      setPos(next)
      posRef.current = next
    }
    const onUp = () => {
      setResizing(null)
      persistPos(posRef.current)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [resizing, persistPos])

  return (
    <div
      id={`img-node-${assetId}`}
      onMouseDown={() => setSelected(true)}
      style={{
        position:   'absolute',
        left:       pos.x,
        top:        pos.y,
        width:      pos.width,
        height:     pos.height,
        userSelect: 'none',
        boxSizing:  'border-box',
        border:     selected ? '2px solid #4D8DFF' : '2px solid transparent',
        borderRadius: '4px',
        transition: dragging || resizing ? 'none' : 'border-color 150ms',
        cursor:     dragging ? 'grabbing' : 'default',
      }}
    >
      {/* Image */}
      <img
        src={asset.storage_url}
        alt={asset.file_name ?? 'Görsel'}
        draggable={false}
        style={{
          width: '100%', height: '100%',
          objectFit: 'cover', borderRadius: '2px', display: 'block',
        }}
      />

      {/* Overlay controls (visible when selected) */}
      {selected && (
        <>
          {/* Drag handle (top bar) */}
          <div
            onMouseDown={onDragMouseDown}
            title="Taşı"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0,
              height: '28px', cursor: 'grab',
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex', alignItems: 'center', paddingLeft: '8px', gap: '6px',
              borderRadius: '2px 2px 0 0',
            }}
          >
            <GripVertical size={14} color="#aaa" />
            <span style={{ fontSize: '11px', color: '#aaa', userSelect: 'none' }}>
              {Math.round(pos.width)} × {Math.round(pos.height)}
            </span>
          </div>

          {/* Delete button */}
          <button
            onMouseDown={e => { e.stopPropagation(); onDelete(assetId) }}
            title="Görseli sil"
            style={{
              position: 'absolute', top: 4, right: 4,
              width: 22, height: 22,
              backgroundColor: 'rgba(220,50,50,0.85)',
              border: 'none', borderRadius: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <Trash2 size={12} />
          </button>

          {/* Resize handles */}
          {HANDLES.map(h => (
            <div
              key={h}
              onMouseDown={e => onResizeMouseDown(e, h)}
              style={handleStyle(h)}
            />
          ))}
        </>
      )}
    </div>
  )
}
