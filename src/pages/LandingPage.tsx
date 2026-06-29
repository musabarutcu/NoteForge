import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  FileText, Zap, Folder, Download,
  BookOpen, Code2, PenTool, Check, ArrowRight, Menu, X
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

/* ─── Static data ─────────────────────────────────────────── */
const FEATURES = [
  { icon: BookOpen, tag: 'EDİTÖR',        title: 'Görsel Üzerine Yazma',    desc: 'Anatomi diyagramlarına doğrudan metin ve ok işaretleri ekle.' },
  { icon: Zap,      tag: 'AI',            title: 'AI Aç / Kapa',             desc: 'Ghost text tamamlama — kapalıyken sıfır API isteği.' },
  { icon: Download, tag: 'EXPORT',        title: 'Çoklu Format Export',      desc: 'PDF, Word, TXT, Markdown — tek tıkla.' },
  { icon: Folder,   tag: 'ORGANİZASYON', title: 'Klasör + Etiket Sistemi',  desc: 'İç içe klasörler ve çapraz kategorize eden etiketler.' },
  { icon: PenTool,  tag: 'TİPOGRAFİ',    title: 'Tipografi Kontrolü',       desc: 'Font, boyut, satır aralığı — her şey senin elinde.' },
  { icon: FileText, tag: 'PDF',           title: 'PDF İşaretleme',           desc: "PDF'leri içe aktar, üzerlerine not ve highlight ekle." },
] as const

const STEPS = [
  { n: '01', title: 'Kayıt Ol',   desc: 'E-posta veya Google ile saniyeler içinde.' },
  { n: '02', title: 'Not Al',     desc: 'Yaz, görsel ekle, markdown kullan.' },
  { n: '03', title: 'Dışa Aktar', desc: 'İstediğin formatta indir, kilitlenme yok.' },
]

/* ─── Dot-grid background helper ────────────────────────────── */
const getDotSvg = (color1: string, color2: string) => {
  const svg = `
<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28'>
  <defs>
    <linearGradient id='g' x1='0%' y1='0%' x2='100%' y2='100%'>
      <stop offset='0%' stop-color='${color1}' />
      <stop offset='100%' stop-color='${color2}' />
    </linearGradient>
  </defs>
  <circle cx='14' cy='14' r='1.5' fill='url(#g)' />
</svg>
`.trim()
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ─── Section Background Glow Helper ──────────────────────── */
const SECTION_BG_GLOW: React.CSSProperties = {
  position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
  width: '100vw', height: '150%',
  background: 'radial-gradient(ellipse at center, #000000 0%, rgba(0,0,0,0.95) 30%, rgba(0,0,0,0) 70%)',
  pointerEvents: 'none', zIndex: -1
}

/* ─── Smooth scroll helper ────────────────────────────────── */
function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
}

/* ─── Nav links ───────────────────────────────────────────── */
const NAV_LINKS = [
  { label: 'Özellikler',     id: 'ozellikler'  },
  { label: 'Nasıl Çalışır',  id: 'nasil-calisir' },
  { label: 'Masaüstü',       id: 'masaustu'    },
]

/* ─── Component ───────────────────────────────────────────── */
export function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const heroVideoRef = useRef<HTMLVideoElement>(null)

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), [])

  // Body scroll lock for mobile menu
  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [mobileMenuOpen])

  // Close mobile menu when viewport crosses desktop breakpoint
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileMenuOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Mobile hero video: iOS/Safari often ignores autoplay unless play() is retried
  useEffect(() => {
    const video = heroVideoRef.current
    if (!video) return

    const isMobile = window.matchMedia('(max-width: 767px)').matches
    if (!isMobile) return

    video.muted = true
    video.defaultMuted = true
    video.setAttribute('playsinline', '')
    video.setAttribute('webkit-playsinline', '')

    const tryPlay = () => {
      video.play().catch(() => {
        // Autoplay blocked until first user interaction on some mobile browsers.
      })
    }

    tryPlay()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') tryPlay()
    }

    const unlockOnTouch = () => {
      tryPlay()
      document.removeEventListener('touchstart', unlockOnTouch, true)
    }

    video.addEventListener('loadeddata', tryPlay)
    document.addEventListener('visibilitychange', onVisibilityChange)
    video.play().catch(() => {
      document.addEventListener('touchstart', unlockOnTouch, { capture: true, passive: true })
    })

    return () => {
      video.removeEventListener('loadeddata', tryPlay)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      document.removeEventListener('touchstart', unlockOnTouch, true)
    }
  }, [])

  return (
    <div style={{ backgroundColor: '#000000', color: '#ffffff', minHeight: '100vh' }}>

      {/* ── FIXED NAVBAR ────────────────────────────────────── */}
      <nav
        style={{
          position:        'fixed',
          top:             0,
          left:            0,
          right:           0,
          zIndex:          50,
          backgroundColor: 'rgba(0,0,0,0.92)',
          backdropFilter:  'blur(8px)',
          borderBottom:    '1px solid #1A1A1A',
          height:          '56px',
        }}
      >
        <div style={{
          maxWidth:       '1152px',
          margin:         '0 auto',
          padding:        '0 clamp(16px, 4vw, 24px)',
          height:         '100%',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              backgroundColor: '#111111', border: '1px solid #232323', display: 'flex',
              alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Zap size={14} color="#4D8DFF" fill="#4D8DFF" />
            </div>
            <span style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '-0.02em' }}>NoteForge</span>
            <span style={{
              fontSize: '10px', fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', padding: '2px 6px',
              borderRadius: '4px', backgroundColor: '#111111',
              border: '1px solid #232323', color: '#555555',
            }}>BETA</span>
          </div>

          {/* Center nav links */}
          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            {NAV_LINKS.map(link => (
              <button
                key={link.id}
                onClick={() => scrollTo(link.id)}
                style={{
                  fontSize: '14px', color: '#9A9A9A',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '0', transition: 'color 150ms',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#9A9A9A')}
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* CTA buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <Button variant="ghost" size="sm" onClick={() => navigate('/giris')} id="nav-login" className="hidden sm:inline-flex" style={{ padding: '8px 20px', fontSize: '13px', whiteSpace: 'nowrap', height: '36px' }}>
              Giriş Yap
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/giris')} id="nav-register" style={{ padding: '8px 24px', fontSize: '13px', whiteSpace: 'nowrap', height: '36px' }}>
              Kayıt Ol
            </Button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? 'Menüyü kapat' : 'Menüyü aç'}
              aria-expanded={mobileMenuOpen}
              className="md:hidden ml-1 flex h-9 w-9 items-center justify-center rounded-[8px] text-[#9A9A9A] hover:bg-[#111111] hover:text-white touch-manipulation"
              onClick={() => setMobileMenuOpen(open => !open)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu — portaled outside nav so backdrop-filter doesn't trap fixed positioning */}
      {mobileMenuOpen && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[200] flex flex-col overflow-y-auto animate-in fade-in duration-300"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Mobil menü"
        >
          <div className="flex items-center justify-between px-6 border-b border-[#1A1A1A]/50" style={{ height: '72px', minHeight: '72px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '8px',
                backgroundColor: '#111111', border: '1px solid #232323', display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <Zap size={16} color="#4D8DFF" fill="#4D8DFF" />
              </div>
              <span style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.02em' }}>NoteForge</span>
            </div>
            <button
              type="button"
              aria-label="Menüyü kapat"
              onClick={closeMobileMenu}
              className="p-2 -mr-2 rounded-[8px] text-[#9A9A9A] hover:bg-[#111111] hover:text-white touch-manipulation transition-colors"
            >
              <X size={28} />
            </button>
          </div>

          <div className="flex flex-col px-4 pt-6 pb-12 gap-2">
            {NAV_LINKS.map(link => (
              <button
                key={link.id}
                type="button"
                onClick={() => {
                  closeMobileMenu()
                  scrollTo(link.id)
                }}
                className="text-left text-[22px] text-[#ffffff] font-semibold py-4 px-4 rounded-[12px] hover:bg-[#111111] transition-colors"
              >
                {link.label}
              </button>
            ))}
            <div className="h-[1px] bg-[#1A1A1A] my-4 mx-4" />
            <button
              type="button"
              onClick={() => {
                closeMobileMenu()
                navigate('/giris')
              }}
              className="text-left text-[22px] text-[#4D8DFF] font-semibold py-4 px-4 rounded-[12px] hover:bg-[#111111]/80 transition-colors"
            >
              Giriş Yap
            </button>
          </div>
        </div>,
        document.body
      )}

      {/* Push content below fixed nav */}
      <div style={{ height: '56px' }} />

      {/* ══════════════════════════════════════════════════════
          HERO — video background
          ══════════════════════════════════════════════════════ */}
      <section
        id="hero"
        className="nf-hero relative overflow-hidden bg-[#000000] text-center"
      >
        {/* Background video */}
        <video
          ref={heroVideoRef}
          className="nf-hero-video"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          style={{
            position:   'absolute',
            inset:      0,
            width:      '100%',
            height:     '100%',
            objectFit:  'cover',
            zIndex:     0,
          }}
        >
          <source src="/hero_background.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay for readability — radial, darker in center */}
        <div style={{
          position:      'absolute',
          inset:         0,
          background:    'radial-gradient(ellipse 80% 70% at 50% 50%, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.15) 100%)',
          pointerEvents: 'none',
          zIndex:        1,
        }} />

        {/* Bottom edge smoothing gradient to blend with next section */}
        <div style={{
          position:      'absolute',
          bottom:        0,
          left:          0,
          right:         0,
          height:        '120px',
          background:    'linear-gradient(to bottom, transparent, #000000)',
          pointerEvents: 'none',
          zIndex:        2,
        }} />

        {/* Hero content */}
        <div className="nf-hero-content" style={{ position: 'relative', zIndex: 3 }}>
          {/* Status badge */}
          <div className="nf-hero-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', borderRadius: '9999px',
            backgroundColor: 'rgba(17,17,17,0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #2A2A2A',
            fontSize: '12px', lineHeight: 1.4, color: '#9A9A9A', maxWidth: '100%',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
            Ücretsiz, reklamsız, her zaman
          </div>

          {/* Headline */}
          <h1 className="nf-hero-title font-bold tracking-tight text-white text-center">
            Düşüncelerin için<br />
            <span className="text-gradient-blue">sade bir yer.</span>
          </h1>

          {/* Sub-headline */}
          <p className="nf-hero-copy mx-auto text-center text-[#9A9A9A]">
            Düşüncelerini düzenlemek isteyen herkes için —
            AI destekli, görsel zengin, kilitlenme yok.
          </p>

          {/* CTA buttons */}
          <div className="nf-hero-actions mx-auto flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="primary" size="lg" onClick={() => navigate('/giris')} id="hero-cta-primary" className="w-full gap-2 sm:w-auto" style={{ padding: '14px 32px' }}>
              Ücretsiz Başla <ArrowRight size={16} />
            </Button>
          </div>

          {/* App mockup */}
          <div className="nf-hero-mockup" style={{
            backgroundColor: '#0D0D0D',
            border:          '1px solid #232323',
            borderRadius:    '14px',
            overflow:        'hidden',
            marginLeft:      'auto',
            marginRight:     'auto',
          }}>
            {/* Mock browser bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', borderBottom: '1px solid #232323' }}>
              {['#3A3A3A', '#3A3A3A', '#3A3A3A'].map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: c }} />
              ))}
              <span style={{ margin: '0 auto', fontSize: '11px', color: '#555555' }}>
                Proje Fikirleri — NoteForge
              </span>
            </div>
            {/* Mock editor */}
            <div style={{ display: 'flex' }}>
              <div style={{ width: '140px', borderRight: '1px solid #232323', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[80, 60, 75, 50].map((w, i) => (
                  <div key={i} style={{ height: '12px', width: `${w}%`, backgroundColor: '#111111', borderRadius: '4px' }} />
                ))}
              </div>
              <div style={{ flex: 1, padding: '20px' }}>
                <div style={{ height: '20px', width: '60%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '16px' }} />
                {[100, 85, 70].map((w, i) => (
                  <div key={i} style={{ height: '10px', width: `${w}%`, backgroundColor: '#111111', borderRadius: '4px', marginBottom: '8px' }} />
                ))}
                <div style={{
                  marginTop: '16px', height: '72px', width: '180px',
                  backgroundColor: '#111111', border: '1px solid #232323',
                  borderRadius: '8px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: '16px',
                }}>
                  <span style={{ fontSize: '10px', color: '#555555' }}>[ Görsel ]</span>
                </div>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  <div style={{ height: '10px', width: '55%', backgroundColor: '#111111', borderRadius: '4px' }} />
                  <div style={{ height: '10px', width: '30%', backgroundColor: '#555555', borderRadius: '4px', opacity: 0.4 }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════
          NON-HERO SECTIONS — single wrapper with continuous dot grid
          ══════════════════════════════════════════════════════ */}
      <div style={{ position: 'relative', backgroundColor: '#000000' }}>
        
        {/* Top Fade Transition (Hero to Features) */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '250px',
          background: 'linear-gradient(to bottom, #000000 0%, rgba(0,0,0,0) 100%)',
          pointerEvents: 'none', zIndex: 1
        }} />

        {/* Ambient glow over the whole non-hero area */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            radial-gradient(ellipse 60% 30% at 80% 10%, rgba(77,141,255,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 50% 25% at 20% 60%, rgba(124,58,237,0.05) 0%, transparent 60%)
          `,
          pointerEvents: 'none', zIndex: 0
        }} />

        {/* Layer 1: Top (Blue dominant) */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${getDotSvg('#3B82F6', '#6366F1')}")`,
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 40%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 20%, transparent 40%)',
          opacity: 0.30, zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Layer 2: Middle (Balanced) */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${getDotSvg('#4D8DFF', '#8B5CF6')}")`,
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, transparent 20%, black 40%, black 60%, transparent 80%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 20%, black 40%, black 60%, transparent 80%)',
          opacity: 0.30, zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Layer 3: Bottom (Purple dominant) */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("${getDotSvg('#6366F1', '#A855F7')}")`,
          backgroundSize: '28px 28px',
          maskImage: 'linear-gradient(to bottom, transparent 60%, black 80%, black 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 60%, black 80%, black 100%)',
          opacity: 0.30, zIndex: 0, pointerEvents: 'none'
        }} />

        {/* Real content wrapper */}
        <div className="relative z-10">

        {/* ── FEATURES ────────────────────────────────────────── */}
        <section id="ozellikler" style={{ padding: '80px 24px', position: 'relative' }}>
          <div style={SECTION_BG_GLOW} />
          <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px', position: 'relative' }}>
              <p className="label-caps" style={{ marginBottom: '12px' }}>ÖZELLİKLER</p>
              <h2 style={{ fontSize: '34px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Sadece ihtiyacın olan her şey.
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map(f => (
                <Card key={f.title} style={{ padding: '24px', display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    backgroundColor: '#111111', border: '1px solid #232323',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    marginBottom: '12px'
                  }}>
                    <f.icon size={18} color="#4D8DFF" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <p className="label-caps" style={{ marginBottom: '8px', color: '#555555' }}>{f.tag}</p>
                    <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>{f.title}</h3>
                    <p style={{ fontSize: '13px', color: '#9A9A9A', lineHeight: 1.6 }}>{f.desc}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* ── HOW IT WORKS ────────────────────────────────────── */}
        <section
          id="nasil-calisir"
          style={{ padding: '80px 24px', borderTop: '1px solid #1A1A1A', position: 'relative' }}
        >
          <div style={SECTION_BG_GLOW} />
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px', position: 'relative' }}>
              <p className="label-caps" style={{ marginBottom: '12px' }}>NASIL ÇALIŞIR</p>
              <h2 style={{ fontSize: '34px', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                Üç adım, hepsi bu.
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {STEPS.map(step => (
                <div key={step.n}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%',
                    border: '1px solid rgba(77,141,255,0.4)',
                    backgroundColor: 'rgba(77,141,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700, color: '#4D8DFF',
                    marginBottom: '16px',
                  }}>
                    {step.n}
                  </div>
                  <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', marginBottom: '8px' }}>{step.title}</h3>
                  <p style={{ fontSize: '14px', color: '#9A9A9A', lineHeight: 1.6 }}>{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── DESKTOP (COMING SOON) ───────────────────────────── */}
        <section id="masaustu" style={{ padding: '80px 24px', borderTop: '1px solid #1A1A1A', textAlign: 'center', position: 'relative' }}>
          <div style={SECTION_BG_GLOW} />
          <div style={{ maxWidth: '480px', margin: '0 auto', position: 'relative' }}>
            <span style={{
              display: 'inline-flex', padding: '4px 12px', borderRadius: '9999px',
              backgroundColor: '#111111', border: '1px solid #232323',
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em',
              textTransform: 'uppercase', color: '#555555', marginBottom: '24px',
            }}>YAKINDA</span>
            <div style={{
              width: '64px', height: '64px', borderRadius: '20px',
              backgroundColor: '#0D0D0D', border: '1px solid #232323',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', opacity: 0.4,
            }}>
              <Code2 size={28} color="#9A9A9A" />
            </div>
            <h2 style={{ fontSize: '28px', fontWeight: 600, color: '#ffffff', marginBottom: '12px' }}>
              Masaüstü Uygulaması
            </h2>
            <p style={{ fontSize: '15px', color: '#9A9A9A', marginBottom: '24px' }}>
              Offline çalışma ve yerel depolama — geliyor.
            </p>
            <Button variant="ghost" disabled className="opacity-40 cursor-not-allowed" id="btn-desktop-coming-soon">
              İndir — Yakında
            </Button>
          </div>
        </section>

        {/* ── CLOSING CTA ─────────────────────────────────────── */}
        <section
          id="basla"
          style={{ padding: '80px 24px', borderTop: '1px solid #1A1A1A', textAlign: 'center', position: 'relative' }}
        >
          <div style={SECTION_BG_GLOW} />
          <div style={{ maxWidth: '560px', margin: '0 auto', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h2 className="text-[34px] sm:text-[42px] md:text-[48px]" style={{ fontWeight: 700, color: '#ffffff', marginBottom: '16px', letterSpacing: 0, lineHeight: 1.1, textAlign: 'center' }}>
              Bugün başla.
            </h2>
            <p style={{ fontSize: '18px', color: '#9A9A9A', marginBottom: '40px', textAlign: 'center' }}>
              Ücretsiz, reklamsız, her zaman.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/giris')}
              id="cta-register-free"
              className="gap-2 whitespace-nowrap"
              style={{ fontSize: '16px', paddingLeft: 32, paddingRight: 32 }}
            >
              Kayıt Ol — Ücretsiz <ArrowRight size={18} />
            </Button>
            <div style={{ marginTop: '32px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '24px' }}>
              {['Kredi kartı yok', 'Reklam yok', 'Sınırsız not'].map(item => (
                <div key={item} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#555555' }}>
                  <Check size={12} color="#22C55E" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FOOTER ──────────────────────────────────────────── */}
        <footer style={{ borderTop: '1px solid #1A1A1A', padding: '32px 24px' }}>
          <div className="max-w-[1152px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '6px',
                backgroundColor: '#111111', border: '1px solid #232323', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Zap size={12} color="#4D8DFF" fill="#4D8DFF" />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600 }}>NoteForge</span>
            </div>
            <p style={{ fontSize: '12px', color: '#555555' }}>© 2026 NoteForge. Tüm hakları saklıdır.</p>
            <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
              {['Gizlilik', 'Kullanım Koşulları'].map(l => (
                <a key={l} href="#" style={{ fontSize: '12px', color: '#555555', textDecoration: 'none' }}>{l}</a>
              ))}
            </div>
          </div>
        </footer>

        </div>{/* end of content wrapper */}
      </div>{/* end non-hero wrapper */}

    </div>
  )
}
