import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Grid, List, Clock, ArrowUpDown, Trash2, FolderOpen, Menu } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Spinner } from '@/components/ui/Spinner'
import { useNotes } from './useNotes'
import { useFolders } from './useFolders'
import { useTags } from './useTags'
import { updateNote } from './notesService'
import { formatRelativeDate, truncate } from '@/lib/utils'
import type { NoteWithTags } from '@/types/database'
import { useSearchStore } from '@/store/searchStore'

export function NoteListPage() {
  const navigate = useNavigate()

  // Active filter state — shared between Sidebar and the note list
  const [activeFolderId, setActiveFolderId] = useState<string | null | undefined>(undefined)
  const [activeTagId, setActiveTagId]       = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen]   = useState(false)

  // useNotes respects both filters
  const { notes, loading, error, addNote, removeNote, reload } = useNotes({
    folderId: activeTagId ? undefined : activeFolderId,
    tagId:    activeTagId ?? undefined,
  })

  // Folder & tag data for move-to-folder UI
  const { folders } = useFolders()
  const { tags }    = useTags()

  const { open: openSearch } = useSearchStore()

  const [viewMode, setViewMode]         = useState<'grid' | 'list'>('list')
  const [selectedNote, setSelectedNote] = useState<NoteWithTags | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<NoteWithTags | null>(null)
  const [deleting, setDeleting]         = useState(false)

  // Move-to-folder modal
  const [moveTarget, setMoveTarget]   = useState<NoteWithTags | null>(null)
  const [movingFolder, setMovingFolder] = useState(false)

  const filtered = notes

  const handleNewNote = async () => {
    // Create note in the currently active folder (if any, and not tag-filtered)
    const targetFolder = activeTagId ? null : (activeFolderId ?? null)
    const note = await addNote(targetFolder)
    if (note) navigate(`/notlar/${note.id}`)
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    await removeNote(deleteTarget.id)
    if (selectedNote?.id === deleteTarget.id) setSelectedNote(null)
    setDeleteTarget(null)
    setDeleting(false)
  }

  const handleMoveToFolder = async (folderId: string | null) => {
    if (!moveTarget) return
    setMovingFolder(true)
    try {
      await updateNote(moveTarget.id, { folder_id: folderId })
      await reload()
      setMoveTarget(null)
    } finally {
      setMovingFolder(false)
    }
  }

  // Determine a human-readable section title
  const sectionTitle = useCallback(() => {
    if (activeTagId) {
      const tag = tags.find(t => t.id === activeTagId)
      return tag ? `#${tag.name}` : 'Etiket'
    }
    if (activeFolderId) {
      const folder = folders.find(f => f.id === activeFolderId)
      return folder?.name ?? 'Klasör'
    }
    return 'Tüm Notlar'
  }, [activeTagId, activeFolderId, tags, folders])

  const handleFolderSelect = (id: string | null) => {
    setActiveFolderId(id ?? undefined)
    setActiveTagId(null)
  }

  const handleTagSelect = (id: string | null) => {
    setActiveTagId(id)
    if (id) setActiveFolderId(undefined)
  }

  return (
    <div style={{
      display:         'flex',
      height:          '100vh',
      width:           '100%',
      backgroundColor: '#000000',
      overflow:        'hidden',
    }}>

      {/* Sidebar */}
      <Sidebar
        onNewNote={handleNewNote}
        activeFolderId={activeFolderId ?? null}
        activeTagId={activeTagId}
        onFolderSelect={handleFolderSelect}
        onTagSelect={handleTagSelect}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* ── Main content area ──────────────────────────────── */}
      <div style={{
        flex:          1,
        display:       'flex',
        flexDirection: 'column',
        height:        '100%',
        overflow:      'hidden',
        minWidth:      0,
      }}>

        {/* ── Page header ────────────────────────────────── */}
        <div style={{
          padding:      '28px 32px 16px',
          flexShrink:   0,
          borderBottom: '1px solid #111111',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '16px' }}>
            {/* Title + count */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <button
                className="md:hidden p-2 -ml-2 rounded-lg text-[#9A9A9A] hover:bg-[#111111] hover:text-white transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              <div>
              <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>
                {sectionTitle()}
              </h1>
              {!loading && (
                <span style={{ fontSize: '12px', color: '#3A3A3A', marginTop: '4px', display: 'block' }}>
                  {notes.length} not
                </span>
              )}
            </div>
            </div>

            {/* Controls: sort + view toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Button variant="icon" size="sm" title="Sırala" id="btn-sort">
                <ArrowUpDown size={14} />
              </Button>

              {/* Grid toggle */}
              <div style={{
                display:         'flex',
                alignItems:      'center',
                backgroundColor: '#0D0D0D',
                border:          '1px solid #232323',
                borderRadius:    '8px',
                padding:         '2px',
                gap:             '2px',
              }}>
                <button
                  id="btn-view-list"
                  title="Liste görünümü"
                  onClick={() => setViewMode('list')}
                  style={{
                    width:           '28px',
                    height:          '26px',
                    borderRadius:    '6px',
                    border:          'none',
                    cursor:          'pointer',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    backgroundColor: viewMode === 'list' ? '#1E1E1E' : 'transparent',
                    color:           viewMode === 'list' ? '#ffffff' : '#555555',
                    transition:      'all 120ms',
                  }}
                >
                  <List size={14} />
                </button>
                <button
                  id="btn-view-grid"
                  title="Grid görünümü"
                  onClick={() => setViewMode('grid')}
                  style={{
                    width:           '28px',
                    height:          '26px',
                    borderRadius:    '6px',
                    border:          'none',
                    cursor:          'pointer',
                    display:         'flex',
                    alignItems:      'center',
                    justifyContent:  'center',
                    backgroundColor: viewMode === 'grid' ? '#1E1E1E' : 'transparent',
                    color:           viewMode === 'grid' ? '#ffffff' : '#555555',
                    transition:      'all 120ms',
                  }}
                >
                  <Grid size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', maxWidth: '420px' }}>
            <Search
              size={14}
              color="#3A3A3A"
              style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
            />
            <input
              type="text"
              readOnly
              placeholder="Notlarda ara… (Ctrl+K)"
              onClick={openSearch}
              id="note-search"
              style={{
                width:           '100%',
                height:          '38px',
                paddingLeft:     '36px',
                paddingRight:    '12px',
                borderRadius:    '9px',
                backgroundColor: '#080808',
                border:          '1px solid #1A1A1A',
                fontSize:        '13px',
                color:           '#9A9A9A',
                outline:         'none',
                cursor:          'pointer',
                boxSizing:       'border-box',
                transition:      'border-color 150ms',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#2A2A2A')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A1A1A')}
            />
          </div>
        </div>

        {/* ── Scrollable note area ───────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px 32px' }}>

          {/* Error banner */}
          {error && (
            <div style={{
              marginBottom: '16px', padding: '12px 16px', borderRadius: '8px',
              backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: '#EF4444', marginBottom: '2px' }}>Supabase bağlantı hatası</p>
              <p style={{ fontSize: '11px', color: '#9A9A9A' }}>{error}</p>
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px' }}>
              <Spinner />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyNoteList onNewNote={handleNewNote} hasSearch={false} />
          ) : viewMode === 'grid' ? (
            /* ── Grid view ── */
            /* ── Grid view ── */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isActive={selectedNote?.id === note.id}
                  onClick={() => { setSelectedNote(note); navigate(`/notlar/${note.id}`) }}
                  onDelete={() => setDeleteTarget(note)}
                  onMove={() => setMoveTarget(note)}
                />
              ))}
            </div>
          ) : (
            /* ── List view ── */
            <>
              {/* Column header row */}
              <div style={{
                display:       'flex',
                alignItems:    'center',
                gap:           '12px',
                padding:       '0 10px 8px',
                borderBottom:  '1px solid #111111',
                marginBottom:  '4px',
              }}>
                <span style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#333', flexShrink: 0 }} className="w-auto md:w-[200px] flex-1 md:flex-none">Başlık</span>
                <span className="hidden md:inline-block" style={{ width: '1px', height: '10px', backgroundColor: '#1A1A1A', flexShrink: 0 }} />
                <span className="hidden md:inline-block" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#333', flex: 1 }}>İçerik</span>
                <span className="hidden md:inline-block" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#333', width: '100px', flexShrink: 0 }}>Etiket</span>
                <span className="hidden md:inline-block" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#333', width: '64px', flexShrink: 0, textAlign: 'right' }}>Tarih</span>
                <span style={{ width: '48px', flexShrink: 0 }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {filtered.map(note => (
                  <NoteRow
                    key={note.id}
                    note={note}
                    isActive={selectedNote?.id === note.id}
                    onClick={() => { setSelectedNote(note); navigate(`/notlar/${note.id}`) }}
                    onDelete={() => setDeleteTarget(note)}
                    onMove={() => setMoveTarget(note)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Delete confirmation modal ─────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} size="sm">
        <div style={{ padding: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Trash2 size={14} color="#EF4444" />
            </div>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 500, color: '#ffffff' }}>
                Bu notu silmek istiyor musun?
              </h3>
              <p style={{ fontSize: '13px', color: '#9A9A9A', marginTop: '4px' }}>Bu işlem geri alınamaz.</p>
              {deleteTarget && (
                <p style={{ fontSize: '13px', color: '#ffffff', marginTop: '4px', fontStyle: 'italic' }}>
                  "{deleteTarget.title}"
                </p>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} id="btn-cancel-delete">
              Vazgeç
            </Button>
            <Button variant="danger-ghost" size="sm" loading={deleting} onClick={handleDeleteConfirm} id="btn-confirm-delete">
              Sil
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Move to folder modal ─────────────────────────── */}
      <Modal open={!!moveTarget} onClose={() => setMoveTarget(null)} title="Klasöre Taşı" size="sm">
        <div>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #1A1A1A' }}>
            <p style={{ fontSize: '13px', color: '#9A9A9A' }}>
              <span style={{ color: '#fff' }}>{moveTarget?.title}</span> notunu taşı:
            </p>
          </div>

          {/* "No folder" option */}
          <button
            onClick={() => handleMoveToFolder(null)}
            disabled={movingFolder}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
              padding: '12px 16px', background: 'none', border: 'none',
              cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
              color: moveTarget?.folder_id == null ? '#4D8DFF' : '#9A9A9A',
              fontSize: '14px',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#111111')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <FolderOpen size={14} />
            Klasör yok (kök)
            {moveTarget?.folder_id == null && (
              <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4D8DFF' }}>✓ mevcut</span>
            )}
          </button>

          <div style={{ margin: '0 16px', borderTop: '1px solid #1A1A1A' }} />

          {folders.map((folder, idx) => (
            <div key={folder.id}>
              <button
                id={`move-folder-${folder.id}`}
                onClick={() => handleMoveToFolder(folder.id)}
                disabled={movingFolder}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '12px 16px',
                  paddingLeft: folder.parent_id ? '28px' : '16px',
                  background: 'none', border: 'none',
                  cursor: 'pointer', textAlign: 'left', transition: 'background 150ms',
                  color: moveTarget?.folder_id === folder.id ? '#4D8DFF' : '#9A9A9A',
                  fontSize: '14px',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#111111')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ fontSize: '12px' }}>{folder.parent_id ? '└' : '📁'}</span>
                {folder.name}
                {moveTarget?.folder_id === folder.id && (
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#4D8DFF' }}>✓ mevcut</span>
                )}
              </button>
              {idx < folders.length - 1 && (
                <div style={{ margin: '0 16px', borderTop: '1px solid #1A1A1A' }} />
              )}
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

/* ─── Note Card ─────────────────────────────────────────── */
interface NoteCardProps {
  note:     NoteWithTags
  isActive: boolean
  onClick:  () => void
  onDelete: () => void
  onMove:   () => void
}

function NoteCard({ note, isActive, onClick, onDelete, onMove }: NoteCardProps) {
  return (
    <div
      onClick={onClick}
      className="group"
      style={{
        position:        'relative',
        padding:         '18px 16px 14px',
        borderRadius:    '4px',
        cursor:          'pointer',
        transition:      'all 150ms ease',
        backgroundColor: isActive ? '#111828' : '#0A0A0A',
        border:          isActive ? '1px solid rgba(77,141,255,0.4)' : '1px solid #181818',
        display:         'flex',
        flexDirection:   'column',
        gap:             '8px',
        minHeight:       '140px',
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '#0D0D0D'
          e.currentTarget.style.borderColor     = '#252525'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '#0A0A0A'
          e.currentTarget.style.borderColor     = '#181818'
        }
      }}
    >
      {/* Header: title + action buttons */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <h3 style={{
          fontSize: '15px', fontWeight: 600, lineHeight: 1.3,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          color: isActive ? '#ffffff' : '#E0E0E0', flex: 1,
        }}>
          {note.title || 'Başlıksız'}
        </h3>
        <div style={{ display: 'flex', gap: '2px', flexShrink: 0, opacity: 0 }} className="group-hover:opacity-100">
          <button
            onClick={e => { e.stopPropagation(); onMove() }}
            title="Klasöre taşı"
            style={{ color: '#444', background: 'none', border: 'none', cursor: 'pointer', padding: '3px', borderRadius: '4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#4D8DFF')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444')}
          >
            <FolderOpen size={12} />
          </button>
          <button
            onClick={e => { e.stopPropagation(); onDelete() }}
            title="Sil"
            style={{ color: '#444', background: 'none', border: 'none', cursor: 'pointer', padding: '3px', borderRadius: '4px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
            onMouseLeave={e => (e.currentTarget.style.color = '#444')}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content preview */}
      {note.content_markdown && (
        <p style={{
          fontSize: '12px', color: '#444444', lineHeight: 1.6,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical',
          overflow: 'hidden', flex: 1,
        }}>
          {note.content_markdown}
        </p>
      )}

      {/* Footer: tags + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', overflow: 'hidden' }}>
          {note.tags.slice(0, 3).map(tag => (
            <span
              key={tag.id}
              style={{
                fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em',
                textTransform: 'uppercase', padding: '2px 6px',
                borderRadius: '4px', backgroundColor: '#111111',
                border: '1px solid #222222', color: '#555555',
              }}
            >
              {tag.name}
            </span>
          ))}
        </div>
        <span style={{ fontSize: '11px', color: '#333333', flexShrink: 0 }}>
          {formatRelativeDate(note.updated_at)}
        </span>
      </div>
    </div>
  )
}

/* ─── Note Row (list view) ───────────────────────────────── */
function NoteRow({ note, isActive, onClick, onDelete, onMove }: NoteCardProps) {
  return (
    <div
      onClick={onClick}
      className="group"
      style={{
        display:         'flex',
        alignItems:      'center',
        gap:             '12px',
        padding:         '8px 10px',
        borderRadius:    '8px',
        cursor:          'pointer',
        transition:      'all 120ms ease',
        backgroundColor: isActive ? '#0D0D0D' : 'transparent',
        border:          isActive ? '1px solid rgba(77,141,255,0.35)' : '1px solid transparent',
        borderLeft:      isActive ? '2px solid #4D8DFF' : '2px solid transparent',
        minWidth:        0,
      }}
      onMouseEnter={e => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = '#0A0A0A'
          e.currentTarget.style.borderColor     = '#1E1E1E'
        }
      }}
      onMouseLeave={e => {
        if (!isActive) {
          e.currentTarget.style.backgroundColor = 'transparent'
          e.currentTarget.style.border          = '1px solid transparent'
          e.currentTarget.style.borderLeft      = '2px solid transparent'
        }
      }}
    >
      {/* Title — fixed width, no wrap */}
      {/* Title — fixed width on desktop, flex-1 on mobile */}
      <span className="w-auto flex-1 md:w-[180px] md:flex-none" style={{
        fontSize:     '13px',
        fontWeight:   500,
        color:        isActive ? '#ffffff' : '#CCCCCC',
        whiteSpace:   'nowrap',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        flexShrink:   0,
      }}>
        {note.title || 'Başlıksız'}
      </span>

      {/* Divider */}
      <span className="hidden md:inline-block" style={{ width: '1px', height: '14px', backgroundColor: '#1E1E1E', flexShrink: 0 }} />

      {/* Content preview — grows to fill available space */}
      <span className="hidden md:inline-block" style={{
        fontSize:     '12px',
        color:        '#444444',
        whiteSpace:   'nowrap',
        overflow:     'hidden',
        textOverflow: 'ellipsis',
        flex:         1,
        minWidth:     0,
      }}>
        {note.content_markdown ? truncate(note.content_markdown, 120) : '—'}
      </span>

      {/* Tags — up to 2, fixed width area */}
      <div className="hidden md:flex" style={{ gap: '4px', flexShrink: 0, width: '100px', overflow: 'hidden' }}>
        {note.tags.slice(0, 2).map(tag => (
          <span
            key={tag.id}
            style={{
              fontSize:        '10px',
              fontWeight:      600,
              letterSpacing:   '0.05em',
              textTransform:   'uppercase',
              padding:         '1px 5px',
              borderRadius:    '3px',
              backgroundColor: '#111111',
              border:          '1px solid #232323',
              color:           '#555555',
            }}
          >
            {tag.name}
          </span>
        ))}
        {note.tags.length > 2 && (
          <span style={{ fontSize: '10px', color: '#444', alignSelf: 'center' }}>+{note.tags.length - 2}</span>
        )}
      </div>

      {/* Date */}
      <span className="hidden md:inline-block" style={{
        fontSize:   '11px',
        color:      '#555555',
        width:      '64px',
        flexShrink: 0,
        textAlign:  'right',
      }}>
        {formatRelativeDate(note.updated_at)}
      </span>

      {/* Action buttons — visible on hover */}
      <div style={{ display: 'flex', gap: '2px', flexShrink: 0, opacity: 0 }} className="group-hover:opacity-100">
        <button
          onClick={e => { e.stopPropagation(); onMove() }}
          title="Klasöre taşı"
          style={{
            color: '#555555', background: 'none', border: 'none',
            cursor: 'pointer', padding: '3px', borderRadius: '4px', transition: 'color 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#4D8DFF')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
        >
          <FolderOpen size={12} />
        </button>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          title="Sil"
          style={{
            color: '#555555', background: 'none', border: 'none',
            cursor: 'pointer', padding: '3px', borderRadius: '4px', transition: 'color 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = '#EF4444')}
          onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

/* ─── Empty State ────────────────────────────────────────── */
interface EmptyNoteListProps {
  onNewNote:  () => void
  hasSearch?: boolean
}

function EmptyNoteList({ onNewNote, hasSearch }: EmptyNoteListProps) {
  if (hasSearch) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '160px' }}>
        <p style={{ fontSize: '13px', color: '#555555' }}>Arama sonucu bulunamadı.</p>
      </div>
    )
  }

  return (
    <div
      className="animate-fade-in"
      style={{
        display:        'flex',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        textAlign:      'center',
        padding:        '48px 24px',
      }}
    >
      <div style={{
        width: '56px', height: '56px', borderRadius: '16px',
        backgroundColor: '#0D0D0D', border: '1px solid #232323',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '20px',
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          <line x1="12" y1="6" x2="16" y2="6"/>
          <line x1="12" y1="10" x2="16" y2="10"/>
          <line x1="12" y1="14" x2="16" y2="14"/>
        </svg>
      </div>

      <p className="label-caps" style={{ color: '#555555', marginBottom: '10px' }}>Henüz not yok</p>
      <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', marginBottom: '8px' }}>
        Düşüncelerini buraya dök.
      </h3>
      <p style={{ fontSize: '12px', color: '#555555', marginBottom: '20px', lineHeight: 1.6 }}>
        Not oluşturmak için aşağıdaki butona tıkla.
      </p>

      <button
        onClick={onNewNote}
        id="btn-empty-new-note"
        style={{
          height:          '36px',
          padding:         '0 16px',
          borderRadius:    '8px',
          backgroundColor: '#4D8DFF',
          color:           '#ffffff',
          fontSize:        '13px',
          fontWeight:      500,
          border:          'none',
          cursor:          'pointer',
          display:         'inline-flex',
          alignItems:      'center',
          gap:             '6px',
          transition:      'background-color 150ms',
          whiteSpace:      'nowrap',
        }}
        onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#3D7AEE')}
        onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#4D8DFF')}
      >
        + Yeni Not Oluştur
      </button>
    </div>
  )
}
