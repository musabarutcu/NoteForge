import { Extension } from '@tiptap/core'
import { Fragment } from '@tiptap/pm/model'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'

/** `.tiptap-editor p { margin-bottom }` ile aynı olmalı */
const PARAGRAPH_GAP = 6
const INDENT_SNAP = 4
/** Sol kenara bu kadar yakın tıklama girinti oluşturmaz */
const MIN_INDENT = 12
const MAX_NEW_LINES = 300

function indentAt(view: EditorView, clientX: number): number | null {
  const rect = view.dom.getBoundingClientRect()
  const max = Math.max(0, rect.width - 80)
  const x = Math.min(Math.max(clientX - rect.left, 0), max)
  const snapped = Math.round(x / INDENT_SNAP) * INDENT_SNAP
  return snapped < MIN_INDENT ? null : snapped
}

/**
 * Tıklanan ekran noktasında yazmaya başlatır (Word'deki "tıkla ve yaz").
 * - Metnin altına tıklanırsa oraya kadar boş satır ekler.
 * - Boş bir satıra tıklanırsa satırı tıklanan hizaya girintiler.
 * İşlem yapıldıysa true döner.
 */
export function placeCaretAt(view: EditorView, clientX: number, clientY: number): boolean {
  if (!view.editable) return false
  const { state } = view
  const paragraph = state.schema.nodes.paragraph
  const last = view.dom.lastElementChild
  if (!paragraph || !(last instanceof HTMLElement)) return false

  const lastRect = last.getBoundingClientRect()
  const lineHeight = parseFloat(getComputedStyle(view.dom).lineHeight) || 24
  const indent = indentAt(view, clientX)

  // 1) Metnin altı — yarım satırdan yakın tıklamalar olağan davranışta kalsın
  if (clientY > lastRect.bottom + lineHeight / 2) {
    const step = lineHeight + PARAGRAPH_GAP
    const count = Math.min(
      MAX_NEW_LINES,
      Math.max(1, Math.floor((clientY - lastRect.bottom - PARAGRAPH_GAP) / step) + 1),
    )
    const lines = Array.from({ length: count }, (_, i) =>
      paragraph.create(i === count - 1 && indent ? { indent } : null))

    const tr = state.tr.insert(state.doc.content.size, Fragment.fromArray(lines))
    tr.setSelection(TextSelection.create(tr.doc, tr.doc.content.size - 1))
    view.dispatch(tr.scrollIntoView())
    view.focus()
    return true
  }

  // 2) Mevcut boş bir satır — tıklanan hizaya girintile
  const hit = view.posAtCoords({ left: clientX, top: clientY })
  if (!hit) return false
  const $pos = state.doc.resolve(hit.pos)
  const node = $pos.parent
  if ($pos.depth !== 1 || node.type !== paragraph || node.content.size > 0) return false

  const start = $pos.before()
  const dom = view.nodeDOM(start)
  if (!(dom instanceof HTMLElement)) return false
  const r = dom.getBoundingClientRect()
  if (clientY < r.top || clientY > r.bottom) return false

  const tr = state.tr.setNodeMarkup(start, undefined, { ...node.attrs, indent })
  tr.setSelection(TextSelection.create(tr.doc, start + 1))
  view.dispatch(tr)
  view.focus()
  return true
}

export const ClickToType = Extension.create({
  name: 'clickToType',
  priority: 900,

  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading'],
      attributes: {
        indent: {
          default: null,
          parseHTML: el => {
            const v = parseInt(el.getAttribute('data-indent') ?? '', 10)
            return Number.isFinite(v) && v > 0 ? v : null
          },
          renderHTML: attrs => attrs.indent
            ? { 'data-indent': attrs.indent, style: `padding-left: ${attrs.indent}px` }
            : {},
        },
      },
    }]
  },

  addKeyboardShortcuts() {
    return {
      // Girintili satırın başında Backspace önce girintiyi kaldırır
      Backspace: ({ editor }) => {
        const { empty, $from } = editor.state.selection
        if (!empty || $from.parentOffset !== 0 || !$from.parent.attrs.indent) return false
        return editor.commands.updateAttributes($from.parent.type.name, { indent: null })
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('clickToType'),
        props: {
          handleDOMEvents: {
            mousedown: (view, event) => {
              if (event.button !== 0 || event.detail > 1 || event.shiftKey || event.ctrlKey || event.metaKey) {
                return false
              }
              if (!placeCaretAt(view, event.clientX, event.clientY)) return false
              event.preventDefault()
              return true
            },
          },
        },
      }),
    ]
  },
})
