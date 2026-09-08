import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Placeholder } from '@tiptap/extensions'
import type { JSONContent } from '@tiptap/core'
import {
  Bold, Italic, Strikethrough, Quote, SquareTerminal, Indent, Outdent, Minus, Heading3,
  List, ListOrdered, Code, Heading1, Heading2,
  Download, Eye, EyeOff, ArrowLeft, Check, Loader2, Zap, MoreHorizontal,
  Tag, FolderOpen, X, Plus, ImagePlus, Menu,
  Undo2, Redo2, Sparkles, TriangleAlert,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Sidebar } from '@/components/layout/Sidebar'
import { fetchNote, updateNote, createNote } from './notesService'
import { useFolders } from './useFolders'
import { useTags } from './useTags'
import { addTagToNote, removeTagFromNote } from './tagsService'
import { exportAsMarkdown, exportAsText, exportAsDocx, exportAsPdf } from '@/lib/exportNote'
import { useAuthStore } from '@/store/authStore'
import type { NoteWithTags, Tag as TagType } from '@/types/database'
import { ImageCanvas, type ImageCanvasHandle } from '@/components/editor/ImageCanvas'
import { GhostText } from '@/components/editor/GhostText'
import { useAiCompletion } from './useAiCompletion'
import { useOverflowAffordance } from '@/hooks/useOverflowAffordance'
import { runAiAction, isAiConfigured, AiError, type AiAction } from '@/lib/aiService'

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'
type ExportFormat = 'pdf' | 'docx' | 'txt' | 'markdown'

/** Yazma durduktan sonra otomatik kaydın tetiklenme süresi. */
const AUTOSAVE_DELAY = 1500

const EXPORT_FORMATS: { id: ExportFormat; label: string; desc: string; icon: string }[] = [
  { id: 'pdf',      label: 'PDF Belgesi',          desc: 'Yeni sekmede aç → Yazdır → PDF kaydet', icon: '⬜' },
  { id: 'docx',     label: 'Word Belgesi (.docx)',  desc: 'Düzenlenebilir format',                  icon: 'W'  },
  { id: 'txt',      label: 'Düz Metin (.txt)',      desc: 'Evrensel uyumluluk',                     icon: 'T'  },
  { id: 'markdown', label: 'Markdown (.md)',         desc: 'Geliştirici dostu format',               icon: '#'  },
]

const AI_ACTIONS: { id: AiAction; label: string }[] = [
  { id: 'continue',  label: 'Devam ettir'    },
  { id: 'rewrite',   label: 'Yeniden yaz'    },
  { id: 'summarize', label: 'Özetle'         },
  { id: 'shorten',   label: 'Kısalt'         },
]

/* ─── Toolbar ikon butonu (modül seviyesinde — her render'da
       yeniden oluşturulup DOM'dan sökülmemesi için) ─────────── */
function TbBtn({
  id, title, active, disabled, onClick, children,
}: {
  id?: string
  title: string
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      id={id}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      // Tıklarken editördeki seçim kaybolmasın diye odak çalınmasını engelle
      onMouseDown={e => e.preventDefault()}
      className={`nf-tb-btn${active ? ' is-active' : ''}`}
    >
      {children}
    </button>
  )
}

/* ─── Silinebilir etiket rozeti ──────────────────────────── */
function TagBadge({ tag, onRemove }: { tag: TagType; onRemove: (id: string) => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em',
      textTransform: 'uppercase', padding: '3px 8px 3px 10px',
      borderRadius: '6px', backgroundColor: '#111111',
      border: '1px solid #232323', color: '#9A9A9A',
    }}>
      {tag.name}
      <button
        type="button"
        title="Etiketi kaldır"
        onClick={() => onRemove(tag.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#555555', display: 'flex', padding: '1px',
          transition: 'color 150ms',
        }}
        onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
        onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
      >
        <X size={9} />
      </button>
    </span>
  )
}

export function NoteEditorPage() {
  const { id }   = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user     = useAuthStore(s => s.user)

  const [note,      setNote]      = useState<NoteWithTags | null>(null)
  const [title,     setTitle]     = useState('')
  const [noteTags,  setNoteTags]  = useState<TagType[]>([])   // live tag state for this note
  const [loading,   setLoading]   = useState(true)
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [aiEnabled, setAiEnabled] = useState(false)
  const [showExport,   setShowExport]   = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [showTagPanel, setShowTagPanel] = useState(false)  // tag picker popover
  const [showFolderModal, setShowFolderModal] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [previewMode,  setPreviewMode]  = useState(false)
  const [wordCount, setWordCount]   = useState(0)
  const [charCount, setCharCount]   = useState(0)
  const [newTagInput, setNewTagInput] = useState('')
  const [savingTag, setSavingTag] = useState(false)
  const [savingFolder, setSavingFolder] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
  const [aiActionRunning, setAiActionRunning] = useState<AiAction | null>(null)
  const [toast, setToast] = useState<{ kind: 'info' | 'error'; message: string } | null>(null)

  const tagPanelRef      = useRef<HTMLDivElement>(null)
  const moreMenuRef      = useRef<HTMLDivElement>(null)
  const imageCanvasRef   = useRef<ImageCanvasHandle>(null)

  // Toolbar'ın kayan bölümü için kenar solması ipucu
  const tbScrollRef = useOverflowAffordance<HTMLDivElement>([loading])

  // Folder & tag data from Supabase
  const { folders } = useFolders()
  const { tags: allTags, addTag } = useTags()

  /* ─── Kayıt için ref'ler (closure tazeliği) ──────────────── */
  const titleRef = useRef(title)
  titleRef.current = title
  const idRef = useRef(id)
  idRef.current = id

  const editorRef     = useRef<Editor | null>(null)
  const dirtyRef      = useRef(false)
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Editör yok edildikten sonra bile kaydedebilmek için son içerik anlık görüntüsü */
  const pendingRef    = useRef<{ json: JSONContent; text: string } | null>(null)
  const scheduleSaveRef = useRef<() => void>(() => {})

  // The initial JSON content loaded from DB — used to hydrate the editor
  const [initialJson, setInitialJson] = useState<JSONContent | null>(null)

  /* ─── Otomatik kaydetme ──────────────────────────────────── */
  const persist = useCallback(async (noteId: string | undefined = idRef.current) => {
    if (!noteId) return
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }

    const ed = editorRef.current
    const snapshot = ed && !ed.isDestroyed
      ? { json: ed.getJSON(), text: ed.getText() }
      : pendingRef.current

    dirtyRef.current = false
    setSaveState('saving')
    try {
      const saved = await updateNote(noteId, {
        title: titleRef.current,
        ...(snapshot ? { content_json: snapshot.json, content_markdown: snapshot.text } : {}),
      })
      if (!dirtyRef.current) setSaveState('saved')
      setNote(prev => (prev && prev.id === noteId ? { ...prev, updated_at: saved.updated_at } : prev))
    } catch {
      dirtyRef.current = true
      setSaveState('error')
    }
  }, [])

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true
    setSaveState('unsaved')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void persist()
    }, AUTOSAVE_DELAY)
  }, [persist])

  scheduleSaveRef.current = scheduleSave

  /* ─── TipTap Editor ──────────────────────────────────────── */
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading' ? 'Başlık' : 'Yazmaya başla…',
      }),
      GhostText,
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        id: 'note-content',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const text = ed.getText()
      pendingRef.current = { json: ed.getJSON(), text }
      setWordCount(countWords(text))
      setCharCount(text.length)
      scheduleSaveRef.current()
    },
  })

  useEffect(() => { editorRef.current = editor }, [editor])

  /* ─── AI satır içi tamamlama ─────────────────────────────── */
  const ai = useAiCompletion({ editor, enabled: aiEnabled && !previewMode })
  const aiRef = useRef(ai)
  aiRef.current = ai

  /* ─── Load note ──────────────────────────────────────────── */
  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetchNote(id)
      .then(n => {
        setNote(n)
        setTitle(n.title)
        setNoteTags(n.tags)

        // Hydrate TipTap from content_json, falling back to markdown text
        const jsonContent = n.content_json as JSONContent | null
        if (jsonContent && typeof jsonContent === 'object' && 'type' in jsonContent) {
          setInitialJson(jsonContent)
        } else if (n.content_markdown) {
          const paragraphs = n.content_markdown.split('\n').map(line => ({
            type: 'paragraph' as const,
            content: line ? [{ type: 'text' as const, text: line }] : [],
          }))
          setInitialJson({ type: 'doc', content: paragraphs })
        } else {
          setInitialJson({ type: 'doc', content: [{ type: 'paragraph' }] })
        }

        setWordCount(countWords(n.content_markdown ?? ''))
        setCharCount((n.content_markdown ?? '').length)
      })
      .catch(() => navigate('/notlar', { replace: true }))
      .finally(() => setLoading(false))

    // Başka bir nota geçilirken bekleyen değişiklikleri kaydet
    return () => {
      if (dirtyRef.current) void persist(id)
    }
  }, [id, navigate, persist])

  // When initialJson is ready and editor is available, hydrate it
  useEffect(() => {
    if (!editor || !initialJson || editor.isDestroyed) return
    editor.commands.setContent(initialJson, { emitUpdate: false })
    pendingRef.current = null
    dirtyRef.current   = false
    setSaveState('saved')
  }, [editor, initialJson])

  /* ─── Salt-okunur önizleme modu ──────────────────────────── */
  useEffect(() => {
    if (!editor || editor.isDestroyed) return
    editor.setEditable(!previewMode)
    editor.view.dom.classList.toggle('is-preview', previewMode)
  }, [editor, previewMode])

  /* ─── Sayfadan ayrılırken uyar + bileşen sökülürken kaydet ─ */
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (dirtyRef.current) void persist()
  }, [persist])

  /* ─── Genel klavye kısayolları ───────────────────────────── */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (!mod) return

      // Ctrl/Cmd + S → hemen kaydet
      if (e.key.toLowerCase() === 's') {
        e.preventDefault()
        void persist()
        return
      }
      // Ctrl/Cmd + Space → AI önerisi iste
      if (e.code === 'Space') {
        e.preventDefault()
        if (!isAiConfigured()) {
          setToast({ kind: 'error', message: 'API anahtarı tanımlı değil. .env.local içine VITE_GEMINI_API_KEY ekle.' })
          return
        }
        setAiEnabled(true)
        aiRef.current.requestNow()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [persist])

  // Close tag panel on outside click
  useEffect(() => {
    if (!showTagPanel) return
    const handler = (e: MouseEvent) => {
      if (tagPanelRef.current && !tagPanelRef.current.contains(e.target as Node)) {
        setShowTagPanel(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showTagPanel])

  // Close "more" menu on outside click / Escape
  useEffect(() => {
    if (!showMoreMenu) return
    const onClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) setShowMoreMenu(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowMoreMenu(false) }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showMoreMenu])

  /* ─── AI hataları → toast ────────────────────────────────── */
  useEffect(() => {
    if (!ai.error) return
    setToast({ kind: 'error', message: ai.error })
  }, [ai.error])

  const dismissAiError = ai.dismissError
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => { setToast(null); dismissAiError() }, 5000)
    return () => clearTimeout(t)
  }, [toast, dismissAiError])

  /* ─── Başlık ─────────────────────────────────────────────── */
  const handleTitleChange = (v: string) => {
    setTitle(v)
    scheduleSave()
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter / ↓ → içerik alanına geç
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      e.preventDefault()
      editor?.commands.focus('start')
    }
  }

  const handleNewNote = async () => {
    if (!user) return
    if (dirtyRef.current) await persist()
    const n = await createNote(user.id)
    navigate(`/notlar/${n.id}`)
  }

  /* ─── AI ────────────────────────────────────────────────── */
  const handleToggleAi = () => {
    if (!ai.configured) {
      setToast({ kind: 'error', message: 'API anahtarı tanımlı değil. .env.local içine VITE_GEMINI_API_KEY ekle.' })
      return
    }
    setAiEnabled(prev => {
      const next = !prev
      if (next) setTimeout(() => ai.requestNow(), 0)
      return next
    })
  }

  const handleAiAction = async (action: AiAction) => {
    const ed = editorRef.current
    if (!ed || ed.isDestroyed || aiActionRunning) return

    if (!isAiConfigured()) {
      setToast({ kind: 'error', message: 'API anahtarı tanımlı değil. .env.local içine VITE_GEMINI_API_KEY ekle.' })
      setShowMoreMenu(false)
      return
    }

    const { from, to } = ed.state.selection
    const selected = ed.state.doc.textBetween(from, to, '\n', ' ')
    if (!selected.trim()) {
      setToast({ kind: 'info', message: 'Önce editörde bir metin seç.' })
      setShowMoreMenu(false)
      return
    }

    setAiActionRunning(action)
    try {
      const result = await runAiAction(action, selected)
      if (!result) {
        setToast({ kind: 'info', message: 'AI bir sonuç üretemedi.' })
        return
      }
      if (action === 'continue') {
        ed.chain().focus().insertContentAt(to, ` ${result}`).run()
      } else {
        ed.chain().focus().insertContentAt({ from, to }, result).run()
      }
    } catch (err) {
      setToast({
        kind: 'error',
        message: err instanceof AiError ? err.message : 'AI isteği başarısız oldu.',
      })
    } finally {
      setAiActionRunning(null)
      setShowMoreMenu(false)
    }
  }

  /* ─── Tag management ────────────────────────────────────── */
  const handleToggleTag = async (tag: TagType) => {
    if (!id) return
    const has = noteTags.some(t => t.id === tag.id)
    if (has) {
      // Optimistic remove
      setNoteTags(prev => prev.filter(t => t.id !== tag.id))
      await removeTagFromNote(id, tag.id)
    } else {
      // Optimistic add
      setNoteTags(prev => [...prev, tag])
      await addTagToNote(id, tag.id)
    }
  }

  const handleCreateAndAddTag = async () => {
    const name = newTagInput.trim()
    if (!name || !id) return
    setSavingTag(true)
    try {
      const tag = await addTag(name)
      if (tag) {
        setNoteTags(prev => (prev.some(t => t.id === tag.id) ? prev : [...prev, tag]))
        await addTagToNote(id, tag.id)
      }
      setNewTagInput('')
    } finally {
      setSavingTag(false)
    }
  }

  const handleRemoveTag = useCallback(async (tagId: string) => {
    if (!id) return
    setNoteTags(prev => prev.filter(t => t.id !== tagId))
    await removeTagFromNote(id, tagId)
  }, [id])

  /* ─── Folder assignment ─────────────────────────────────── */
  const handleAssignFolder = async (folderId: string | null) => {
    if (!id || !note) return
    setSavingFolder(true)
    try {
      await updateNote(id, { folder_id: folderId })
      setNote(prev => prev ? { ...prev, folder_id: folderId } : prev)
      setShowFolderModal(false)
    } finally {
      setSavingFolder(false)
    }
  }

  const currentFolder = folders.find(f => f.id === note?.folder_id) ?? null

  /* ─── Export ────────────────────────────────────────────── */
  const handleExport = async (fmt: ExportFormat) => {
    if (!editor || exportingFormat) return
    const json  = editor.getJSON()
    setExportingFormat(fmt)
    try {
      switch (fmt) {
        case 'markdown': await exportAsMarkdown(json, title); break
        case 'txt':      await exportAsText(json, title);     break
        case 'docx':     await exportAsDocx(json, title);     break
        case 'pdf':      exportAsPdf(json, title);            break  // sync — opens popup
      }
    } catch {
      setToast({ kind: 'error', message: 'Dışa aktarma başarısız oldu.' })
    } finally {
      setExportingFormat(null)
      if (fmt !== 'pdf') setShowExport(false)
    }
  }

  /* ─── Loading state ──────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100dvh', backgroundColor: '#000000' }}>
        <Sidebar onNewNote={handleNewNote} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={24} color="#4D8DFF" className="animate-spin" />
        </div>
      </div>
    )
  }

  if (!note) return null

  const aiBusy = ai.status === 'loading' || aiActionRunning !== null

  return (
    <div style={{ display: 'flex', height: '100dvh', backgroundColor: '#000000', overflow: 'hidden' }}>

      {/* Sidebar */}
      <Sidebar
        onNewNote={handleNewNote}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* ── Editor pane ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>

        {/* ── Sticky Toolbar ────────────────────────────── */}
        <div className="nf-toolbar">
          {/* ── Sol sabit grup ───────────────────────────── */}
          <div className="nf-toolbar-lead">
            {/* Hamburger Menu (Mobile Only) */}
            <button
              type="button"
              className="nf-tb-btn md:hidden"
              onClick={() => setIsSidebarOpen(true)}
              title="Menü"
              aria-label="Menü"
            >
              <Menu size={18} />
            </button>

            {/* Back */}
            <TbBtn id="tb-back" title="Notlara dön" onClick={() => navigate('/notlar')}>
              <ArrowLeft size={16} />
            </TbBtn>
          </div>

          {/* ── Ortada kayan biçimlendirme grubu ─────────── */}
          <div className="nf-toolbar-scroll" ref={tbScrollRef}>
          {/* Text Formatting */}
          <TbBtn id="tb-bold" title="Kalın (Ctrl+B)" active={editor?.isActive('bold')}
            onClick={() => editor?.chain().focus().toggleBold().run()}>
            <Bold size={15} />
          </TbBtn>
          <TbBtn id="tb-italic" title="İtalik (Ctrl+I)" active={editor?.isActive('italic')}
            onClick={() => editor?.chain().focus().toggleItalic().run()}>
            <Italic size={15} />
          </TbBtn>
          <TbBtn id="tb-strike" title="Üstü Çizili (Ctrl+Shift+X)" active={editor?.isActive('strike')}
            onClick={() => editor?.chain().focus().toggleStrike().run()}>
            <Strikethrough size={15} />
          </TbBtn>

          <div className="nf-tb-sep" />

          {/* Headings */}
          <TbBtn id="tb-h1" title="Başlık 1 (Ctrl+Alt+1)" active={editor?.isActive('heading', { level: 1 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}>
            <Heading1 size={15} />
          </TbBtn>
          <TbBtn id="tb-h2" title="Başlık 2 (Ctrl+Alt+2)" active={editor?.isActive('heading', { level: 2 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Heading2 size={15} />
          </TbBtn>
          <TbBtn id="tb-h3" title="Başlık 3 (Ctrl+Alt+3)" active={editor?.isActive('heading', { level: 3 })}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>
            <Heading3 size={15} />
          </TbBtn>

          <div className="nf-tb-sep" />

          {/* Lists & Indentation */}
          <TbBtn id="tb-list" title="Madde İşaretli Liste" active={editor?.isActive('bulletList')}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}>
            <List size={15} />
          </TbBtn>
          <TbBtn id="tb-ordered-list" title="Numaralı Liste" active={editor?.isActive('orderedList')}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}>
            <ListOrdered size={15} />
          </TbBtn>
          <TbBtn id="tb-outdent" title="Girintiyi Azalt"
            disabled={!editor?.can().liftListItem('listItem')}
            onClick={() => editor?.chain().focus().liftListItem('listItem').run()}>
            <Outdent size={15} />
          </TbBtn>
          <TbBtn id="tb-indent" title="Girintiyi Artır"
            disabled={!editor?.can().sinkListItem('listItem')}
            onClick={() => editor?.chain().focus().sinkListItem('listItem').run()}>
            <Indent size={15} />
          </TbBtn>

          <div className="nf-tb-sep" />

          {/* Blocks & Code */}
          <TbBtn id="tb-quote" title="Alıntı (Ctrl+Shift+B)" active={editor?.isActive('blockquote')}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}>
            <Quote size={15} />
          </TbBtn>
          <TbBtn id="tb-code" title="Satır İçi Kod (Ctrl+E)" active={editor?.isActive('code')}
            onClick={() => editor?.chain().focus().toggleCode().run()}>
            <Code size={15} />
          </TbBtn>
          <TbBtn id="tb-code-block" title="Kod Bloğu (Ctrl+Alt+C)" active={editor?.isActive('codeBlock')}
            onClick={() => editor?.chain().focus().toggleCodeBlock().run()}>
            <SquareTerminal size={15} />
          </TbBtn>
          <TbBtn id="tb-hr" title="Yatay Çizgi"
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}>
            <Minus size={15} />
          </TbBtn>

          <div className="nf-tb-sep" />

          {/* Image insert */}
          <TbBtn id="tb-image" title="Görsel Ekle" onClick={() => imageCanvasRef.current?.triggerFileInput()}>
            <ImagePlus size={15} />
          </TbBtn>
          </div>

          {/* ── Sağ sabit aksiyon grubu ─────────────────── */}
          <div className="nf-toolbar-actions">
          {/* Save indicator */}
          <SaveIndicator state={saveState} />

          {/* AI Toggle */}
          <button
            type="button"
            id="tb-ai-toggle"
            onClick={handleToggleAi}
            title={
              !ai.configured ? 'Metin tamamlama için API anahtarı gerekli'
              : aiEnabled     ? 'Otomatik metin tamamlamayı kapat'
              : 'Otomatik metin tamamlamayı aç (Ctrl+Space)'
            }
            className={
              'nf-tb-pill nf-tb-pill--round ' +
              (ai.status === 'error' ? 'nf-tb-pill--warn'
                : aiEnabled          ? 'nf-tb-pill--on'
                : 'nf-tb-pill--off')
            }
          >
            {ai.status === 'loading'
              ? <Loader2 size={12} className="animate-spin" />
              : ai.status === 'error'
                ? <TriangleAlert size={12} />
                : <Zap size={12} />}
            <span className="nf-tb-label">AI</span>
          </button>

          {/* Export */}
          <button
            type="button"
            id="tb-export"
            className="nf-tb-pill"
            onClick={() => setShowExport(true)}
            title="Dışa Aktar"
          >
            <Download size={14} />
            <span className="nf-tb-label">Dışa Aktar</span>
          </button>

          <TbBtn
            id="tb-view"
            title={previewMode ? 'Düzenlemeye dön' : 'Önizleme (salt okunur)'}
            active={previewMode}
            onClick={() => setPreviewMode(v => !v)}
          >
            {previewMode ? <EyeOff size={15} /> : <Eye size={15} />}
          </TbBtn>

          <TbBtn
            id="tb-more"
            title="Daha fazla"
            active={showMoreMenu}
            onClick={() => setShowMoreMenu(v => !v)}
          >
            <MoreHorizontal size={15} />
          </TbBtn>
          </div>
        </div>

        {/* ── "Daha fazla" menüsü ─────────────────────────
             Toolbar'ın overflow'u kırpmasın diye fixed konumlu. */}
        {showMoreMenu && (
          <div
            ref={moreMenuRef}
            style={{
              position: 'fixed', top: '58px', right: '12px', zIndex: 60,
              width: '224px', padding: '6px',
              backgroundColor: '#0D0D0D', border: '1px solid #232323',
              borderRadius: '10px', boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
            }}
          >
            <MenuItem
              icon={<Undo2 size={13} />}
              label="Geri al"
              hint="Ctrl+Z"
              disabled={!editor?.can().undo()}
              onClick={() => { editor?.chain().focus().undo().run(); setShowMoreMenu(false) }}
            />
            <MenuItem
              icon={<Redo2 size={13} />}
              label="Yinele"
              hint="Ctrl+Y"
              disabled={!editor?.can().redo()}
              onClick={() => { editor?.chain().focus().redo().run(); setShowMoreMenu(false) }}
            />

            <div style={{ margin: '6px 8px', borderTop: '1px solid #1A1A1A' }} />
            <p className="label-caps" style={{ padding: '4px 10px 6px', color: '#3A3A3A', fontSize: '10px' }}>
              Seçili metin için AI
            </p>

            {AI_ACTIONS.map(a => (
              <MenuItem
                key={a.id}
                icon={aiActionRunning === a.id
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Sparkles size={13} />}
                label={a.label}
                disabled={aiActionRunning !== null}
                onClick={() => void handleAiAction(a.id)}
              />
            ))}
          </div>
        )}

        {/* ── Editor scrollable area ───────────────────── */}
        <div className="editor-surface editor-area">
          <div className="editor-content">

            {/* Title */}
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              readOnly={previewMode}
              placeholder="Başlık…"
              style={{
                width: '100%', background: 'transparent', border: 'none', outline: 'none',
                fontSize: '26px', fontWeight: 600, color: 'var(--editor-text)',
                marginBottom: '10px', lineHeight: 1.2, fontFamily: 'inherit', minWidth: 0,
              }}
            />

            {/* ── Metadata row ────────────────────────── */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px 10px', flexWrap: 'wrap',
              marginBottom: '24px', paddingBottom: '20px', borderBottom: '1px solid var(--editor-border)',
            }}>
              <span style={{ fontSize: '12px', color: '#555555' }}>
                {formatTimeAgo(note.updated_at)}
              </span>

              {/* Folder chip — clickable to change */}
              <button
                type="button"
                id="btn-assign-folder"
                title={currentFolder ? `Klasör: ${currentFolder.name} — değiştirmek için tıkla` : 'Klasör ata'}
                onClick={() => setShowFolderModal(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em',
                  textTransform: 'uppercase', padding: '3px 10px',
                  borderRadius: '6px', cursor: 'pointer', transition: 'all 150ms',
                  backgroundColor: currentFolder ? '#111111' : 'transparent',
                  border: currentFolder ? '1px solid #232323' : '1px dashed #2A2A2A',
                  color: currentFolder ? '#9A9A9A' : '#3A3A3A',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#4D8DFF44'
                  e.currentTarget.style.color = '#4D8DFF'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = currentFolder ? '#232323' : '#2A2A2A'
                  e.currentTarget.style.color = currentFolder ? '#9A9A9A' : '#3A3A3A'
                }}
              >
                <FolderOpen size={10} />
                {currentFolder ? currentFolder.name : '+ Klasör'}
              </button>

              {/* Tag chips — each removable */}
              {noteTags.map(tag => (
                <TagBadge key={tag.id} tag={tag} onRemove={handleRemoveTag} />
              ))}

              {/* Tag picker trigger */}
              <div style={{ position: 'relative' }} ref={tagPanelRef}>
                <button
                  type="button"
                  id="btn-add-tag"
                  title="Etiket ekle"
                  onClick={() => setShowTagPanel(v => !v)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px',
                    fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em',
                    textTransform: 'uppercase', padding: '3px 10px',
                    borderRadius: '6px', cursor: 'pointer', transition: 'all 150ms',
                    backgroundColor: 'transparent',
                    border: '1px dashed #2A2A2A', color: '#3A3A3A',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = '#4D8DFF44'
                    e.currentTarget.style.color = '#4D8DFF'
                  }}
                  onMouseLeave={e => {
                    if (!showTagPanel) {
                      e.currentTarget.style.borderColor = '#2A2A2A'
                      e.currentTarget.style.color = '#3A3A3A'
                    }
                  }}
                >
                  <Tag size={10} />
                  + Etiket
                </button>

                {/* Tag picker popover */}
                {showTagPanel && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, zIndex: 50,
                    marginTop: '6px', width: '220px',
                    backgroundColor: '#0D0D0D', border: '1px solid #232323',
                    borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
                    overflow: 'hidden',
                  }}>
                    {/* New tag input */}
                    <div style={{ padding: '8px', borderBottom: '1px solid #1A1A1A' }}>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          value={newTagInput}
                          onChange={e => setNewTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleCreateAndAddTag()
                            if (e.key === 'Escape') setShowTagPanel(false)
                          }}
                          placeholder="Yeni etiket…"
                          autoFocus
                          style={{
                            flex: 1, height: '28px', borderRadius: '6px',
                            backgroundColor: '#111111', border: '1px solid #232323',
                            color: '#ffffff', fontSize: '12px', padding: '0 8px', outline: 'none',
                          }}
                          onFocus={e => (e.target.style.borderColor = '#4D8DFF')}
                          onBlur={e => (e.target.style.borderColor = '#232323')}
                        />
                        <button
                          type="button"
                          onClick={handleCreateAndAddTag}
                          disabled={!newTagInput.trim() || savingTag}
                          style={{
                            width: '28px', height: '28px', borderRadius: '6px',
                            backgroundColor: newTagInput.trim() ? '#4D8DFF' : '#111111',
                            border: 'none', cursor: newTagInput.trim() ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: '#fff', transition: 'background 150ms',
                          }}
                        >
                          {savingTag ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        </button>
                      </div>
                    </div>

                    {/* Existing tags list */}
                    <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                      {allTags.length === 0 ? (
                        <p style={{ fontSize: '12px', color: '#555555', padding: '12px', textAlign: 'center' }}>
                          Henüz etiket yok
                        </p>
                      ) : allTags.map(tag => {
                        const isAssigned = noteTags.some(t => t.id === tag.id)
                        return (
                          <button
                            type="button"
                            key={tag.id}
                            id={`tag-pick-${tag.id}`}
                            onClick={() => handleToggleTag(tag)}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                              padding: '8px 12px', background: 'none', border: 'none',
                              cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
                              color: isAssigned ? '#4D8DFF' : '#9A9A9A', fontSize: '13px',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#111111')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                          >
                            <Tag size={11} style={{ flexShrink: 0 }} />
                            <span style={{ flex: 1 }}>{tag.name}</span>
                            {isAssigned && <Check size={11} color="#4D8DFF" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TipTap Rich Text Editor */}
            {editor && <EditorContent editor={editor} />}

            {/* AI ipucu — öneri gösterilirken */}
            {ai.status === 'ready' && (
              <p style={{ marginTop: '8px', fontSize: '11px', color: '#3A3A3A' }}>
                <kbd style={KBD}>Tab</kbd> kabul et · <kbd style={KBD}>Esc</kbd> reddet
              </p>
            )}

            {/* ── Image Canvas — drag/drop/resize/move ───── */}
            {user && (
              <ImageCanvas ref={imageCanvasRef} noteId={note.id} userId={user.id} />
            )}
          </div>
        </div>

        {/* ── Status Bar ────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap',
          gap: '6px 16px', minHeight: '36px', padding: '6px 16px',
          borderTop: '1px solid var(--editor-border)', flexShrink: 0,
          backgroundColor: 'var(--editor-surface)',
        }}>
          {[
            `${wordCount} kelime`,
            `${charCount} karakter`,
            `${Math.max(1, Math.ceil(wordCount / 200))} dk okuma`,
          ].map((txt, i) => (
            <span key={i} style={{ fontSize: '11px', lineHeight: 1.4, color: '#555555', whiteSpace: 'nowrap' }}>{txt}</span>
          ))}
        </div>
      </div>

      {/* ── Toast ────────────────────────────────────────── */}
      {toast && (
        <div className={`nf-toast${toast.kind === 'error' ? ' nf-toast--error' : ''}`} role="status">
          {toast.kind === 'error' ? <TriangleAlert size={14} /> : <Sparkles size={14} />}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            onClick={() => { setToast(null); ai.dismissError() }}
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', display: 'flex', opacity: 0.6 }}
            title="Kapat"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* AI çalışırken görünmez durum bildirimi (ekran okuyucular için) */}
      <span aria-live="polite" className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {aiBusy ? 'AI çalışıyor' : ''}
      </span>

      {/* ── Export Modal ─────────────────────────────────── */}
      <Modal open={showExport} onClose={() => { if (!exportingFormat) setShowExport(false) }} title="Dışa Aktarım" size="sm">
        <div>
          <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #1A1A1A' }}>
            <p className="label-caps" style={{ marginBottom: '4px', color: '#555555' }}>Not</p>
            <p style={{ fontSize: '14px', color: '#ffffff' }}>{title}</p>
          </div>

          {EXPORT_FORMATS.map((fmt, idx) => {
            const isLoading = exportingFormat === fmt.id
            const isDisabled = !!exportingFormat
            return (
              <div key={fmt.id}>
                <button
                  type="button"
                  id={`export-${fmt.id}`}
                  disabled={isDisabled}
                  onClick={() => handleExport(fmt.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 16px', background: 'none', border: 'none',
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    textAlign: 'left', transition: 'background 150ms',
                    opacity: isDisabled && !isLoading ? 0.4 : 1,
                  }}
                  onMouseEnter={e => { if (!isDisabled) e.currentTarget.style.backgroundColor = '#111111' }}
                  onMouseLeave={e => { if (!isDisabled) e.currentTarget.style.backgroundColor = 'transparent' }}
                >
                  {/* Icon / Spinner */}
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '8px',
                    backgroundColor: isLoading ? 'rgba(77,141,255,0.1)' : '#111111',
                    border: `1px solid ${isLoading ? 'rgba(77,141,255,0.4)' : '#232323'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontFamily: 'monospace',
                    color: '#4D8DFF', flexShrink: 0,
                    transition: 'all 200ms',
                  }}>
                    {isLoading
                      ? <Loader2 size={14} className="animate-spin" />
                      : fmt.icon
                    }
                  </span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: isLoading ? '#4D8DFF' : '#ffffff', transition: 'color 150ms' }}>
                      {isLoading ? 'Oluşturuluyor…' : fmt.label}
                    </p>
                    <p style={{ fontSize: '12px', color: '#555555' }}>{fmt.desc}</p>
                  </div>

                  {!isLoading && <span style={{ color: '#555555' }}>›</span>}
                </button>
                {idx < EXPORT_FORMATS.length - 1 && (
                  <div style={{ margin: '0 16px', borderTop: '1px solid #1A1A1A' }} />
                )}
              </div>
            )
          })}

          <div style={{ borderTop: '1px solid #1A1A1A', padding: '12px 16px' }}>
            <p style={{ fontSize: '11px', color: '#555555', textAlign: 'center' }}>
              PDF için: aç → Yazdır (Ctrl+P) → "PDF olarak kaydet"
            </p>
          </div>
        </div>
      </Modal>

      {/* ── Folder assignment modal ───────────────────────── */}
      <Modal open={showFolderModal} onClose={() => setShowFolderModal(false)} title="Klasöre Taşı" size="sm">
        <div>
          {/* No folder option */}
          <button
            type="button"
            onClick={() => handleAssignFolder(null)}
            disabled={savingFolder}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
              color: note.folder_id == null ? '#4D8DFF' : '#9A9A9A', fontSize: '14px',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#111111')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <FolderOpen size={14} />
            Klasör yok (kök)
            {note.folder_id == null && (
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4D8DFF' }}>✓</span>
            )}
          </button>

          {folders.length > 0 && <div style={{ margin: '0 16px', borderTop: '1px solid #1A1A1A' }} />}

          {folders.map((folder, idx) => (
            <div key={folder.id}>
              <button
                type="button"
                id={`assign-folder-${folder.id}`}
                onClick={() => handleAssignFolder(folder.id)}
                disabled={savingFolder}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px',
                  paddingLeft: folder.parent_id ? '28px' : '16px',
                  background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
                  color: note.folder_id === folder.id ? '#4D8DFF' : '#9A9A9A', fontSize: '14px',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#111111')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '12px' }}>{folder.parent_id ? '└' : '📁'}</span>
                {folder.name}
                {note.folder_id === folder.id && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4D8DFF' }}>✓</span>
                )}
              </button>
              {idx < folders.length - 1 && (
                <div style={{ margin: '0 16px', borderTop: '1px solid #1A1A1A' }} />
              )}
            </div>
          ))}

          {savingFolder && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
              <Loader2 size={16} color="#4D8DFF" className="animate-spin" />
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

/* ─── Helpers ────────────────────────────────────────────── */
const KBD: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: '10px',
  padding: '1px 5px', borderRadius: '4px',
  border: '1px solid #232323', background: '#111111', color: '#9A9A9A',
}

function MenuItem({
  icon, label, hint, disabled, onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseDown={e => e.preventDefault()}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
        padding: '8px 10px', borderRadius: '7px',
        background: 'none', border: 'none', textAlign: 'left',
        color: disabled ? '#3A3A3A' : '#9A9A9A', fontSize: '13px',
        cursor: disabled ? 'not-allowed' : 'pointer', transition: 'background 150ms, color 150ms',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.color = '#fff' } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9A9A9A' } }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {hint && <span style={{ fontSize: '10px', color: '#3A3A3A' }}>{hint}</span>}
    </button>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return (
    <div className="nf-save-indicator">
      <Loader2 size={12} className="animate-spin" />
      <span className="nf-tb-label">Kaydediliyor…</span>
    </div>
  )
  if (state === 'saved') return (
    <div className="nf-save-indicator nf-save-indicator--saved">
      <Check size={12} />
      <span className="nf-tb-label">Kaydedildi</span>
    </div>
  )
  if (state === 'error') return (
    <div className="nf-save-indicator nf-save-indicator--error">
      <TriangleAlert size={12} />
      <span className="nf-tb-label">Kayıt hatası</span>
    </div>
  )
  return (
    <div className="nf-save-indicator">
      <Minus size={12} />
      <span className="nf-tb-label">Kaydedilmedi</span>
    </div>
  )
}

function countWords(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

function formatTimeAgo(dateString: string): string {
  const diff  = Date.now() - new Date(dateString).getTime()
  const mins  = Math.floor(diff / 60000)
  const hrs   = Math.floor(mins  / 60)
  const days  = Math.floor(hrs   / 24)
  if (mins < 1)  return 'Az önce kaydedildi'
  if (mins < 60) return `${mins} dakika önce`
  if (hrs  < 24) return `${hrs} saat önce`
  return `${days} gün önce`
}
