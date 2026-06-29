import { useEffect } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { Editor } from '@tiptap/react'
import type { JSONContent } from '@tiptap/core'

export type { Editor }

interface TipTapEditorProps {
  /** Initial JSON content to hydrate the editor */
  initialContent?: JSONContent | null
  /** Called on every content change (debounce externally) */
  onUpdate?: (json: JSONContent, text: string) => void
  /** CSS class applied to the EditorContent wrapper */
  className?: string
}

/**
 * Rich-text editor built on TipTap / ProseMirror.
 *
 * Includes StarterKit (headings, bold, italic, lists, code-block, blockquote…)
 * with built-in markdown input-rules:
 *   - `## `  → H2
 *   - `**text**` → bold
 *   - `- `   → bullet list
 *   - `1. `  → ordered list
 *   - ``` `` ``` → code block
 */
export function TipTapEditor({ initialContent, onUpdate, className }: TipTapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: initialContent ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onUpdate?.(ed.getJSON(), ed.getText())
    },
  })

  // Sync content when initialContent changes from outside (e.g. route change)
  useEffect(() => {
    if (!editor || editor.isDestroyed) return

    // Only replace content if initialContent is provided and differs
    if (initialContent) {
      const currentJson = JSON.stringify(editor.getJSON())
      const nextJson = JSON.stringify(initialContent)
      if (currentJson !== nextJson) {
        editor.commands.setContent(initialContent)
      }
    }
  }, [initialContent, editor])

  if (!editor) return null

  return (
    <div className={className}>
      <EditorContent editor={editor} />
    </div>
  )
}

/**
 * Hook to expose the editor instance for toolbar integration.
 * Re-exports useEditor so page-level code can create & own the editor.
 */
export { useEditor, EditorContent, StarterKit }
