/**
 * NoteForge — Ghost Text (AI satır içi tamamlama) TipTap uzantısı
 *
 * AI önerisi belgeye YAZILMAZ; imlecin sağında bir ProseMirror widget
 * decoration olarak soluk renkte gösterilir.
 *   • Tab    → öneriyi kabul et (metne yazar)
 *   • Escape → öneriyi reddet
 *   • Yazmaya devam etmek / imleci oynatmak da öneriyi temizler.
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorState } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface GhostTextState {
  text: string | null
  pos:  number | null
}

export const ghostTextPluginKey = new PluginKey<GhostTextState>('noteforgeGhostText')

const EMPTY: GhostTextState = { text: null, pos: null }

/** Editörde şu an bekleyen ghost text (yoksa `{ text: null }`). */
export function getGhostText(state: EditorState): GhostTextState {
  return ghostTextPluginKey.getState(state) ?? EMPTY
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    ghostText: {
      /** İmlecin bulunduğu yerde bir AI önerisi göster. */
      setGhostText: (text: string) => ReturnType
      /** Bekleyen öneriyi kaldır. */
      clearGhostText: () => ReturnType
      /** Bekleyen öneriyi metne yaz. */
      acceptGhostText: () => ReturnType
    }
  }
}

export const GhostText = Extension.create({
  name: 'ghostText',

  // Tab / Escape kısayolları liste ve diğer uzantılardan önce çalışmalı.
  priority: 1000,

  addProseMirrorPlugins() {
    return [
      new Plugin<GhostTextState>({
        key: ghostTextPluginKey,

        state: {
          init: () => EMPTY,
          apply(tr, value) {
            const meta = tr.getMeta(ghostTextPluginKey) as GhostTextState | undefined
            if (meta) return meta
            if (!value.text) return value
            // Belge veya seçim değiştiyse öneri geçersizdir.
            if (tr.docChanged || tr.selectionSet) return EMPTY
            return value
          },
        },

        props: {
          decorations(state) {
            const { text, pos } = ghostTextPluginKey.getState(state) ?? EMPTY
            if (!text || pos == null || pos > state.doc.content.size) return null

            const widget = Decoration.widget(
              pos,
              () => {
                const span = document.createElement('span')
                span.className = 'ai-ghost-text'
                span.setAttribute('data-ghost', 'true')
                span.textContent = text
                return span
              },
              { side: 1, marks: [] },
            )

            return DecorationSet.create(state.doc, [widget])
          },
        },
      }),
    ]
  },

  addCommands() {
    return {
      setGhostText:
        (text: string) =>
        ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(ghostTextPluginKey, { text, pos: tr.selection.from }))
          }
          return true
        },

      clearGhostText:
        () =>
        ({ state, tr, dispatch }) => {
          if (!(ghostTextPluginKey.getState(state)?.text)) return false
          if (dispatch) dispatch(tr.setMeta(ghostTextPluginKey, EMPTY))
          return true
        },

      acceptGhostText:
        () =>
        ({ state, tr, dispatch }) => {
          const ghost = ghostTextPluginKey.getState(state)
          if (!ghost?.text || ghost.pos == null) return false

          if (dispatch) {
            const at = Math.min(ghost.pos, state.doc.content.size)
            tr.insertText(ghost.text, at)
            tr.setMeta(ghostTextPluginKey, EMPTY)
            dispatch(tr.scrollIntoView())
          }
          return true
        },
    }
  },

  addKeyboardShortcuts() {
    return {
      // Öneri yoksa false döner → Tab varsayılan davranışına devam eder.
      Tab:    () => this.editor.commands.acceptGhostText(),
      Escape: () => this.editor.commands.clearGhostText(),
    }
  },
})
