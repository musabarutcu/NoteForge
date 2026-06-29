import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Zap, FileText, Folder, Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Divider } from '@/components/ui/Card'
import { signIn, signUp, signInWithGoogle } from './authService'

type AuthMode = 'login' | 'register'

export function AuthPage() {
  const navigate   = useNavigate()
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
    <div style={{ minHeight: '100vh', display: 'flex', backgroundColor: '#000000' }}>
      {/* ---- Left Decorative Panel ---- */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 relative overflow-hidden bg-purple-glow-bl">
        {/* Purple glow is applied via CSS class on this div */}

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[8px] bg-[#4D8DFF] flex items-center justify-center">
            <FileText size={16} className="text-white" />
          </div>
          <span className="text-[18px] font-semibold text-white tracking-tight">NoteForge</span>
        </div>

        {/* Tagline */}
        <div className="max-w-sm">
          <h2 className="text-[36px] font-semibold text-white leading-tight mb-4">
            Düşüncelerin için<br />sade bir yer.
          </h2>
          <p className="text-[15px] text-[#9A9A9A] leading-relaxed">
            Tıp öğrencileri, mühendisler ve yazarlar için — AI destekli, reklamsız, ücretsiz.
          </p>
        </div>

        {/* Feature list */}
        <div className="flex flex-col gap-4">
          {[
            { icon: Zap,      label: 'Inline AI tamamlama — aç/kapa toggle ile' },
            { icon: FileText, label: 'PDF işaretleme ve görsel üzerine yazma' },
            { icon: Folder,   label: 'Klasör + etiket hibrit organizasyon' },
            { icon: Download, label: 'PDF, Word, TXT, Markdown export' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[8px] bg-[#111111] border border-[#232323] flex items-center justify-center flex-shrink-0">
                <Icon size={14} className="text-[#4D8DFF]" />
              </div>
              <span className="text-[13px] text-[#9A9A9A]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ---- Right Form Panel ---- */}
      <div className="flex-1 lg:max-w-[500px] flex flex-col items-center justify-center px-5 py-8 sm:px-6 md:px-10 md:py-12">
        {/* Mobile brand */}
        <div className="lg:hidden flex items-center gap-2 mb-8">
          <div className="w-7 h-7 rounded-[8px] bg-[#4D8DFF] flex items-center justify-center">
            <FileText size={14} className="text-white" />
          </div>
          <span className="text-[16px] font-semibold text-white">NoteForge</span>
        </div>

        <div className="w-full max-w-[400px]">
          {/* Heading */}
          <div className="mb-7">
            <h1 className="text-[24px] font-semibold text-white mb-1">
              {mode === 'login' ? 'Tekrar hoş geldin.' : 'Hesabını oluştur.'}
            </h1>
            <p className="text-[14px] text-[#9A9A9A]">
              {mode === 'login' ? 'Notlarına devam et.' : 'Ücretsiz, reklamsız, hep seninle.'}
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
            {/* Google icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Google ile devam et
          </Button>

          <div className="flex items-center gap-3 my-5">
            <Divider className="flex-1" />
            <span className="text-[12px] text-[#555555] whitespace-nowrap">ya da e-posta ile</span>
            <Divider className="flex-1" />
          </div>

          {/* Error / Success banners */}
          {error && (
            <div className="mb-4 px-4 py-3 rounded-[8px] bg-[#EF4444]/10 border border-[#EF4444]/30 text-[13px] text-[#EF4444]">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 px-4 py-3 rounded-[8px] bg-[#22C55E]/10 border border-[#22C55E]/30 text-[13px] text-[#22C55E]">
              {success}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
            {mode === 'register' && (
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

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-widest text-[#9A9A9A]" htmlFor="input-password">
                Şifre
              </label>
              <div className="relative">
                <input
                  id="input-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="En az 6 karakter"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  required
                  className="w-full min-h-10 rounded-[8px] border border-[#232323] bg-[#0D0D0D] py-2 pl-3 pr-11 text-[15px] leading-5 text-white placeholder:text-[#555555] transition-colors focus:outline-none focus:border-[#4D8DFF] focus:ring-1 focus:ring-[#4D8DFF]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#555555] transition-colors hover:bg-[#111111] hover:text-[#9A9A9A]"
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'register' && (
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

            {mode === 'login' && (
              <div className="flex justify-end -mt-1">
                <button
                  type="button"
                  className="rounded-[6px] px-1 py-1 text-[13px] leading-5 text-[#4D8DFF] hover:underline"
                  onClick={() => {/* TODO: forgot password page */}}
                >
                  Parolamı unuttum
                </button>
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full mt-2"
              id={mode === 'login' ? 'btn-login' : 'btn-register'}
            >
              {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </Button>
          </form>

          {/* Switch mode */}
          <p className="mt-5 text-center text-[14px] leading-6 text-[#9A9A9A]">
            {mode === 'login' ? (
              <>Hesabın yok mu?{' '}
                <button onClick={() => switchMode('register')} className="text-[#4D8DFF] hover:underline font-medium">
                  Kayıt ol
                </button>
              </>
            ) : (
              <>Zaten hesabın var mı?{' '}
                <button onClick={() => switchMode('login')} className="text-[#4D8DFF] hover:underline font-medium">
                  Giriş yap
                </button>
              </>
            )}
          </p>

          {/* Reassurance */}
          <p className="mt-4 text-center text-[11px] leading-5 text-[#555555]">
            Ücretsiz, reklamsız, sonsuz.
          </p>
        </div>
      </div>
    </div>
  )
}
