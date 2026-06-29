import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'
import type { UserPreferences } from '@/types/database'

const FONT_FAMILIES: Record<string, string> = {
  'Inter':           "'Inter', -apple-system, sans-serif",
  'Merriweather':    "'Merriweather', Georgia, serif",
  'JetBrains Mono':  "'JetBrains Mono', 'Courier New', monospace",
  'Georgia':         "Georgia, 'Times New Roman', serif",
}

const THEME_TOKENS: Record<
  UserPreferences['theme'],
  { bg: string; text: string; surface: string; border: string }
> = {
  dark:  { bg: '#0D0D0D', text: '#E8E8E8', surface: '#111111', border: '#232323' },
  light: { bg: '#FAFAFA', text: '#111111', surface: '#F0F0F0', border: '#DDDDDD' },
  sepia: { bg: '#F8F3E8', text: '#3D2B1F', surface: '#EDE3D0', border: '#C8B89A' },
}

export function useApplyPreferences() {
  const preferences = useAuthStore(s => s.preferences)

  useEffect(() => {
    const root = document.documentElement
    const p = preferences

    // ── Typography ───────────────────────────────────────────
    const fontStack = FONT_FAMILIES[p?.font_family ?? 'Inter'] ?? FONT_FAMILIES['Inter']
    root.style.setProperty('--editor-font-family', fontStack)
    root.style.setProperty('--editor-font-size',   `${p?.font_size   ?? 16}px`)
    root.style.setProperty('--editor-line-height', `${p?.line_height ?? 1.6}`)

    const widthMap: Record<string, string> = {
      narrow: '600px',
      medium: '760px',
      full:   '100%',
    }
    root.style.setProperty('--editor-max-width', widthMap[p?.page_width ?? 'medium'])

    // ── Editor theme (only affects .editor-surface, NOT app chrome) ──
    const theme = THEME_TOKENS[p?.theme ?? 'dark']
    root.style.setProperty('--editor-bg',      theme.bg)
    root.style.setProperty('--editor-text',    theme.text)
    root.style.setProperty('--editor-surface', theme.surface)
    root.style.setProperty('--editor-border',  theme.border)
  }, [preferences])
}
