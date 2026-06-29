import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Card, Divider } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { useAuthStore } from '@/store/authStore'
import { useT } from '@/lib/i18n'
import {
  upsertPreferences,
  updateProfile,
  changePassword,
  deleteAccount,
  DEFAULT_PREFERENCES,
} from '@/features/settings/preferencesService'
import type { UserPreferencesUpdate } from '@/types/database'

type Tab = 'account' | 'typography' | 'language' | 'notifications' | 'shortcuts'

export function SettingsPage() {
  const t = useT()
  const navigate = useNavigate()
  const { user, profile, preferences, setProfile, setPreferences } = useAuthStore()
  
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const [loading, setLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Local state for forms
  const [displayName, setDisplayName] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  
  // Preferences local state for Typography/Language/Notifications
  const [localPrefs, setLocalPrefs] = useState<UserPreferencesUpdate>({})

  // Initialize state when data loads
  useEffect(() => {
    if (profile?.display_name) {
      setDisplayName(profile.display_name)
    }
    if (preferences) {
      setLocalPrefs(preferences)
    } else {
      setLocalPrefs(DEFAULT_PREFERENCES)
    }
  }, [profile, preferences])

  const handleMessage = (msg: string, isError = false) => {
    if (isError) {
      setErrorMsg(msg)
      setSuccessMsg('')
    } else {
      setSuccessMsg(msg)
      setErrorMsg('')
    }
    setTimeout(() => {
      setSuccessMsg('')
      setErrorMsg('')
    }, 3000)
  }

  const handleSaveProfile = async () => {
    if (!user) return
    setLoading(true)
    try {
      await updateProfile(user.id, { display_name: displayName })
      setProfile({ ...profile!, display_name: displayName })
      handleMessage(t('action.saved'))
    } catch (e: any) {
      handleMessage(e.message || t('action.error'), true)
    } finally {
      setLoading(false)
    }
  }

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      handleMessage(t('settings.account.passwordMismatch'), true)
      return
    }
    if (newPassword.length < 6) {
      handleMessage(t('settings.account.passwordShort'), true)
      return
    }
    setLoading(true)
    try {
      // In a real app, verifying current password before change requires specific flow.
      // Here we just call updateUser which requires a logged in session.
      await changePassword(newPassword)
      handleMessage(t('action.saved'))
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (e: any) {
      handleMessage(e.message || t('action.error'), true)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!user) return
    setLoading(true)
    try {
      await deleteAccount(user.id)
      setDeleteModalOpen(false)
      navigate('/')
    } catch (e: any) {
      handleMessage(e.message || t('action.error'), true)
      setLoading(false)
    }
  }

  const updatePreference = async (key: keyof UserPreferencesUpdate, value: any) => {
    if (!user) return
    const newPrefs = { ...localPrefs, [key]: value }
    setLocalPrefs(newPrefs)
    
    try {
      const saved = await upsertPreferences(user.id, newPrefs)
      setPreferences(saved)
    } catch (e: any) {
      handleMessage(e.message || t('action.error'), true)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: '840px', margin: '0 auto', padding: '24px clamp(16px, 4vw, 40px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => navigate('/notlar')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '8px',
            backgroundColor: '#111111', border: '1px solid #232323',
            color: '#9A9A9A', cursor: 'pointer', transition: 'all 150ms'
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = '#4D8DFF' }}
          onMouseLeave={e => { e.currentTarget.style.color = '#9A9A9A'; e.currentTarget.style.borderColor = '#232323' }}
        >
          <ArrowLeft size={16} />
        </button>
        <h1 style={{ fontSize: '24px', fontWeight: 600, margin: 0 }}>
          {t('settings.title')}
        </h1>
      </div>

      {/* Tabs */}
      <div 
        style={{ display: 'flex', gap: '8px', marginBottom: '32px', borderBottom: '1px solid var(--color-border)', paddingBottom: '12px', overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
        className="[&::-webkit-scrollbar]:hidden"
      >
        <TabButton active={activeTab === 'account'} onClick={() => setActiveTab('account')}>
          {t('settings.tab.account')}
        </TabButton>
        <TabButton active={activeTab === 'typography'} onClick={() => setActiveTab('typography')}>
          {t('settings.tab.typography')}
        </TabButton>
        <TabButton active={activeTab === 'language'} onClick={() => setActiveTab('language')}>
          {t('settings.tab.language')}
        </TabButton>
        <TabButton active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')}>
          {t('settings.tab.notifications')}
        </TabButton>
        <TabButton active={activeTab === 'shortcuts'} onClick={() => setActiveTab('shortcuts')}>
          {t('settings.tab.shortcuts')}
        </TabButton>
      </div>

      {/* Messages */}
      {successMsg && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(34,197,94,0.1)', color: 'var(--color-success)', borderRadius: '8px', marginBottom: '24px' }}>
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ padding: '12px', backgroundColor: 'rgba(239,68,68,0.1)', color: 'var(--color-danger)', borderRadius: '8px', marginBottom: '24px' }}>
          {errorMsg}
        </div>
      )}

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        
        {/* ACCOUNT TAB */}
        {activeTab === 'account' && (
          <>
            <Card style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>Profil</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', maxWidth: '440px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '8px' }}>
                    {t('settings.account.email')}
                  </label>
                  <Input value={user?.email || ''} readOnly disabled />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '8px' }}>
                    {t('settings.account.displayName')}
                  </label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} />
                </div>
                <Button variant="primary" onClick={handleSaveProfile} loading={loading} style={{ width: '100%', maxWidth: '260px' }}>
                  {t('settings.account.saveProfile')}
                </Button>
              </div>
            </Card>

            <Card style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>{t('settings.account.changePassword')}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', width: '100%', maxWidth: '440px' }}>
                <Input type="password" placeholder={t('settings.account.newPassword')} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <Input type="password" placeholder={t('settings.account.confirmPassword')} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
                <Button variant="primary" onClick={handleChangePassword} loading={loading} style={{ width: '100%', maxWidth: '260px' }}>
                  {t('settings.account.updatePassword')}
                </Button>
              </div>
            </Card>

            <Card style={{ padding: '24px', borderColor: 'rgba(239,68,68,0.2)' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--color-danger)', marginBottom: '8px' }}>
                {t('settings.account.deleteAccount')}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--color-text-2)', marginBottom: '16px' }}>
                Hesabınızı sildiğinizde tüm notlarınız, klasörleriniz ve tercihleriniz kalıcı olarak silinir.
              </p>
              <Button variant="danger" onClick={() => setDeleteModalOpen(true)} style={{ width: '100%', maxWidth: '160px' }}>
                {t('settings.account.deleteAccount')}
              </Button>
            </Card>
          </>
        )}

        {/* TYPOGRAPHY TAB */}
        {activeTab === 'typography' && (
          <>
            <Card style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>{t('settings.tab.typography')}</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                {/* Font */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '8px' }}>
                    {t('settings.typo.font')}
                  </label>
                  <select 
                    value={localPrefs.font_family || 'Inter'} 
                    onChange={e => updatePreference('font_family', e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-surface-mid)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)' }}
                  >
                    <option value="Inter">Inter (Sans)</option>
                    <option value="Merriweather">Merriweather (Serif)</option>
                    <option value="JetBrains Mono">JetBrains Mono (Mono)</option>
                    <option value="Georgia">Georgia (Serif)</option>
                  </select>
                </div>
                
                {/* Size */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '8px' }}>
                    {t('settings.typo.fontSize')} ({localPrefs.font_size || 16}px)
                  </label>
                  <input 
                    type="range" min="14" max="24" step="1" 
                    value={localPrefs.font_size || 16}
                    onChange={e => updatePreference('font_size', parseInt(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Line Height */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '8px' }}>
                    {t('settings.typo.lineHeight')}
                  </label>
                  <select 
                    value={localPrefs.line_height || 1.6} 
                    onChange={e => updatePreference('line_height', parseFloat(e.target.value))}
                    style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-surface-mid)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)' }}
                  >
                    <option value={1.4}>1.4 (Sıkı)</option>
                    <option value={1.6}>1.6 (Normal)</option>
                    <option value={1.8}>1.8 (Geniş)</option>
                    <option value={2.0}>2.0 (Çok Geniş)</option>
                  </select>
                </div>

                {/* Page Width */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--color-text-2)', marginBottom: '8px' }}>
                    {t('settings.typo.pageWidth')}
                  </label>
                  <select 
                    value={localPrefs.page_width || 'medium'} 
                    onChange={e => updatePreference('page_width', e.target.value)}
                    style={{ width: '100%', padding: '8px', backgroundColor: 'var(--color-surface-mid)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text)' }}
                  >
                    <option value="narrow">{t('settings.typo.narrow')}</option>
                    <option value="medium">{t('settings.typo.medium')}</option>
                    <option value="full">{t('settings.typo.full')}</option>
                  </select>
                </div>
              </div>

              <Divider />

              <h3 style={{ fontSize: '16px', fontWeight: 500, margin: '24px 0 16px' }}>{t('settings.typo.theme')}</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <ThemeButton active={localPrefs.theme === 'dark'} onClick={() => updatePreference('theme', 'dark')} bg="#0D0D0D" text="#E8E8E8" label={t('settings.typo.dark')} />
                <ThemeButton active={localPrefs.theme === 'light'} onClick={() => updatePreference('theme', 'light')} bg="#FAFAFA" text="#111111" label={t('settings.typo.light')} />
                <ThemeButton active={localPrefs.theme === 'sepia'} onClick={() => updatePreference('theme', 'sepia')} bg="#F8F3E8" text="#3D2B1F" label={t('settings.typo.sepia')} />
              </div>

              <Divider style={{ margin: '32px 0' }} />

              <h3 style={{ fontSize: '14px', color: 'var(--color-text-2)', marginBottom: '16px' }}>{t('settings.typo.preview')}</h3>
              <div className="editor-surface" style={{ padding: '24px', borderRadius: '8px', border: '1px solid var(--editor-border)' }}>
                <div className="tiptap">
                  <h1>Not Başlığı Örneği</h1>
                  <p>{t('settings.typo.previewText')}</p>
                </div>
              </div>
            </Card>
          </>
        )}

        {/* LANGUAGE TAB */}
        {activeTab === 'language' && (
          <Card style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '16px' }}>{t('settings.lang.title')}</h2>
            <p style={{ fontSize: '14px', color: 'var(--color-text-2)', marginBottom: '24px' }}>
              {t('settings.lang.note')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
              <Button 
                variant={localPrefs.language === 'tr' ? 'primary' : 'ghost'} 
                onClick={() => { updatePreference('language', 'tr'); setTimeout(() => window.location.reload(), 300) }}
              >
                Türkçe
              </Button>
              <Button 
                variant={localPrefs.language === 'en' ? 'primary' : 'ghost'} 
                onClick={() => { updatePreference('language', 'en'); setTimeout(() => window.location.reload(), 300) }}
              >
                English
              </Button>
            </div>
          </Card>
        )}

        {/* NOTIFICATIONS TAB */}
        {activeTab === 'notifications' && (
          <Card style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>{t('settings.tab.notifications')}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={localPrefs.notifications_email ?? true}
                  onChange={e => updatePreference('notifications_email', e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px' }}>{t('settings.notif.email')}</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                <input 
                  type="checkbox" 
                  checked={localPrefs.notifications_weekly ?? false}
                  onChange={e => updatePreference('notifications_weekly', e.target.checked)}
                  style={{ width: '18px', height: '18px' }}
                />
                <span style={{ fontSize: '14px' }}>{t('settings.notif.weekly')}</span>
              </label>
            </div>
          </Card>
        )}

        {/* SHORTCUTS TAB */}
        {activeTab === 'shortcuts' && (
          <Card style={{ padding: '24px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 500, marginBottom: '24px' }}>{t('settings.shortcuts.title')}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <ShortcutRow keys={['Ctrl/Cmd', 'K']} desc={t('settings.shortcuts.search')} />
              <ShortcutRow keys={['Ctrl/Cmd', 'B']} desc={t('settings.shortcuts.bold')} />
              <ShortcutRow keys={['Ctrl/Cmd', 'I']} desc={t('settings.shortcuts.italic')} />
              <ShortcutRow keys={['Esc']} desc={t('settings.shortcuts.escape')} />
            </div>
          </Card>
        )}

      </div>

      <Modal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title={t('settings.account.deleteAccount')}>
        <p style={{ marginBottom: '24px', fontSize: '14px', lineHeight: 1.6 }}>
          {t('settings.account.deleteWarning')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '12px' }}>
          <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={loading}>
            {t('action.cancel')}
          </Button>
          <Button variant="danger" onClick={handleDeleteAccount} loading={loading}>
            {t('action.confirm')}
          </Button>
        </div>
      </Modal>

    </div>
  )
}

function TabButton({ children, active, onClick }: { children: React.ReactNode, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 16px',
        fontSize: '14px',
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--color-text)' : 'var(--color-text-2)',
        backgroundColor: active ? 'var(--color-surface-mid)' : 'transparent',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 150ms',
        whiteSpace: 'nowrap'
      }}
    >
      {children}
    </button>
  )
}

function ThemeButton({ active, onClick, bg, text, label }: { active: boolean, onClick: () => void, bg: string, text: string, label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <div style={{
        width: '64px',
        height: '48px',
        backgroundColor: bg,
        color: text,
        borderRadius: '8px',
        border: `2px solid ${active ? 'var(--color-blue)' : 'var(--color-border)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '18px',
        fontWeight: 'bold',
        fontFamily: 'serif'
      }}>
        Aa
      </div>
      <span style={{ fontSize: '12px', color: active ? 'var(--color-text)' : 'var(--color-text-2)' }}>{label}</span>
    </button>
  )
}

function ShortcutRow({ keys, desc }: { keys: string[], desc: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', paddingBottom: '12px', borderBottom: '1px solid var(--color-border-subtle)' }}>
      <span style={{ fontSize: '14px', color: 'var(--color-text-2)' }}>{desc}</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
        {keys.map(k => (
          <kbd key={k} style={{
            padding: '4px 8px',
            backgroundColor: 'var(--color-surface-mid)',
            border: '1px solid var(--color-border)',
            borderRadius: '4px',
            fontSize: '12px',
            color: 'var(--color-text)',
            fontFamily: 'var(--font-mono)'
          }}>
            {k}
          </kbd>
        ))}
      </div>
    </div>
  )
}
