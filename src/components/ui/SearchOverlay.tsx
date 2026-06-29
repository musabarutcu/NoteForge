import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, FileText, ArrowRight } from 'lucide-react'
import { useSearchStore } from '@/store/searchStore'
import { useAuth } from '@/hooks/useAuth'
import { searchNotesGlobally } from '@/features/notes/notesService'
import { useDebounce } from '@/hooks/useDebounce'
import type { NoteWithTags } from '@/types/database'

function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim() || !text) return <>{text}</>

  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return <>{text}</>

  const regex = new RegExp(`(${terms.join('|')})`, 'gi')
  const parts = text.split(regex)

  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ backgroundColor: 'rgba(77,141,255,0.3)', color: '#fff', borderRadius: '2px', padding: '0 2px' }}>
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  )
}

function getSnippet(text: string, query: string, maxLength: number = 80): string {
  if (!text) return ''
  const terms = query.trim().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return text.slice(0, maxLength)

  const regex = new RegExp(`(${terms.join('|')})`, 'i')
  const match = text.match(regex)
  
  if (!match || match.index === undefined) return text.slice(0, maxLength)
  
  const start = Math.max(0, match.index - 30)
  let snippet = text.slice(start, start + maxLength)
  if (start > 0) snippet = '...' + snippet
  if (start + maxLength < text.length) snippet = snippet + '...'
  
  return snippet
}

export function SearchOverlay() {
  const { isOpen, query, setQuery, toggle, close } = useSearchStore()
  const { user } = useAuth()
  const navigate = useNavigate()
  
  const [results, setResults] = useState<NoteWithTags[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const debouncedQuery = useDebounce(query, 300)

  // Global Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        toggle()
      }
      if (e.key === 'Escape') {
        close()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle, close])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setActiveIndex(0)
    }
  }, [isOpen])

  // Fetch results
  useEffect(() => {
    if (!isOpen || !user) return

    if (!debouncedQuery.trim()) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    searchNotesGlobally(user.id, debouncedQuery)
      .then(res => {
        setResults(res)
        setActiveIndex(0)
      })
      .catch(err => console.error('Search error:', err))
      .finally(() => setLoading(false))
  }, [debouncedQuery, isOpen, user])

  // Navigation within overlay
  useEffect(() => {
    if (!isOpen) return
    const handleOverlayKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex(prev => (prev > 0 ? prev - 1 : prev))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (results.length > 0 && results[activeIndex]) {
          navigate(`/notlar/${results[activeIndex].id}`)
          close()
        }
      }
    }
    window.addEventListener('keydown', handleOverlayKeyDown)
    return () => window.removeEventListener('keydown', handleOverlayKeyDown)
  }, [isOpen, results, activeIndex, navigate, close])

  if (!isOpen) return null

  return (
    <div 
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
        paddingTop: '10vh'
      }}
      onClick={close}
    >
      <div 
        style={{
          width: '100%', maxWidth: '600px',
          backgroundColor: '#0D0D0D',
          border: '1px solid #232323',
          borderRadius: '12px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header / Input */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '16px', borderBottom: '1px solid #232323' }}>
          <Search size={20} color="#9A9A9A" style={{ marginRight: '12px' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Notlarda ara..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '16px',
            }}
          />
          {loading && <div className="animate-spin" style={{ width: '16px', height: '16px', border: '2px solid #4D8DFF', borderTopColor: 'transparent', borderRadius: '50%' }} />}
        </div>

        {/* Results List */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {results.length === 0 && debouncedQuery && !loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: '#9A9A9A' }}>
              Sonuç bulunamadı.
            </div>
          ) : (
            results.map((note, idx) => (
              <div
                key={note.id}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => {
                  navigate(`/notlar/${note.id}`)
                  close()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '16px',
                  borderBottom: '1px solid #1A1A1A',
                  cursor: 'pointer',
                  backgroundColor: activeIndex === idx ? '#111111' : 'transparent',
                  borderLeft: activeIndex === idx ? '3px solid #4D8DFF' : '3px solid transparent'
                }}
              >
                <FileText size={20} color={activeIndex === idx ? '#4D8DFF' : '#555'} style={{ marginRight: '16px', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: activeIndex === idx ? '#fff' : '#ccc', marginBottom: '4px' }}>
                    <HighlightMatch text={note.title} query={debouncedQuery} />
                  </div>
                  <div style={{ fontSize: '12px', color: '#9A9A9A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    <HighlightMatch text={getSnippet(note.content_markdown || '', debouncedQuery)} query={debouncedQuery} />
                  </div>
                </div>
                {activeIndex === idx && <ArrowRight size={16} color="#4D8DFF" style={{ marginLeft: '12px' }} />}
              </div>
            ))
          )}
          {!debouncedQuery && (
            <div style={{ padding: '16px 24px', fontSize: '12px', color: '#555' }}>
              Başlıklarda ve içeriklerde arama yapmak için bir şeyler yazın. Gezinmek için ↑↓ ok tuşlarını kullanın.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
