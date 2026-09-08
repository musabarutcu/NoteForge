import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap, FileText, Folder, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { signIn, signUp, signInWithGoogle } from './authService'

type AuthMode = 'login' | 'register'

const HIGHLIGHTS = [
  { icon: Zap,      label: 'Inline AI tamamlama — aç/kapa toggle ile' },
  { icon: FileText, label: 'PDF işaretleme ve görsel üzerine yazma' },
  { icon: Folder,   label: 'Klasör + etiket hibrit organizasyon' },
  { icon: Download, label: 'PDF, Word, TXT, Markdown export' },
]

export function AuthPage() {
  const navigate = useNavigate()
  const [mode, setMode]       = useState<AuthMode>('login')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const isLogin = mode === 'login'

  const switchMode = (next: AuthMode) => {
    setMode(next)
    setError(null)
    setSuccess(null)
    setPassword('')
    setConfirmPassword('')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (mode === 'register') {
      if (!displayName.trim()) { setError('Ad Soyad zorunludur.'); return }
      if (password.length < 6) { setError('Şifre en az 6 karakter olmalı.'); return }
      if (password !== confirmPassword) { setError('Şifreler eşleşmiyor.'); return }
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        navigate('/notlar', { replace: true })
      } else {
        await signUp(email, password, displayName)
        setSuccess('Hesabın oluşturuldu! Onay e-postasını kontrol et, ardından giriş yap.')
        switchMode('login')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setError(null)
    setLoading(true)
    try {
      await signInWithGoogle()
      // Redirect is handled by Supabase OAuth callback
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google ile giriş başarısız.')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', backgroundColor: '#000000' }}>

      {/* ── Sol dekoratif panel (yalnızca geniş ekran) ──────── */}
      <aside className="bg-purple-glow-bl relative hidden flex-1 flex-col justify-between overflow-hidden p-12 lg:flex">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#232323] bg-[#111111]">
            <Zap size={16} color="#4D8DFF" fill="#4D8DFF" />
          </div>
          <span className="text-[18px] font-semibold tracking-tight text-white">NoteForge</span>
        </div>

        {/* Tagline */}
        <div className="max-w-sm">
          <h2 className="mb-4 text-[36px] leading-tight font-semibold text-white">
            Düşüncelerin için<br />sade bir yer.
          </h2>
          <p className="text-[15px] leading-relaxed text-[#9A9A9A]">
            Tıp öğrencileri, mühendisler ve yazarlar için — AI destekli, reklamsız, ücretsiz.
          </p>
        </div>

        {/* Feature list */}
        <ul className="flex flex-col gap-4">
          {HIGHLIGHTS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-[#232323] bg-[#111111]">
                <Icon size={14} className="text-[#4D8DFF]" />
              </span>
              <span className="text-[13px] text-[#9A9A9A]">{label}</span>
            </li>
          ))}
        </ul>
      </aside>

      {/* ── Sağ: form kartı ─────────────────────────────────── */}
      <main className="nf-auth-shell">
        <div className="nf-auth-card">

          {/* Kart başlığı */}
          <div className="nf-auth-head">
            <div className="nf-auth-brand">
              <span className="nf-auth-brand-mark">
                <Zap size={16} color="#4D8DFF" fill="#4D8DFF" />
              </span>
              <span className="text-[17px] font-semibold tracking-tight text-white">NoteForge</span>
            </div>

            <h1 className="nf-auth-title">
              {isLogin ? 'Tekrar hoş geldin' : 'Hesabını oluştur'}
            </h1>
            <p className="nf-auth-subtitle">
              {isLogin ? 'Notlarına kaldığın yerden devam et.' : 'Ücretsiz, reklamsız, hep seninle.'}
            </p>
          </div>

          {/* Google OAuth */}
          <Button
            variant="ghost"
            className="w-full gap-3"
            onClick={handleGoogle}
            disabled={loading}
            id="btn-google-auth"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google ile devam et
          </Button>

          <div className="nf-auth-sep">
            <span>ya da e-posta ile</span>
          </div>

          {/* Hata / başarı bildirimi */}
          {error && (
            <div className="nf-auth-alert nf-auth-alert--error" role="alert">{error}</div>
          )}
          {success && (
            <div className="nf-auth-alert nf-auth-alert--success" role="status">{success}</div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {!isLogin && (
              <Input
                label="Ad Soyad"
                type="text"
                placeholder="Ayşe Yılmaz"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="name"
                required
                id="input-display-name"
              />
            )}

            <Input
              label="E-posta"
              type="email"
              placeholder="ornek@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="email"
              required
              id="input-email"
            />

            {/* Şifre — göster/gizle düğmesi input'un içinde */}
            <div className="flex w-full flex-col gap-1.5">
              <label
                className="text-[11px] font-semibold tracking-widest uppercase text-[#9A9A9A]"
                htmlFor="input-password"
              >
                Şifre
              </label>
              <div className="relative">
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="En az 6 karakter"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={isLogin ? 'current-password' : 'new-password'}
                  required
                  className="min-h-10 w-full rounded-[8px] border border-[#232323] bg-[#0D0D0D] py-2 pr-11 pl-3 text-[15px] leading-5 text-white transition-colors placeholder:text-[#555555] focus:border-[#4D8DFF] focus:ring-1 focus:ring-[#4D8DFF] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#555555] transition-colors hover:bg-[#111111] hover:text-[#9A9A9A]"
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="text-[12px] leading-5 text-[#4D8DFF] hover:underline"
                    onClick={() => {/* TODO: şifre sıfırlama sayfası */}}
                  >
                    Parolamı unuttum
                  </button>
                </div>
              )}
            </div>

            {!isLogin && (
              <Input
                label="Şifre Tekrar"
                type={showPassword ? 'text' : 'password'}
                placeholder="Şifreyi tekrar gir"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                id="input-confirm-password"
              />
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="mt-2 w-full"
              id={isLogin ? 'btn-login' : 'btn-register'}
            >
              {isLogin ? 'Giriş Yap' : 'Kayıt Ol'}
            </Button>
          </form>

          {/* Kart alt bilgisi */}
          <div className="nf-auth-foot">
            <p className="text-[14px] leading-6 text-[#9A9A9A]">
              {isLogin ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
              <button
                type="button"
                onClick={() => switchMode(isLogin ? 'register' : 'login')}
                className="font-medium text-[#4D8DFF] hover:underline"
              >
                {isLogin ? 'Kayıt ol' : 'Giriş yap'}
              </button>
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[#555555]">
              Ücretsiz, reklamsız, sonsuz.
            </p>
          </div>

        </div>
      </main>
    </div>
  )
}
