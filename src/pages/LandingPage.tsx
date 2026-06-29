import { useState } from 'react'
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

/* ─── Dot-grid background (inline, for hero-excluded sections) */
const DOT_BG: React.CSSProperties = {
  backgroundImage: `radial-gradient(circle, rgba(77,141,255,0.10) 1px, transparent 1px)`,
  backgroundSize:  '28px 28px',
  backgroundColor: '#000000',
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
          padding:        '0 24px',
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
          <div className="hidden md:flex gap-7 items-center">
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/giris')} id="nav-login" className="hidden sm:inline-flex" style={{ whiteSpace: 'nowrap' }}>
              Giriş Yap
            </Button>
            <Button variant="primary" size="sm" onClick={() => navigate('/giris')} id="nav-register" style={{ whiteSpace: 'nowrap' }}>
              Kayıt Ol
            </Button>
            <button
              className="md:hidden ml-2 p-1 text-[#9A9A9A]"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-black/95 backdrop-blur-md border-b border-[#1A1A1A] p-4 flex flex-col gap-4">
            {NAV_LINKS.map(link => (
              <button
                key={link.id}
                onClick={() => {
                  setMobileMenuOpen(false)
                  scrollTo(link.id)
                }}
                className="text-left text-[16px] text-[#9A9A9A] hover:text-white py-2"
              >
                {link.label}
              </button>
            ))}
            <button 
              onClick={() => navigate('/giris')}
              className="text-left text-[16px] text-[#9A9A9A] hover:text-white py-2 sm:hidden"
            >
              Giriş Yap
            </button>
          </div>
        )}
      </nav>

      {/* Push content below fixed nav */}
      <div style={{ height: '56px' }} />

      {/* ══════════════════════════════════════════════════════
          HERO — video background
          ══════════════════════════════════════════════════════ */}
      <section
        id="hero"
        style={{
          position:        'relative',
          padding:         '80px 24px 96px',
          textAlign:       'center',
          backgroundColor: '#000000',   /* fallback while video loads */
          overflow:        'hidden',
        }}
      >
        {/* Background video */}
        <video
          autoPlay
          muted
          loop
          playsInline
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
        <div style={{ position: 'relative', zIndex: 3, maxWidth: '800px', margin: '0 auto' }}>
          {/* Status badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '6px 14px', borderRadius: '9999px',
            backgroundColor: 'rgba(17,17,17,0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #2A2A2A',
            fontSize: '12px', color: '#9A9A9A', marginBottom: '32px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22C55E', display: 'inline-block' }} />
            Ücretsiz, reklamsız, her zaman
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-[56px] font-bold leading-tight tracking-tight mb-5 text-white">
            Düşüncelerin için<br />
            <span className="text-gradient-blue">sade bir yer.</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-[16px] md:text-[18px] text-[#9A9A9A] max-w-[520px] mx-auto mb-9 leading-relaxed">
            Düşüncelerini düzenlemek isteyen herkes için —
            AI destekli, görsel zengin, kilitlenme yok.
          </p>

          {/* CTA buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-3 w-full max-w-[300px] sm:max-w-none mx-auto">
            <Button variant="primary" size="lg" onClick={() => navigate('/giris')} id="hero-cta-primary" className="gap-2 w-full sm:w-auto">
              Ücretsiz Başla <ArrowRight size={16} />
            </Button>
          </div>

          {/* App mockup */}
          <div style={{
            marginTop:       '56px',
            backgroundColor: '#0D0D0D',
            border:          '1px solid #232323',
            borderRadius:    '16px',
            overflow:        'hidden',
            maxWidth:        '768px',
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
      <div style={{
        ...DOT_BG,
        /* Subtle ambient gradient over the whole non-hero area */
        backgroundImage: `
          radial-gradient(ellipse 60% 30% at 80% 10%, rgba(77,141,255,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 50% 25% at 20% 60%, rgba(124,58,237,0.05) 0%, transparent 60%),
          radial-gradient(circle, rgba(77,141,255,0.10) 1px, transparent 1px)
        `,
        backgroundSize: 'auto, auto, 28px 28px',
      }}>

        {/* ── FEATURES ────────────────────────────────────────── */}
        <section id="ozellikler" style={{ padding: '80px 24px' }}>
          <div style={{ maxWidth: '1024px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
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
          style={{ padding: '80px 24px', borderTop: '1px solid #1A1A1A' }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
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
        <section id="masaustu" style={{ padding: '80px 24px', borderTop: '1px solid #1A1A1A', textAlign: 'center' }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>
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
          style={{ padding: '80px 24px', borderTop: '1px solid #1A1A1A', textAlign: 'center' }}
        >
          <div style={{ maxWidth: '560px', margin: '0 auto' }}>
            <h2 style={{ fontSize: '48px', fontWeight: 700, color: '#ffffff', marginBottom: '16px', letterSpacing: '-0.03em' }}>
              Bugün başla.
            </h2>
            <p style={{ fontSize: '18px', color: '#9A9A9A', marginBottom: '40px' }}>
              Ücretsiz, reklamsız, her zaman.
            </p>
            <Button
              variant="primary"
              size="lg"
              onClick={() => navigate('/giris')}
              id="cta-register-free"
              className="gap-2"
              style={{ fontSize: '16px', padding: '0 32px', height: '48px' }}
            >
              Kayıt Ol — Ücretsiz <ArrowRight size={18} />
            </Button>
            <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '24px' }}>
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

      </div>{/* end non-hero wrapper */}

    </div>
  )
}
