import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format a date relative to now (Turkish) */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const now  = new Date()
  const diff = now.getTime() - date.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours   = Math.floor(minutes / 60)
  const days    = Math.floor(hours   / 24)
  const weeks   = Math.floor(days    / 7)
  const months  = Math.floor(days    / 30)

  if (seconds < 60)  return 'Az önce'
  if (minutes < 60)  return `${minutes} dakika önce`
  if (hours   < 24)  return `${hours} saat önce`
  if (days    === 1) return 'Dün'
  if (days    < 7)   return `${days} gün önce`
  if (weeks   === 1) return '1 hafta önce'
  if (weeks   < 4)   return `${weeks} hafta önce`
  if (months  === 1) return '1 ay önce'
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Truncate a string to maxLength with ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength).trimEnd() + '…'
}

/** Generate initials from a display name */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Debounce a function */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
