import { useRef } from 'react'
import { Lock } from 'lucide-react'
import type { MediaAsset } from '@/features/notes/mediaService'
import {
  HANDLES, angleFrom, isCorner, resizeBox,
  type Box, type Handle,
} from './imageGeometry'

export type ChangeMode = 'drag' | 'resize' | 'rotate'

interface ImageNodeProps {
  asset: MediaAsset
  box: Box
  z: number
  opacity: number
  locked: boolean
  selected: boolean
  readOnly: boolean
  containerWidth: number
  onSelect: (id: string) => void
  onDeselect: () => void
  onChange: (id: string, box: Box, mode: ChangeMode, snap: boolean) => void
  onCommit: (id: string) => void
  onInteract: (active: boolean) => void
  onHud: (text: string | null) => void
  onNudge: (id: string, dx: number, dy: number) => void
  onZ: (id: string, dir: 'front' | 'back') => void
  onDelete: (id: string) => void
  onNaturalRatio: (id: string, ratio: number) => void
}

type Kind = 'drag' | 'resize' | 'rotate'

/** Sürüklerken imleç kaydırma alanının kenarına bu kadar yaklaşınca otomatik kaydır. */
const AUTOSCROLL_EDGE = 56
const DRAG_THRESHOLD = 3

export function ImageNode(props: ImageNodeProps) {
  const { asset, box, z, opacity, locked, selected, readOnly } = props
  const propsRef = useRef(props)
  propsRef.current = props
  const nodeRef = useRef<HTMLDivElement>(null)

  const begin = (e: React.PointerEvent, kind: Kind, handle?: Handle) => {
    const p = propsRef.current
    if (p.readOnly || e.button !== 0) return

    // Dokunmatikte seçili olmayan görsele ilk dokunuş yalnızca seçer,
    // böylece görselin üzerinden sayfa kaydırılabilir.
    if (e.pointerType === 'touch' && !p.selected && kind === 'drag') {
      p.onSelect(asset.id)
      return
    }

    e.preventDefault()
    e.stopPropagation()
    nodeRef.current?.focus({ preventScroll: true })
    p.onSelect(asset.id)
    if (p.locked) return

    const scrollEl = nodeRef.current?.closest('.editor-area') as HTMLElement | null
    const s = {
      startBox: p.box,
      px0: e.clientX,
      py0: e.clientY,
      scroll0: scrollEl?.scrollTop ?? 0,
      lastX: e.clientX,
      lastY: e.clientY,
      shift: e.shiftKey,
      alt: e.altKey,
      moved: kind !== 'drag',
      raf: 0,
    }
    if (s.moved) p.onInteract(true)

    const apply = () => {
      const cur = propsRef.current
      const dx = s.lastX - s.px0
      const dy = s.lastY - s.py0 + ((scrollEl?.scrollTop ?? 0) - s.scroll0)

      if (!s.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        s.moved = true
        cur.onInteract(true)
      }

      if (kind === 'drag') {
        cur.onChange(asset.id, { ...s.startBox, x: s.startBox.x + dx, y: s.startBox.y + dy }, 'drag', !s.alt)
      } else if (kind === 'resize' && handle) {
        // Köşeler oranı korur; Shift ile serbest boyutlandırma
        const next = resizeBox(s.startBox, handle, dx, dy, isCorner(handle) && !s.shift, cur.containerWidth)
        cur.onChange(asset.id, next, 'resize', false)
        cur.onHud(`${Math.round(next.width)} × ${Math.round(next.height)}`)
      } else if (kind === 'rotate' && nodeRef.current) {
        const r = nodeRef.current.getBoundingClientRect()
        const deg = angleFrom(r.left + r.width / 2, r.top + r.height / 2, s.lastX, s.lastY, s.shift)
        cur.onChange(asset.id, { ...cur.box, rotation: deg }, 'rotate', false)
        cur.onHud(`${Math.round(deg)}°`)
      }
    }

    const tick = () => {
      if (scrollEl && s.moved && kind !== 'rotate') {
        const r = scrollEl.getBoundingClientRect()
        let v = 0
        if (s.lastY < r.top + AUTOSCROLL_EDGE) v = -(r.top + AUTOSCROLL_EDGE - s.lastY) / 3
        else if (s.lastY > r.bottom - AUTOSCROLL_EDGE) v = (s.lastY - (r.bottom - AUTOSCROLL_EDGE)) / 3
        v = Math.max(-24, Math.min(24, v))
        if (Math.abs(v) >= 1) {
          const before = scrollEl.scrollTop
          scrollEl.scrollTop += v
          if (scrollEl.scrollTop !== before) apply()
        }
      }
      s.raf = requestAnimationFrame(tick)
    }

    const onMove = (ev: PointerEvent) => {
      s.lastX = ev.clientX
      s.lastY = ev.clientY
      s.shift = ev.shiftKey
      s.alt = ev.altKey
      apply()
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      cancelAnimationFrame(s.raf)
      const cur = propsRef.current
      cur.onHud(null)
      cur.onInteract(false)
      if (s.moved) cur.onCommit(asset.id)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    s.raf = requestAnimationFrame(tick)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const p = propsRef.current
    if (p.readOnly) return
    const mod = e.ctrlKey || e.metaKey
    const step = e.shiftKey ? 10 : 1
    let handled = true

    if (e.key === 'Delete' || e.key === 'Backspace') p.onDelete(asset.id)
    else if (e.key === 'Escape') { p.onDeselect(); nodeRef.current?.blur() }
    else if (mod && e.key === ']') p.onZ(asset.id, 'front')
    else if (mod && e.key === '[') p.onZ(asset.id, 'back')
    else if (!p.locked && e.key === 'ArrowLeft')  p.onNudge(asset.id, -step, 0)
    else if (!p.locked && e.key === 'ArrowRight') p.onNudge(asset.id, step, 0)
    else if (!p.locked && e.key === 'ArrowUp')    p.onNudge(asset.id, 0, -step)
    else if (!p.locked && e.key === 'ArrowDown')  p.onNudge(asset.id, 0, step)
    else handled = false

    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const editable = selected && !readOnly && !locked

  return (
    <div
      ref={nodeRef}
      data-image-node={asset.id}
      tabIndex={readOnly ? undefined : -1}
      role="img"
      aria-label={asset.file_name ?? 'Görsel'}
      onPointerDown={e => begin(e, 'drag')}
      onKeyDown={onKeyDown}
      className={
        'nf-img' +
        (selected && !readOnly ? ' is-selected' : '') +
        (locked ? ' is-locked' : '') +
        (readOnly ? ' is-readonly' : '')
      }
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        zIndex: z,
        transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
        touchAction: selected && !readOnly ? 'none' : 'pan-y',
      }}
    >
      <img
        src={asset.storage_url}
        alt={asset.file_name ?? 'Görsel'}
        draggable={false}
        style={{ opacity }}
        onLoad={e => {
          const img = e.currentTarget
          if (img.naturalWidth > 0) props.onNaturalRatio(asset.id, img.naturalHeight / img.naturalWidth)
        }}
      />

      {editable && (
        <>
          <div
            className="nf-img-rot"
            title="Döndür (Shift: 15° adım)"
            onPointerDown={e => begin(e, 'rotate')}
          />
          {HANDLES.map(h => (
            <div
              key={h}
              className={`nf-img-h nf-img-h--${h}`}
              onPointerDown={e => begin(e, 'resize', h)}
            />
          ))}
        </>
      )}

      {selected && locked && !readOnly && (
        <span className="nf-img-lock" title="Kilitli">
          <Lock size={11} />
        </span>
      )}
    </div>
  )
}
