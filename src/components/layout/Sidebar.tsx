import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, Tag, Settings, User, FileText, ChevronRight, Loader2, X, Zap } from 'lucide-react'
import { Divider } from '@/components/ui/Card'
import { useAuthStore } from '@/store/authStore'
import { getInitials } from '@/lib/utils'
import { signOut } from '@/features/auth/authService'
import { useFolders } from '@/features/notes/useFolders'
import { useTags } from '@/features/notes/useTags'

/* ─── Custom filled folder icon ─────────────────────────────── */
function FolderIcon({
  active  = false,
  isChild = false,
  size    = 15,
}: {
  active?:  boolean
  isChild?: boolean
  size?:    number
}) {
  const body = active
    ? '#4D8DFF'
    : isChild
      ? '#2A2748'
      : '#33305C'

  const tab = active
    ? '#7AB3FF'
    : isChild
      ? '#343060'
      : '#403C72'

  return (
    <svg width={size} height={size} viewBox="0 0 20 16" fill="none">
      <path
        d="M1 4C1 2.89543 1.89543 2 3 2H7.58579C7.851 2 8.10536 2.10536 8.29289 2.29289L9.70711 3.70711C9.89464 3.89464 10.149 4 10.4142 4H17C18.1046 4 19 4.89543 19 6V13C19 14.1046 18.1046 15 17 15H3C1.89543 15 1 14.1046 1 13V4Z"
        fill={body}
      />
      <path
        d="M1 4C1 2.89543 1.89543 2 3 2H7.58579C7.851 2 8.10536 2.10536 8.29289 2.29289L9.70711 3.70711C9.89464 3.89464 10.149 4 10.4142 4H17C18.1046 4 19 4.89543 19 6H1V4Z"
        fill={tab}
      />
      <rect x="1" y="6" width="18" height="1" fill="rgba(255,255,255,0.04)" />
    </svg>
  )
}

/* ─── Inline text input for creating folders/tags ────────────── */
function InlineCreateInput({
  placeholder,
  onConfirm,
  onCancel,
  loading,
}: {
  placeholder: string
  onConfirm: (value: string) => void
  onCancel: () => void
  loading?: boolean
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
    else onCancel()
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        style={{
          flex: 1, height: '26px', borderRadius: '6px',
          backgroundColor: '#111111', border: '1px solid #4D8DFF44',
          color: '#ffffff', fontSize: '12px', padding: '0 8px',
          outline: 'none',
        }}
      />
      {loading ? (
        <Loader2 size={12} color="#4D8DFF" style={{ flexShrink: 0 }} className="animate-spin" />
      ) : (
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555555', display: 'flex', padding: '2px' }}
        >
          <X size={12} />
        </button>
      )}
    </div>
  )
}

/* ─── Types ──────────────────────────────────────────────────── */
interface SidebarProps {
  onNewNote:        () => void
  activeFolderId?:  string | null
  activeTagId?:     string | null
  onFolderSelect?:  (id: string | null) => void
  onTagSelect?:     (id: string | null) => void
  isOpen?:          boolean
  onClose?:         () => void
}

export function Sidebar({
  onNewNote,
  activeFolderId,
  activeTagId,
  onFolderSelect,
  onTagSelect,
  isOpen = false,
  onClose,
}: SidebarProps) {
  const navigate    = useNavigate()
  const location    = useLocation()
  const profile     = useAuthStore(s => s.profile)
  const user        = useAuthStore(s => s.user)
  const displayName = profile?.display_name ?? user?.email?.split('@')[0] ?? 'Kullanıcı'
  const initials    = getInitials(displayName)

  // Real data hooks
  const { rootFolders, childFolders, addFolder, loading: foldersLoading } = useFolders()
  const { tags, addTag, loading: tagsLoading } = useTags()

  // Expanded folder state (local UI state only)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Inline create states
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [creatingChildFor, setCreatingChildFor] = useState<string | null>(null) // parentId
  const [savingFolder, setSavingFolder] = useState(false)
  const [creatingTag, setCreatingTag] = useState(false)
  const [savingTag, setSavingTag] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/giris', { replace: true })
  }

  const toggleExpand = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }

  const handleCreateFolder = async (name: string, parentId: string | null = null) => {
    setSavingFolder(true)
    const folder = await addFolder(name, parentId)
    setSavingFolder(false)
    setCreatingFolder(false)
    setCreatingChildFor(null)
    if (folder && parentId) {
      // Auto-expand parent
      setExpandedFolders(prev => new Set([...prev, parentId]))
    }
  }

  const handleCreateTag = async (name: string) => {
    setSavingTag(true)
    await addTag(name)
    setSavingTag(false)
    setCreatingTag(false)
  }

  const handleFolderClick = (folderId: string) => {
    onTagSelect?.(null)      // clear tag filter
    onFolderSelect?.(folderId)
    onClose?.()
    navigate('/notlar')
  }

  const handleTagClick = (tagId: string) => {
    // If clicking the already-active tag, deselect (show all)
    if (activeTagId === tagId) {
      onTagSelect?.(null)
      onFolderSelect?.(undefined as unknown as null) // reset to "all notes"
    } else {
      onFolderSelect?.(undefined as unknown as null) // clear folder filter
      onTagSelect?.(tagId)
    }
    onClose?.()
    navigate('/notlar')
  }

  const handleAllNotesClick = () => {
    onFolderSelect?.(null)
    onTagSelect?.(null)
    onClose?.()
    navigate('/notlar')
  }

  const navItemStyle = (active: boolean): React.CSSProperties => ({
    display:         'flex',
    alignItems:      'center',
    gap:             '8px',
    width:           '100%',
    padding:         '6px 8px',
    borderRadius:    '8px',
    border:          'none',
    background:      active ? 'rgba(77,141,255,0.1)' : 'transparent',
    color:           active ? '#4D8DFF' : '#9A9A9A',
    fontSize:        '13px',
    cursor:          'pointer',
    textAlign:       'left',
    transition:      'all 150ms',
    textDecoration:  'none',
  })

  const isAllNotesActive = activeFolderId === null && !activeTagId && location.pathname === '/notlar'

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      <aside 
        className={`
          fixed md:relative inset-y-0 left-0 z-50
          w-[280px] md:w-[280px]
          flex flex-col h-full shrink-0
          transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{
          backgroundColor: '#0D0D0D',
          borderRight:     '1px solid #1A1A1A',
        }}
      >

      {/* ── Header: Brand + User avatar ─────────────────── */}
      <div style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '12px 16px',
        borderBottom:   '1px solid #232323',
        flexShrink:     0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: '#111111', border: '1px solid #232323', display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Zap size={16} color="#4D8DFF" fill="#4D8DFF" />
          </div>
          <span style={{ fontSize: '18px', fontWeight: 600, letterSpacing: '-0.02em', color: '#ffffff' }}>NoteForge</span>
        </div>
        <button
          onClick={handleSignOut}
          title={`Çıkış Yap (${user?.email})`}
          style={{
            width: '28px', height: '28px', borderRadius: '50%',
            backgroundColor: '#232323', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 600, color: '#9A9A9A',
            transition: 'all 150ms',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.backgroundColor = '#3A3A3A'
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.backgroundColor = '#232323'
            e.currentTarget.style.color = '#9A9A9A'
          }}
        >
          {initials || <User size={12} />}
        </button>
      </div>

      {/* ── New Note Button ──────────────────────────────── */}
      <div style={{ padding: '12px 12px 4px' }}>
        <button
          onClick={onNewNote}
          id="btn-new-note"
          style={{
            width:           '100%',
            height:          '36px',
            borderRadius:    '8px',
            backgroundColor: '#4D8DFF',
            color:           '#ffffff',
            fontSize:        '14px',
            fontWeight:      500,
            border:          'none',
            cursor:          'pointer',
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            gap:             '6px',
            transition:      'background-color 150ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#3D7AEE')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#4D8DFF')}
        >
          <Plus size={16} />
          Yeni Not
        </button>
      </div>

      {/* ── Scrollable nav area ──────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>

        {/* All Notes */}
        <button
          onClick={handleAllNotesClick}
          style={navItemStyle(isAllNotesActive)}
          onMouseEnter={e => {
            if (!isAllNotesActive) e.currentTarget.style.backgroundColor = '#111111'
          }}
          onMouseLeave={e => {
            if (!isAllNotesActive) e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <FileText size={14} />
          Tüm Notlar
        </button>

        <Divider style={{ margin: '8px 0' }} />

        {/* ── Folders section ──────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px', marginBottom: '4px',
        }}>
          <span className="label-caps">Klasörler</span>
          <button
            id="btn-new-folder"
            title="Yeni klasör oluştur"
            onClick={() => { setCreatingFolder(true); setCreatingChildFor(null) }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555555', display: 'flex', padding: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9A9A9A')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
          >
            <Plus size={12} />
          </button>
        </div>

        {/* Inline new root-folder input */}
        {creatingFolder && !creatingChildFor && (
          <InlineCreateInput
            placeholder="Klasör adı…"
            onConfirm={name => handleCreateFolder(name, null)}
            onCancel={() => setCreatingFolder(false)}
            loading={savingFolder}
          />
        )}

        {foldersLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
            <Loader2 size={14} color="#555555" className="animate-spin" />
          </div>
        ) : rootFolders.length === 0 && !creatingFolder ? (
          <p style={{ fontSize: '12px', color: '#3A3A3A', padding: '4px 8px' }}>
            Henüz klasör yok
          </p>
        ) : (
          rootFolders.map(folder => {
            const children = childFolders(folder.id)
            const isExpanded = expandedFolders.has(folder.id)
            const isActive = activeFolderId === folder.id

            return (
              <div key={folder.id}>
                {/* Root folder row */}
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    onClick={() => handleFolderClick(folder.id)}
                    style={{ ...navItemStyle(isActive), flex: 1 }}
                    onMouseEnter={e => {
                      if (!isActive) e.currentTarget.style.backgroundColor = '#111111'
                    }}
                    onMouseLeave={e => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <ChevronRight
                      size={11}
                      onClick={e => { e.stopPropagation(); toggleExpand(folder.id) }}
                      style={{
                        flexShrink:  0,
                        color:       children.length > 0 ? '#555555' : 'transparent',
                        transform:   isExpanded ? 'rotate(90deg)' : 'none',
                        transition:  'transform 150ms',
                        cursor:      children.length > 0 ? 'pointer' : 'default',
                      }}
                    />
                    <span style={{ flexShrink: 0, display: 'flex' }}>
                      <FolderIcon active={isActive} isChild={false} size={15} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {folder.name}
                    </span>
                  </button>
                  {/* Sub-folder create button */}
                  <button
                    title="Alt klasör oluştur"
                    onClick={() => { setCreatingChildFor(folder.id); setCreatingFolder(false); setExpandedFolders(prev => new Set([...prev, folder.id])) }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: '#555555', display: 'flex', padding: '4px',
                      opacity: 0, transition: 'opacity 150ms',
                    }}
                    className="folder-add-child-btn"
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1'; e.currentTarget.style.color = '#9A9A9A' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '0'; e.currentTarget.style.color = '#555555' }}
                  >
                    <Plus size={10} />
                  </button>
                </div>

                {/* Inline new child-folder input */}
                {creatingChildFor === folder.id && (
                  <div style={{ paddingLeft: '16px' }}>
                    <InlineCreateInput
                      placeholder="Alt klasör adı…"
                      onConfirm={name => handleCreateFolder(name, folder.id)}
                      onCancel={() => setCreatingChildFor(null)}
                      loading={savingFolder}
                    />
                  </div>
                )}

                {/* Child folders */}
                {isExpanded && children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => handleFolderClick(child.id)}
                    style={{
                      ...navItemStyle(activeFolderId === child.id),
                      paddingLeft: '28px',
                    }}
                    onMouseEnter={e => {
                      if (activeFolderId !== child.id) e.currentTarget.style.backgroundColor = '#111111'
                    }}
                    onMouseLeave={e => {
                      if (activeFolderId !== child.id) e.currentTarget.style.backgroundColor = 'transparent'
                    }}
                  >
                    <span style={{ flexShrink: 0, display: 'flex' }}>
                      <FolderIcon active={activeFolderId === child.id} isChild={true} size={13} />
                    </span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {child.name}
                    </span>
                  </button>
                ))}
              </div>
            )
          })
        )}

        <Divider style={{ margin: '8px 0' }} />

        {/* ── Tags section ──────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '4px 8px', marginBottom: '4px',
        }}>
          <span className="label-caps">Etiketler</span>
          <button
            id="btn-new-tag"
            title="Yeni etiket oluştur"
            onClick={() => setCreatingTag(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#555555', display: 'flex', padding: '2px' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#9A9A9A')}
            onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
          >
            <Plus size={12} />
          </button>
        </div>

        {tagsLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <Loader2 size={14} color="#555555" className="animate-spin" />
          </div>
        ) : (
          <>
            {tags.map(tag => {
              const isActive = activeTagId === tag.id
              return (
                <button
                  key={tag.id}
                  id={`tag-${tag.id}`}
                  onClick={() => handleTagClick(tag.id)}
                  style={{
                    ...navItemStyle(isActive),
                    color: isActive ? '#4D8DFF' : '#9A9A9A',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = '#111111'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'
                  }}
                >
                  <Tag size={12} style={{ flexShrink: 0 }} />
                  {tag.name}
                </button>
              )
            })}

            {/* Inline new-tag input */}
            {creatingTag ? (
              <InlineCreateInput
                placeholder="Etiket adı…"
                onConfirm={handleCreateTag}
                onCancel={() => setCreatingTag(false)}
                loading={savingTag}
              />
            ) : (
              <button
                onClick={() => setCreatingTag(true)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                  fontSize: '12px', color: '#555555', padding: '4px 8px',
                  transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#9A9A9A')}
                onMouseLeave={e => (e.currentTarget.style.color = '#555555')}
              >
                + Etiket ekle
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div style={{
        display:     'flex',
        alignItems:  'center',
        gap:         '4px',
        padding:     '10px 12px',
        borderTop:   '1px solid #232323',
        flexShrink:  0,
      }}>
        <button
          title="Ayarlar"
          onClick={() => navigate('/ayarlar')}
          style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#9A9A9A', transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9A9A9A' }}
        >
          <Settings size={16} />
        </button>

        <button
          title="Profil"
          style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#9A9A9A', transition: 'all 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.backgroundColor = '#111111'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = '#9A9A9A' }}
        >
          <User size={16} />
        </button>

        <div style={{ flex: 1 }} />

        <span
          style={{ fontSize: '11px', color: '#555555', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}
          title={user?.email ?? ''}
        >
          {user?.email}
        </span>
      </div>
    </aside>
    </>
  )
}
