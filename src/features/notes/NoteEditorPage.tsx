import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import type { JSONContent } from '@tiptap/core'
import {
  Bold, Italic, Strikethrough, Quote, SquareTerminal, Indent, Outdent, Minus, Heading3,
  List, ListOrdered, Code, Heading1, Heading2,
  Download, Eye, ArrowLeft, Check, Loader2, Zap, MoreHorizontal,
  Tag, FolderOpen, X, Plus, ImagePlus, Menu,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Sidebar } from '@/components/layout/Sidebar'
import { fetchNote, updateNote, createNote } from './notesService'
import { useFolders } from './useFolders'
import { useTags } from './useTags'
import { addTagToNote, removeTagFromNote } from './tagsService'
import { exportAsMarkdown, exportAsText, exportAsDocx, exportAsPdf } from '@/lib/exportNote'
import { debounce } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import type { NoteWithTags, Tag as TagType } from '@/types/database'
import { ImageCanvas, type ImageCanvasHandle } from '@/components/editor/ImageCanvas'

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error'
type ExportFormat = 'pdf' | 'docx' | 'txt' | 'markdown'

const EXPORT_FORMATS: { id: ExportFormat; label: string; desc: string; icon: string }[] = [
  { id: 'pdf',      label: 'PDF Belgesi',          desc: 'Yeni sekmede aç → Yazdır → PDF kaydet', icon: '⬜' },
  { id: 'docx',     label: 'Word Belgesi (.docx)',  desc: 'Düzenlenebilir format',                  icon: 'W'  },
  { id: 'txt',      label: 'Düz Metin (.txt)',      desc: 'Evrensel uyumluluk',                     icon: 'T'  },
  { id: 'markdown', label: 'Markdown (.md)',         desc: 'Geliştirici dostu format',               icon: '#'  },
]

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
  const [wordCount, setWordCount]   = useState(0)
  const [newTagInput, setNewTagInput] = useState('')
  const [savingTag, setSavingTag] = useState(false)
  const [savingFolder, setSavingFolder] = useState(false)
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null)
  const tagPanelRef      = useRef<HTMLDivElement>(null)
  const imageCanvasRef   = useRef<ImageCanvasHandle>(null)

  // Folder & tag data from Supabase
  const { folders } = useFolders()
  const { tags: allTags, addTag } = useTags()

  // Refs for debounced save closures
  const titleRef = useRef(title)
  titleRef.current = title

  // The initial JSON content loaded from DB — used to hydrate the editor
  const [initialJson, setInitialJson] = useState<JSONContent | null>(null)

  /* ─── TipTap Editor ──────────────────────────────────────── */
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
    ],
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
        id: 'note-content',
      },
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON()
      const text = ed.getText()
      setWordCount(countWords(text))
      setSaveState('unsaved')
      debouncedSaveContent(json, text)
    },
  })

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
      })
      .catch(() => navigate('/notlar', { replace: true }))
      .finally(() => setLoading(false))
  }, [id, navigate])

  // When initialJson is ready and editor is available, hydrate it
  useEffect(() => {
    if (!editor || !initialJson || editor.isDestroyed) return
    editor.commands.setContent(initialJson)
  }, [editor, initialJson])

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

  /* ─── Debounced auto-save (~800ms) ───────────────────────── */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveContent = useCallback(
    debounce(async (json: JSONContent, text: string) => {
      if (!id) return
      setSaveState('saving')
      try {
        await updateNote(id, {
          title: titleRef.current,
          content_json: json,
          content_markdown: text,
        })
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 800),
    [id],
  )

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveTitle = useCallback(
    debounce(async (newTitle: string) => {
      if (!id || !editor || editor.isDestroyed) return
      setSaveState('saving')
      try {
        await updateNote(id, {
          title: newTitle,
          content_json: editor.getJSON(),
          content_markdown: editor.getText(),
        })
        setSaveState('saved')
      } catch {
        setSaveState('error')
      }
    }, 800),
    [id, editor],
  )

  const handleTitleChange = (v: string) => {
    setTitle(v)
    setSaveState('unsaved')
    debouncedSaveTitle(v)
  }

  const handleNewNote = async () => {
    if (!user) return
    const n = await createNote(user.id)
    navigate(`/notlar/${n.id}`)
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

  const handleRemoveTag = async (tagId: string) => {
    if (!id) return
    setNoteTags(prev => prev.filter(t => t.id !== tagId))
    await removeTagFromNote(id, tagId)
  }

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
    } finally {
      setExportingFormat(null)
      if (fmt !== 'pdf') setShowExport(false)
    }
  }

  /* ─── Loading state ──────────────────────────────────────── */
  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', backgroundColor: '#000000' }}>
        <Sidebar onNewNote={handleNewNote} />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 size={24} color="#4D8DFF" className="animate-spin" />
        </div>
      </div>
    )
  }

  if (!note) return null

  /* ─── TOOLBAR BUTTON helper ─────────────────────────────── */
  const TbBtn = ({ id: btnId, title: ttl, active, disabled, onClick, children }: {
    id: string; title: string; active?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode
  }) => (
    <button
      id={btnId}
      title={ttl}
      onClick={onClick}
      onMouseDown={e => e.preventDefault()} // CRITICAL: Prevent focus steal on click so selection remains active
      disabled={disabled}
      style={{
        width: '34px', height: '34px', borderRadius: '8px',
        background: active ? '#1A1A2E' : 'none',
        border: active ? '1px solid #4D8DFF44' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: active ? '#4D8DFF' : disabled ? '#333333' : '#9A9A9A',
        transition: 'all 150ms',
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        if (!active && !disabled) { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.color = '#fff' }
      }}
      onMouseLeave={e => {
        if (!active && !disabled) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9A9A9A' }
      }}
    >
      {children}
    </button>
  )

  /* ─── Tag badge (removable) ──────────────────────────────── */
  const TagBadge = ({ tag }: { tag: TagType }) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em',
      textTransform: 'uppercase', padding: '3px 8px 3px 10px',
      borderRadius: '6px', backgroundColor: '#111111',
      border: '1px solid #232323', color: '#9A9A9A',
    }}>
      {tag.name}
      <button
        title="Etiketi kaldır"
        onClick={() => handleRemoveTag(tag.id)}
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

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#000000', overflow: 'hidden' }}>

      {/* Sidebar */}
      <Sidebar 
        onNewNote={handleNewNote} 
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* ── Editor pane ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%' }}>

        {/* ── Sticky Toolbar ────────────────────────────── */}
        <div style={{
            display:         'flex',
            alignItems:      'center',
            minHeight:       '52px',
            padding:         '8px 12px',
            gap:             '6px',
            backgroundColor: '#080808',
            borderBottom:    '1px solid #232323',
            flexShrink:      0,
            overflowX:       'auto',
            scrollbarWidth:  'none', // for firefox
            msOverflowStyle: 'none', // for IE
          }}
          className="[&::-webkit-scrollbar]:hidden scroll-px-3"
        >
          {/* Hamburger Menu (Mobile Only) */}
          <button
            className="md:hidden mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-[#9A9A9A] transition-colors hover:bg-[#111111] hover:text-white"
            onClick={() => setIsSidebarOpen(true)}
            title="Menü"
          >
            <Menu size={18} />
          </button>

          {/* Back */}
          <Button variant="icon" size="sm" onClick={() => navigate('/notlar')} title="Geri" className="mr-1 shrink-0">
            <ArrowLeft size={16} />
          </Button>

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

          <div style={{ width: '1px', height: '16px', backgroundColor: '#232323', margin: '0 4px', flexShrink: 0 }} />

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

          <div style={{ width: '1px', height: '16px', backgroundColor: '#232323', margin: '0 4px', flexShrink: 0 }} />

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

          <div style={{ width: '1px', height: '16px', backgroundColor: '#232323', margin: '0 4px', flexShrink: 0 }} />

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

          <div style={{ width: '1px', height: '16px', backgroundColor: '#232323', margin: '0 4px', flexShrink: 0 }} />

          {/* Image insert */}
          <TbBtn id="tb-image" title="Görsel Ekle" onClick={() => imageCanvasRef.current?.triggerFileInput()}>
            <ImagePlus size={15} />
          </TbBtn>

          {/* Spacer */}
          <div style={{ flex: 1 }} />

          {/* Save indicator */}
          <SaveIndicator state={saveState} />

          <div style={{ width: '1px', height: '16px', backgroundColor: '#232323', margin: '0 6px' }} />

          {/* AI Toggle */}
          <button
            id="tb-ai-toggle"
            onClick={() => setAiEnabled(!aiEnabled)}
            title={aiEnabled ? 'AI Kapat' : 'AI Aç'}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              height: '28px', padding: '0 12px', borderRadius: '9999px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 200ms',
              backgroundColor: aiEnabled ? '#4D8DFF' : '#111111',
              border: aiEnabled ? 'none' : '1px solid #232323',
              color: aiEnabled ? '#fff' : '#555555',
            }}
          >
            <Zap size={12} />
            AI
          </button>

          <div style={{ width: '1px', height: '16px', backgroundColor: '#232323', margin: '0 6px' }} />

          {/* Export */}
          <button
            id="tb-export"
            onClick={() => setShowExport(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              height: '32px', padding: '0 12px', borderRadius: '8px',
              backgroundColor: 'transparent', border: '1px solid #232323',
              color: '#9A9A9A', fontSize: '13px', cursor: 'pointer', transition: 'all 150ms',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#4D8DFF'; e.currentTarget.style.color = '#fff' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#232323'; e.currentTarget.style.color = '#9A9A9A' }}
          >
            <Download size={14} />
            Dışa Aktar
          </button>

          <TbBtn id="tb-view" title="Görünüm"><Eye size={15} /></TbBtn>
          <TbBtn id="tb-more" title="Daha fazla"><MoreHorizontal size={15} /></TbBtn>
        </div>

        {/* ── Editor scrollable area ───────────────────── */}
        <div className="editor-surface" style={{ flex: 1, overflowY: 'auto' }}>
          <div 
            className="px-4 py-7 sm:px-5 md:px-8 md:py-10"
            style={{
              width: '100%',
              maxWidth: '720px',
              margin: '0 auto',
            }}
          >

            {/* Title */}
            <input
              id="note-title"
              type="text"
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Not başlığı…"
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
                <TagBadge key={tag.id} tag={tag} />
              ))}

              {/* Tag picker trigger */}
              <div style={{ position: 'relative' }} ref={tagPanelRef}>
                <button
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

            {/* AI ghost text example */}
            {aiEnabled && editor && editor.getText().length > 20 && (
              <div style={{ marginTop: '8px', fontSize: '14px', fontStyle: 'italic' }}>
                <span style={{ color: '#CCCCCC' }}>{editor.getText().slice(-30)}</span>
                <span style={{ opacity: 0.5, color: '#9A9A9A' }}> …devam ediyor</span>
                <p style={{ fontSize: '11px', fontStyle: 'normal', marginTop: '4px', color: '#3A3A3A' }}>
                  Tab ile kabul et · Diğer tuşla iptal et
                </p>
              </div>
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
            `${editor?.getText().length ?? 0} karakter`,
            `${Math.max(1, Math.ceil(wordCount / 200))} dk okuma`,
          ].map((txt, i) => (
            <span key={i} style={{ fontSize: '11px', lineHeight: 1.4, color: '#555555', whiteSpace: 'nowrap' }}>{txt}</span>
          ))}
        </div>
      </div>

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
                    color: isLoading ? '#4D8DFF' : '#4D8DFF', flexShrink: 0,
                    transition: 'all 200ms',
                  }}>
                    {isLoading
                      ? <Loader2 size={14} className="animate-spin" />
                      : fmt.icon
                    }
                  </span>

                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '14px', fontWeight: 500, color: isLoading ? '#4D8DFF' : '#ffffff', transition: 'color 150ms' }}>
                      {isLoading ? 'Oluşturuluyor…' : fmt.label}
                    </p>
                    <p style={{ fontSize: '12px', color: '#555555' }}>{fmt.desc}</p>
                  </div>

                  {!isLoading && <span style={{ color: '#555555' }}>›</span>}
                  {isLoading && <Check size={14} color="#4D8DFF" style={{ opacity: 0, transition: 'opacity 200ms' }} />}
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
function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#555555' }}>
      <Loader2 size={12} className="animate-spin" /> Kaydediliyor…
    </div>
  )
  if (state === 'saved') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#22C55E' }}>
      <Check size={12} /> Kaydedildi
    </div>
  )
  if (state === 'error') return <span style={{ fontSize: '12px', color: '#EF4444' }}>Kayıt hatası</span>
  return <span style={{ fontSize: '12px', color: '#555555' }}>Kaydedilmedi</span>
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
