import { useEffect, useRef } from 'react'

/**
 * Yatay kaydırılan bir alanın hangi yönde devamı olduğunu
 * `data-overflow="left | right | both | none"` olarak elemana yazar.
 *
 * CSS tarafında `.nf-scroll-x[data-overflow='...']` kuralları bu değeri
 * kenar solmasına (mask) çevirir — böylece kullanıcı ekranda görünmeyen
 * içerik olduğunu anlar.
 *
 * @param deps Ölçümün yeniden yapılması gereken durumlar (örn. içerik yüklendi)
 */
export function useOverflowAffordance<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const guncelle = () => {
      const sol = el.scrollLeft > 2
      const sag = el.scrollLeft + el.clientWidth < el.scrollWidth - 2
      el.dataset.overflow = sol && sag ? 'both' : sol ? 'left' : sag ? 'right' : 'none'
    }

    guncelle()
    el.addEventListener('scroll', guncelle, { passive: true })

    const ro = new ResizeObserver(guncelle)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)

    return () => {
      el.removeEventListener('scroll', guncelle)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
