import { useCallback, useEffect, useRef, useState } from 'react'
import type { Editor } from '@tiptap/react'
import { fetchCompletion, isAiConfigured, AiError } from '@/lib/aiService'

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error'

/** Yazma durduktan sonra öneri istenene kadar geçen süre. */
const IDLE_DELAY = 1400
/** Öneri istemek için imleçten önce olması gereken en az karakter. */
const MIN_CONTEXT = 12

interface Options {
  editor:  Editor | null
  enabled: boolean
}

/**
 * AI satır içi tamamlama (ghost text) yöneticisi.
 *
 * Kullanıcı yazmayı bıraktığında imlecin devamı için öneri ister ve
 * bunu `GhostText` uzantısına verir. Hata olursa uygulama çökmez; sadece
 * `status = 'error'` olur ve mesaj `error` alanında döner.
 */
export function useAiCompletion({ editor, enabled }: Options) {
  const [status, setStatus] = useState<AiStatus>('idle')
  const [error,  setError]  = useState<string | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelPending = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    abortRef.current?.abort()
    abortRef.current = null
  }, [])

  /** İmleç, öneri gösterilebilecek bir konumda mı? */
  const canSuggest = useCallback((ed: Editor): boolean => {
    const { state } = ed
    const { selection } = state
    if (!selection.empty) return false
    if (ed.isActive('codeBlock')) return false

    const { $from } = selection
    // Sadece metin bloğunun sonundayken öner — cümle ortasına sokuşturma.
    if (!$from.parent.isTextblock) return false
    if ($from.parentOffset !== $from.parent.content.size) return false

    return state.doc.textBetween(0, selection.from, '\n', ' ').trim().length >= MIN_CONTEXT
  }, [])

  const request = useCallback(async (ed: Editor) => {
    if (!isAiConfigured()) {
      setStatus('error')
      setError('API anahtarı tanımlı değil. .env.local içine VITE_GEMINI_API_KEY ekle.')
      return
    }
    if (!canSuggest(ed)) {
      setStatus('idle')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const startPos = ed.state.selection.from
    const before   = ed.state.doc.textBetween(0, startPos, '\n', ' ')

    setStatus('loading')
    setError(null)
    try {
      const suggestion = await fetchCompletion(before, controller.signal)
      if (controller.signal.aborted || ed.isDestroyed) return

      // İstek sürerken imleç oynadıysa öneriyi gösterme.
      if (!canSuggest(ed) || ed.state.selection.from !== startPos) return

      if (suggestion) {
        ed.commands.setGhostText(suggestion)
        setStatus('ready')
      } else {
        setStatus('idle')
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setStatus('error')
      setError(err instanceof AiError ? err.message : 'Metin tamamlama başarısız oldu.')
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [canSuggest])

  /** "AI" butonu — beklemeden hemen öneri iste. */
  const requestNow = useCallback(() => {
    if (!editor || editor.isDestroyed) return
    cancelPending()
    void request(editor)
  }, [editor, request, cancelPending])

  /* ── Yazma durduğunda otomatik öneri ─────────────────────── */
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    if (!enabled) {
      cancelPending()
      setStatus('idle')
      setError(null)
      if (!editor.isDestroyed) editor.commands.clearGhostText()
      return
    }

    const schedule = () => {
      cancelPending()
      setStatus('idle')
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        if (!editor.isDestroyed) void request(editor)
      }, IDLE_DELAY)
    }

    editor.on('update', schedule)
    return () => {
      editor.off('update', schedule)
      cancelPending()
    }
  }, [editor, enabled, request, cancelPending])

  useEffect(() => cancelPending, [cancelPending])

  const dismissError = useCallback(() => {
    setError(null)
    setStatus('idle')
  }, [])

  return { status, error, requestNow, dismissError, configured: isAiConfigured() }
}
