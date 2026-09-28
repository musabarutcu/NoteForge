import {
  useRef, useState, useEffect, useLayoutEffect, useCallback,
  forwardRef, useImperativeHandle,
} from 'react'
import {
  BringToFront, SendToBack, Lock, LockOpen, Blend, AlignCenterHorizontal,
  StretchHorizontal, RotateCcw, Trash2, ImagePlus,
} from 'lucide-react'
import { ImageNode, type ChangeMode } from './ImageNode'
import {
  boundsOf, clampBox, snapMove, MAX_H, MIN_H,
  type Box, type Guides,
} from './imageGeometry'
import {
  uploadNoteImage,
  createMediaAsset,
  fetchMediaAssets,
  deleteMediaAsset,
  updateMediaAssetPosition,
  removeNoteImageFile,
  storagePathFromUrl,
  type MediaAsset,
  type PositionData,
} from '@/features/notes/mediaService'
import type { ExportImage, ExportLayout } from '@/lib/exportNote'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
const MAX_FILE_SIZE = 10 * 1024 * 1024
/** Görsellerin altında bırakılan boşluk (not alanı bu kadar uzar). */
const BOTTOM_GAP = 48

interface Layout { cw: number; padL: number; padR: number }
type FullPosition = Required<Omit<PositionData, 'layer' | 'fitRestore'>> & {
  layer: 'overlay'
  fitRestore: Box | null
}

function normalize(pd: PositionData | null, index: number): FullPosition {
  return {
    x: pd?.x ?? 24,
    y: pd?.y ?? 24,
    width: pd?.width ?? 320,
    height: pd?.height ?? 220,
    rotation: pd?.rotation ?? 0,
    z: pd?.z ?? index + 1,
    opacity: pd?.opacity ?? 1,
    locked: pd?.locked ?? false,
    layer: 'overlay',
    fitRestore: pd?.fitRestore ?? null,
  }
}

const boxOf = (p: FullPosition): Box =>
  ({ x: p.x, y: p.y, width: p.width, height: p.height, rotation: p.rotation })

function readImageAspectRatio(file: File): Promise<number> {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 0.7)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0.7)
    }
    img.src = url
  })
}

/* ─── Exposed handle ─────────────────────────────────────── */
export interface ImageCanvasHandle {
  triggerFileInput: () => void
  /** Görselleri metin sütununun (ProseMirror kökü) sol üstüne göre döndürür. */
  getExportData: () => {
    images: Omit<ExportImage, 'afterBlock'>[]
    layout: ExportLayout
  } | null
}

interface ImageCanvasProps {
  noteId: string
  userId: string
  readOnly?: boolean
  onError?: (message: string) => void
}

type Item = MediaAsset & { pos: FullPosition }

/**
 * Notun tamamını kaplayan, metinden bağımsız görsel katmanı.
 * Koordinatlar `.editor-content` kutusunun sol üst köşesine göredir.
 */
export const ImageCanvas = forwardRef<ImageCanvasHandle, ImageCanvasProps>(
  function ImageCanvas({ noteId, userId, readOnly = false, onError }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const toolbarRef   = useRef<HTMLDivElement>(null)

    const [items, setItems]           = useState<Item[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [interacting, setInteracting] = useState(false)
    const [hud, setHud]               = useState<string | null>(null)
    const [guides, setGuides]         = useState<Guides | null>(null)
    const [uploading, setUploading]   = useState(0)
    const [dropActive, setDropActive] = useState(false)
    const [layout, setLayout]         = useState<Layout>({ cw: 680, padL: 24, padR: 24 })
    const [toolbarW, setToolbarW]     = useState(0)

    const itemsRef   = useRef(items)
    const layoutRef  = useRef(layout)
    layoutRef.current = layout
    const ratiosRef  = useRef(new Map<string, number>())
    const pendingRef = useRef(new Map<string, { timer: ReturnType<typeof setTimeout>; pos: FullPosition }>())
    const onErrorRef = useRef(onError)
    onErrorRef.current = onError

    const commitItems = useCallback((next: Item[]) => {
      itemsRef.current = next
      setItems(next)
    }, [])

    /* ─── Kalıcılık ────────────────────────────────────────── */
    const flush = useCallback((id: string) => {
      const p = pendingRef.current.get(id)
      if (!p) return
      clearTimeout(p.timer)
      pendingRef.current.delete(id)
      updateMediaAssetPosition(id, p.pos).catch(() =>
        onErrorRef.current?.('Görsel konumu kaydedilemedi.'))
    }, [])

    const schedulePersist = useCallback((id: string, pos: FullPosition, delay: number) => {
      const prev = pendingRef.current.get(id)
      if (prev) clearTimeout(prev.timer)
      const timer = setTimeout(() => flush(id), delay)
      pendingRef.current.set(id, { timer, pos })
    }, [flush])

    // Not değişirken / sayfadan çıkarken bekleyen kayıtları gönder
    useEffect(() => {
      const pending = pendingRef.current
      return () => { for (const id of [...pending.keys()]) flush(id) }
    }, [flush])

    const patch = useCallback((id: string, part: Partial<FullPosition>, persist: 'none' | 'soon' | 'now') => {
      const cur = itemsRef.current.find(i => i.id === id)
      if (!cur) return
      const pos = { ...cur.pos, ...part }
      commitItems(itemsRef.current.map(i => (i.id === id ? { ...i, pos } : i)))
      if (persist !== 'none') schedulePersist(id, pos, persist === 'now' ? 0 : 400)
    }, [commitItems, schedulePersist])

    /* ─── Ölçüler ──────────────────────────────────────────── */
    const measure = useCallback(() => {
      const el = containerRef.current
      const parent = el?.parentElement
      if (!el || !parent) return
      const cs = getComputedStyle(parent)
      const next = {
        cw: el.getBoundingClientRect().width,
        padL: parseFloat(cs.paddingLeft) || 0,
        padR: parseFloat(cs.paddingRight) || 0,
      }
      const prev = layoutRef.current
      if (prev.cw === next.cw && prev.padL === next.padL && prev.padR === next.padR) return
      layoutRef.current = next
      setLayout(next)
    }, [])

    useLayoutEffect(() => {
      const el = containerRef.current
      if (!el) return
      measure()
      const ro = new ResizeObserver(measure)
      ro.observe(el)
      return () => ro.disconnect()
    }, [measure])

    // Alan daralırsa (pencere/mobil döndürme) görselleri içeride tut
    useEffect(() => {
      let changed = false
      const next = itemsRef.current.map(i => {
        const b = clampBox(boxOf(i.pos), layout.cw)
        if (Math.abs(b.x - i.pos.x) < 0.5 && Math.abs(b.y - i.pos.y) < 0.5) return i
        changed = true
        const pos = { ...i.pos, x: b.x, y: b.y }
        schedulePersist(i.id, pos, 400)
        return { ...i, pos }
      })
      if (changed) commitItems(next)
    }, [layout.cw, commitItems, schedulePersist])

    // Not alanını en alttaki görseli kapsayacak kadar uzat. Sayfanın tamamını
    // her karede yeniden çizdirmemek için doğrudan DOM'a yazılır.
    useLayoutEffect(() => {
      const parent = containerRef.current?.parentElement
      if (!parent) return
      const bottom = items.reduce((acc, i) => Math.max(acc, boundsOf(boxOf(i.pos)).bottom), 0)
      parent.style.minHeight = items.length ? `${Math.ceil(bottom + BOTTOM_GAP)}px` : ''
    }, [items])

    useEffect(() => {
      const parent = containerRef.current?.parentElement
      return () => { if (parent) parent.style.minHeight = '' }
    }, [])

    /* ─── Yükle + eski koordinatları dönüştür ──────────────── */
    useEffect(() => {
      let cancelled = false
      fetchMediaAssets(noteId)
        .then(assets => {
          if (cancelled) return
          // Eski sistemde görseller metnin altındaki ayrı bir bloktaydı;
          // aynı yerde görünmeleri için o bloğun başlangıcını ekle.
          const layer = containerRef.current
          const pm = layer?.parentElement?.querySelector('.tiptap-editor')
          const legacyTop = layer && pm
            ? pm.getBoundingClientRect().bottom - layer.getBoundingClientRect().top + 16
            : 0
          const legacyLeft = layoutRef.current.padL

          const next = assets.map((a, idx) => {
            const pos = normalize(a.position_data, idx)
            if (a.position_data && !a.position_data.layer) {
              pos.x += legacyLeft
              pos.y += legacyTop
              Object.assign(pos, clampBox(boxOf(pos), layoutRef.current.cw))
              schedulePersist(a.id, pos, 0)
            }
            return { ...a, pos }
          })
          commitItems(next)
        })
        .catch(() => onErrorRef.current?.('Görseller yüklenemedi.'))
      return () => { cancelled = true }
    }, [noteId, commitItems, schedulePersist])

    /* ─── Seçim ────────────────────────────────────────────── */
    useEffect(() => {
      if (!selectedId) return
      const onDown = (e: PointerEvent) => {
        const t = e.target as HTMLElement | null
        if (t?.closest('[data-image-node], [data-image-toolbar]')) return
        setSelectedId(null)
      }
      document.addEventListener('pointerdown', onDown)
      return () => document.removeEventListener('pointerdown', onDown)
    }, [selectedId])

    useEffect(() => { if (readOnly) setSelectedId(null) }, [readOnly])

    /* ─── Yeni görsel yerleşimi ────────────────────────────── */
    const placeNew = useCallback((aspect: number, index: number, point?: { x: number; y: number }): FullPosition => {
      const { cw, padL, padR } = layoutRef.current
      const width  = Math.max(120, Math.min(480, (cw - padL - padR) * 0.9))
      const height = Math.min(640, Math.max(MIN_H, Math.round(width * aspect)))
      const maxZ   = itemsRef.current.reduce((m, i) => Math.max(m, i.pos.z), 0)
      const offset = index * 24

      let x: number
      let y: number
      if (point) {
        x = point.x - width / 2 + offset
        y = point.y - height / 2 + offset
      } else {
        // Ekranda o an görünen alanın ortasına koy
        const layer = containerRef.current
        const area  = layer?.closest('.editor-area') as HTMLElement | null
        const lr = layer?.getBoundingClientRect()
        const ar = area?.getBoundingClientRect()
        const visTop = lr && ar ? Math.max(0, ar.top - lr.top) : 0
        const visH   = ar ? ar.height : 600
        x = (cw - width) / 2 + offset
        y = visTop + Math.max(24, (visH - height) / 2) + offset
      }
      const b = clampBox({ x, y, width, height, rotation: 0 }, cw)
      return { ...b, z: maxZ + 1 + index, opacity: 1, locked: false, layer: 'overlay', fitRestore: null }
    }, [])

    const handleFiles = useCallback(async (files: FileList | File[] | null, point?: { x: number; y: number }) => {
      if (!files || readOnly) return
      const list = Array.from(files)
      const images = list.filter(f => ALLOWED_TYPES.includes(f.type))
      if (images.length < list.length) {
        onErrorRef.current?.('Yalnızca JPG, PNG, GIF, WEBP veya SVG görseller eklenebilir.')
      }
      const ok = images.filter(f => f.size <= MAX_FILE_SIZE)
      if (ok.length < images.length) onErrorRef.current?.('Görsel boyutu en fazla 10 MB olabilir.')
      if (ok.length === 0) return

      setUploading(n => n + ok.length)
      await Promise.all(ok.map(async (file, index) => {
        let url: string | null = null
        try {
          const [uploadedUrl, aspect] = await Promise.all([
            uploadNoteImage(userId, noteId, file),
            readImageAspectRatio(file),
          ])
          url = uploadedUrl
          const pos = placeNew(aspect, index, point)
          const asset = await createMediaAsset({
            note_id:       noteId,
            type:          'image',
            storage_url:   url,
            file_name:     file.name,
            file_size:     file.size,
            position_data: pos,
          })
          ratiosRef.current.set(asset.id, aspect)
          commitItems([...itemsRef.current, { ...asset, pos }])
          setSelectedId(asset.id)
        } catch {
          // Dosya yüklendi ama kaydı oluşturulamadıysa Storage'da sahipsiz kalmasın
          const path = url ? storagePathFromUrl(url) : null
          if (path) void removeNoteImageFile(path)
          onErrorRef.current?.(`"${file.name}" yüklenemedi.`)
        } finally {
          setUploading(n => n - 1)
        }
      }))
      if (fileInputRef.current) fileInputRef.current.value = ''
    }, [noteId, userId, readOnly, placeNew, commitItems])

    useImperativeHandle(ref, () => ({
      triggerFileInput: () => fileInputRef.current?.click(),
      getExportData: () => {
        const layer = containerRef.current
        const parent = layer?.parentElement
        const pm = parent?.querySelector('.tiptap-editor')
        if (!layer || !parent || !pm) return null
        const lr = layer.getBoundingClientRect()
        const pr = pm.getBoundingClientRect()
        const ox = pr.left - lr.left
        const oy = pr.top - lr.top
        const padTop = parseFloat(getComputedStyle(parent).paddingTop) || 0
        const pcs = getComputedStyle(pm)
        const fontSize = parseFloat(pcs.fontSize) || 16
        const lineHeightPx = parseFloat(pcs.lineHeight)
        return {
          images: [...itemsRef.current]
            .sort((a, b) => a.pos.z - b.pos.z)
            .map(i => ({
              url: i.storage_url,
              name: i.file_name ?? 'görsel',
              x: i.pos.x - ox,
              y: i.pos.y - oy,
              width: i.pos.width,
              height: i.pos.height,
              rotation: i.pos.rotation,
              opacity: i.pos.opacity,
            })),
          layout: {
            textWidth: pr.width,
            padL: ox,
            padR: lr.width - ox - pr.width,
            padTop,
            headerHeight: oy,
            typography: {
              fontFamily: pcs.fontFamily,
              fontSize,
              lineHeight: Number.isFinite(lineHeightPx) ? lineHeightPx / fontSize : 1.6,
            },
            fontLinks: Array.from(
              document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href*="fonts.googleapis.com"]'),
            ).map(l => l.href),
          },
        }
      },
    }))

    /* ─── Yapıştır (Ctrl+V) ────────────────────────────────── */
    useEffect(() => {
      if (readOnly) return
      const handler = (e: ClipboardEvent) => {
        const files = Array.from(e.clipboardData?.items ?? [])
          .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
          .map(i => i.getAsFile())
          .filter((f): f is File => !!f)
        if (files.length === 0) return
        e.preventDefault()
        void handleFiles(files)
      }
      document.addEventListener('paste', handler)
      return () => document.removeEventListener('paste', handler)
    }, [handleFiles, readOnly])

    /* ─── Sürükle-bırak ile dosyadan ekleme ───────────────── */
    useEffect(() => {
      if (readOnly) return
      const area = containerRef.current?.closest('.editor-area') as HTMLElement | null
      if (!area) return
      let depth = 0
      const hasFiles = (e: DragEvent) => Array.from(e.dataTransfer?.types ?? []).includes('Files')

      const onEnter = (e: DragEvent) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        depth++
        setDropActive(true)
      }
      const onOver = (e: DragEvent) => {
        if (!hasFiles(e)) return
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      }
      const onLeave = (e: DragEvent) => {
        if (!hasFiles(e)) return
        depth = Math.max(0, depth - 1)
        if (depth === 0) setDropActive(false)
      }
      const onDrop = (e: DragEvent) => {
        if (!hasFiles(e)) return
        // Capture aşamasında durdur ki ProseMirror dosyayı işlemesin
        e.preventDefault()
        e.stopPropagation()
        depth = 0
        setDropActive(false)
        const r = containerRef.current?.getBoundingClientRect()
        const point = r ? { x: e.clientX - r.left, y: e.clientY - r.top } : undefined
        void handleFiles(e.dataTransfer?.files ?? null, point)
      }

      area.addEventListener('dragenter', onEnter, true)
      area.addEventListener('dragover', onOver, true)
      area.addEventListener('dragleave', onLeave, true)
      area.addEventListener('drop', onDrop, true)
      return () => {
        area.removeEventListener('dragenter', onEnter, true)
        area.removeEventListener('dragover', onOver, true)
        area.removeEventListener('dragleave', onLeave, true)
        area.removeEventListener('drop', onDrop, true)
      }
    }, [handleFiles, readOnly])

    /* ─── Etkileşim geri çağrıları ─────────────────────────── */
    const snapTargets = useCallback((id: string) => {
      const { cw, padL, padR } = layoutRef.current
      const xs = [0, padL, cw / 2, cw - padR, cw]
      const ys: number[] = []
      for (const i of itemsRef.current) {
        if (i.id === id) continue
        const b = boundsOf(boxOf(i.pos))
        xs.push(b.left, b.cx, b.right)
        ys.push(b.top, b.cy, b.bottom)
      }
      return { xs, ys }
    }, [])

    const handleChange = useCallback((id: string, raw: Box, mode: ChangeMode, snap: boolean) => {
      const { cw } = layoutRef.current
      let box = raw
      let g: Guides | null = null
      if (mode === 'drag') {
        if (snap) {
          const t = snapTargets(id)
          const r = snapMove(box, t.xs, t.ys)
          box = r.box
          g = r.guides.v.length || r.guides.h.length ? r.guides : null
        }
        box = clampBox(box, cw)
      } else if (mode === 'rotate' || box.rotation !== 0) {
        box = clampBox(box, cw)
      }
      setGuides(g)
      // Elle boyutlandırma/döndürme "sığdır"ı bozar; geri alma kaydı artık geçersiz
      patch(id, mode === 'drag' ? box : { ...box, fitRestore: null }, 'none')
    }, [patch, snapTargets])

    const handleCommit = useCallback((id: string) => {
      setGuides(null)
      const cur = itemsRef.current.find(i => i.id === id)
      if (cur) schedulePersist(id, cur.pos, 0)
    }, [schedulePersist])

    const handleNudge = useCallback((id: string, dx: number, dy: number) => {
      const cur = itemsRef.current.find(i => i.id === id)
      if (!cur) return
      const b = boxOf(cur.pos)
      const next = clampBox({ ...b, x: b.x + dx, y: b.y + dy }, layoutRef.current.cw)
      patch(id, { x: next.x, y: next.y }, 'soon')
    }, [patch])

    const handleZ = useCallback((id: string, dir: 'front' | 'back') => {
      const all = itemsRef.current
      const cur = all.find(i => i.id === id)
      if (!cur || all.length < 2) return
      const others = all.filter(i => i.id !== id).map(i => i.pos.z)
      if (dir === 'front') {
        const max = Math.max(...others)
        if (cur.pos.z > max) return
        patch(id, { z: max + 1 }, 'now')
      } else {
        const min = Math.min(...others)
        if (cur.pos.z < min) return
        patch(id, { z: min - 1 }, 'now')
      }
    }, [patch])

    const handleDelete = useCallback(async (id: string) => {
      const asset = itemsRef.current.find(a => a.id === id)
      const pending = pendingRef.current.get(id)
      if (pending) { clearTimeout(pending.timer); pendingRef.current.delete(id) }
      commitItems(itemsRef.current.filter(a => a.id !== id))
      setSelectedId(s => (s === id ? null : s))
      const storagePath = asset ? storagePathFromUrl(asset.storage_url) : null
      await deleteMediaAsset(id, storagePath).catch(() => onErrorRef.current?.('Görsel silinemedi.'))
    }, [commitItems])

    const handleNaturalRatio = useCallback((id: string, ratio: number) => {
      ratiosRef.current.set(id, ratio)
    }, [])

    /* ─── Araç çubuğu eylemleri ────────────────────────────── */
    const selected = items.find(i => i.id === selectedId) ?? null

    const resetShape = () => {
      if (!selected) return
      const ratio = ratiosRef.current.get(selected.id)
      const b = boxOf(selected.pos)
      const height = ratio ? Math.min(MAX_H, Math.max(MIN_H, b.width * ratio)) : b.height
      const cy = b.y + b.height / 2
      const next = clampBox({ ...b, rotation: 0, height, y: cy - height / 2 }, layout.cw)
      patch(selected.id, { ...next, fitRestore: null }, 'now')
    }

    const centerH = () => {
      if (!selected) return
      const b = boxOf(selected.pos)
      patch(selected.id, { x: (layout.cw - b.width) / 2 }, 'now')
    }

    /** Sayfa genişliğine sığdır ↔ önceki boyuta dön */
    const toggleFitWidth = () => {
      if (!selected) return
      const cur = selected.pos
      if (cur.fitRestore) {
        const back = clampBox(cur.fitRestore, layout.cw)
        patch(selected.id, { ...back, fitRestore: null }, 'now')
        return
      }
      const ratio = ratiosRef.current.get(selected.id) ?? cur.height / cur.width
      const width = Math.max(120, layout.cw - layout.padL - layout.padR)
      const height = Math.min(MAX_H, Math.max(MIN_H, width * ratio))
      const next = clampBox({ ...boxOf(cur), x: layout.padL, width, height, rotation: 0 }, layout.cw)
      patch(selected.id, { ...next, fitRestore: boxOf(cur) }, 'now')
    }

    useLayoutEffect(() => {
      if (toolbarRef.current) setToolbarW(toolbarRef.current.offsetWidth)
    }, [selectedId, selected?.pos.locked])

    const toolbarPos = (() => {
      if (!selected) return null
      const b = boundsOf(boxOf(selected.pos))
      const left = Math.min(Math.max(b.cx - toolbarW / 2, 0), Math.max(0, layout.cw - toolbarW))
      return { left, top: b.bottom + 12 }
    })()

    const sorted = [...items].sort((a, b) => a.pos.z - b.pos.z)

    return (
      <div
        ref={containerRef}
        className={'nf-image-layer' + (dropActive ? ' is-drop' : '')}
        aria-label="Görsel katmanı"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          multiple
          hidden
          onChange={e => void handleFiles(e.target.files)}
        />

        {sorted.map((item, idx) => (
          <ImageNode
            key={item.id}
            asset={item}
            box={boxOf(item.pos)}
            z={idx + 1}
            opacity={item.pos.opacity}
            locked={item.pos.locked}
            selected={item.id === selectedId}
            readOnly={readOnly}
            containerWidth={layout.cw}
            onSelect={id => {
              // Kaydırma çubuğu belirince genişlik değişebilir; RO gecikebilir
              measure()
              setSelectedId(id)
            }}
            onDeselect={() => setSelectedId(null)}
            onChange={handleChange}
            onCommit={handleCommit}
            onInteract={setInteracting}
            onHud={setHud}
            onNudge={handleNudge}
            onZ={handleZ}
            onDelete={id => void handleDelete(id)}
            onNaturalRatio={handleNaturalRatio}
          />
        ))}

        {/* Hizalama kılavuzları */}
        {guides?.v.map(x => (
          <div key={`v${x}`} className="nf-img-guide nf-img-guide--v" style={{ left: x }} />
        ))}
        {guides?.h.map(y => (
          <div key={`h${y}`} className="nf-img-guide nf-img-guide--h" style={{ top: y }} />
        ))}

        {/* Boyut / açı göstergesi */}
        {hud && toolbarPos && (
          <div className="nf-img-hud" style={{ left: toolbarPos.left, top: toolbarPos.top }}>{hud}</div>
        )}

        {/* Seçili görsel araç çubuğu */}
        {selected && !readOnly && !interacting && toolbarPos && (
          <div
            ref={toolbarRef}
            data-image-toolbar
            className="nf-img-toolbar"
            style={{ left: toolbarPos.left, top: toolbarPos.top, zIndex: items.length + 10 }}
            onPointerDown={e => e.stopPropagation()}
          >
            {!selected.pos.locked && (
              <>
                <ToolBtn title="Öne getir (Ctrl+])" onClick={() => handleZ(selected.id, 'front')}>
                  <BringToFront size={14} />
                </ToolBtn>
                <ToolBtn title="Arkaya gönder (Ctrl+[)" onClick={() => handleZ(selected.id, 'back')}>
                  <SendToBack size={14} />
                </ToolBtn>
                <span className="nf-img-toolbar-sep" />
                <ToolBtn title="Yatayda ortala" onClick={centerH}>
                  <AlignCenterHorizontal size={14} />
                </ToolBtn>
                <ToolBtn
                  title={selected.pos.fitRestore ? 'Önceki boyutuna döndür' : 'Sayfa genişliğine sığdır'}
                  active={!!selected.pos.fitRestore}
                  onClick={toggleFitWidth}
                >
                  <StretchHorizontal size={14} />
                </ToolBtn>
                <ToolBtn title="Orijinal oran ve açıya döndür" onClick={resetShape}>
                  <RotateCcw size={14} />
                </ToolBtn>
                <span className="nf-img-toolbar-sep" />
                <label className="nf-img-opacity" title="Saydamlık">
                  <Blend size={14} />
                  <input
                    type="range"
                    min={10}
                    max={100}
                    step={5}
                    value={Math.round(selected.pos.opacity * 100)}
                    onChange={e => patch(selected.id, { opacity: Number(e.target.value) / 100 }, 'soon')}
                    aria-label="Saydamlık"
                  />
                  <span>{Math.round(selected.pos.opacity * 100)}%</span>
                </label>
                <span className="nf-img-toolbar-sep" />
              </>
            )}
            <ToolBtn
              title={selected.pos.locked ? 'Kilidi aç' : 'Konumu kilitle'}
              active={selected.pos.locked}
              onClick={() => patch(selected.id, { locked: !selected.pos.locked }, 'now')}
            >
              {selected.pos.locked ? <LockOpen size={14} /> : <Lock size={14} />}
            </ToolBtn>
            <ToolBtn title="Görseli sil (Delete)" danger onClick={() => void handleDelete(selected.id)}>
              <Trash2 size={14} />
            </ToolBtn>
          </div>
        )}

        {/* Dosya bırakma ipucu */}
        {dropActive && (
          <div className="nf-img-status">
            <ImagePlus size={14} />
            Görseli notta istediğin yere bırak
          </div>
        )}

        {uploading > 0 && (
          <div className="nf-img-status" role="status">
            <span className="nf-img-spinner" />
            Görsel yükleniyor…
          </div>
        )}
      </div>
    )
  },
)

function ToolBtn({
  title, onClick, active, danger, children,
}: {
  title: string
  onClick: () => void
  active?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={
        'nf-img-toolbar-btn' +
        (active ? ' is-active' : '') +
        (danger ? ' is-danger' : '')
      }
    >
      {children}
    </button>
  )
}
