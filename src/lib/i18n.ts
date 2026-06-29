// ============================================================
// NoteForge — Lightweight i18n
// Covers: nav, sidebar, settings page, core action buttons
// Full translation of editor content is NOT in scope here.
// ============================================================

export type Language = 'tr' | 'en'

const translations = {
  tr: {
    // Navigation / sidebar
    'nav.allNotes':       'Tüm Notlar',
    'nav.newNote':        'Yeni Not',
    'nav.settings':       'Ayarlar',
    'nav.folders':        'Klasörler',
    'nav.tags':           'Etiketler',
    'nav.signOut':        'Çıkış Yap',
    'nav.search':         'Ara…',

    // Common actions
    'action.save':        'Kaydet',
    'action.cancel':      'İptal',
    'action.delete':      'Sil',
    'action.confirm':     'Onayla',
    'action.saving':      'Kaydediliyor…',
    'action.saved':       'Kaydedildi',
    'action.error':       'Bir hata oluştu',

    // Settings page
    'settings.title':             'Ayarlar',
    'settings.tab.account':       'Hesap',
    'settings.tab.typography':    'Tipografi',
    'settings.tab.language':      'Dil',
    'settings.tab.notifications': 'Bildirimler',
    'settings.tab.shortcuts':     'Klavye Kısayolları',

    // Account tab
    'settings.account.displayName':       'Ad Soyad',
    'settings.account.email':             'E-posta',
    'settings.account.saveProfile':       'Profili Kaydet',
    'settings.account.changePassword':    'Şifre Değiştir',
    'settings.account.currentPassword':   'Mevcut Şifre',
    'settings.account.newPassword':       'Yeni Şifre',
    'settings.account.confirmPassword':   'Şifreyi Onayla',
    'settings.account.updatePassword':    'Şifreyi Güncelle',
    'settings.account.deleteAccount':     'Hesabı Sil',
    'settings.account.deleteWarning':     'Bu işlem geri alınamaz. Tüm notların, klasörlerin ve verilerinin kalıcı olarak silineceğini onaylıyorum.',
    'settings.account.passwordMismatch':  'Şifreler eşleşmiyor.',
    'settings.account.passwordShort':     'Şifre en az 6 karakter olmalı.',

    // Typography tab
    'settings.typo.font':        'Font Ailesi',
    'settings.typo.fontSize':    'Yazı Boyutu',
    'settings.typo.lineHeight':  'Satır Aralığı',
    'settings.typo.pageWidth':   'Sayfa Genişliği',
    'settings.typo.narrow':      'Dar',
    'settings.typo.medium':      'Orta',
    'settings.typo.full':        'Tam Genişlik',
    'settings.typo.theme':       'Editör Teması',
    'settings.typo.dark':        'Koyu',
    'settings.typo.light':       'Açık',
    'settings.typo.sepia':       'Sepia',
    'settings.typo.preview':     'Önizleme',
    'settings.typo.previewText': 'Hızlı kahverengi tilki tembel köpeğin üzerinden atladı.',

    // Language tab
    'settings.lang.title':       'Arayüz Dili',
    'settings.lang.note':        'Şu anda Türkçe ve İngilizce desteklenmektedir. Notlarınızın içeriği etkilenmez.',

    // Notifications tab
    'settings.notif.email':      'Önemli güncellemeler için e-posta al',
    'settings.notif.weekly':     'Haftalık özet e-postası',

    // Shortcuts tab
    'settings.shortcuts.title':  'Klavye Kısayolları',
    'settings.shortcuts.search': 'Hızlı Arama',
    'settings.shortcuts.bold':   'Kalın Metin',
    'settings.shortcuts.italic': 'İtalik Metin',
    'settings.shortcuts.escape': 'Açık Modalı Kapat',
    'settings.shortcuts.save':   'Notu Kaydet',
    'settings.shortcuts.newNote':'Yeni Not Oluştur',
  },

  en: {
    // Navigation / sidebar
    'nav.allNotes':       'All Notes',
    'nav.newNote':        'New Note',
    'nav.settings':       'Settings',
    'nav.folders':        'Folders',
    'nav.tags':           'Tags',
    'nav.signOut':        'Sign Out',
    'nav.search':         'Search…',

    // Common actions
    'action.save':        'Save',
    'action.cancel':      'Cancel',
    'action.delete':      'Delete',
    'action.confirm':     'Confirm',
    'action.saving':      'Saving…',
    'action.saved':       'Saved',
    'action.error':       'An error occurred',

    // Settings page
    'settings.title':             'Settings',
    'settings.tab.account':       'Account',
    'settings.tab.typography':    'Typography',
    'settings.tab.language':      'Language',
    'settings.tab.notifications': 'Notifications',
    'settings.tab.shortcuts':     'Keyboard Shortcuts',

    // Account tab
    'settings.account.displayName':       'Full Name',
    'settings.account.email':             'Email',
    'settings.account.saveProfile':       'Save Profile',
    'settings.account.changePassword':    'Change Password',
    'settings.account.currentPassword':   'Current Password',
    'settings.account.newPassword':       'New Password',
    'settings.account.confirmPassword':   'Confirm Password',
    'settings.account.updatePassword':    'Update Password',
    'settings.account.deleteAccount':     'Delete Account',
    'settings.account.deleteWarning':     'This action is irreversible. I confirm that all my notes, folders, and data will be permanently deleted.',
    'settings.account.passwordMismatch':  'Passwords do not match.',
    'settings.account.passwordShort':     'Password must be at least 6 characters.',

    // Typography tab
    'settings.typo.font':        'Font Family',
    'settings.typo.fontSize':    'Font Size',
    'settings.typo.lineHeight':  'Line Height',
    'settings.typo.pageWidth':   'Page Width',
    'settings.typo.narrow':      'Narrow',
    'settings.typo.medium':      'Medium',
    'settings.typo.full':        'Full Width',
    'settings.typo.theme':       'Editor Theme',
    'settings.typo.dark':        'Dark',
    'settings.typo.light':       'Light',
    'settings.typo.sepia':       'Sepia',
    'settings.typo.preview':     'Preview',
    'settings.typo.previewText': 'The quick brown fox jumped over the lazy dog.',

    // Language tab
    'settings.lang.title':       'Interface Language',
    'settings.lang.note':        'Turkish and English are currently supported. Your note content is not affected.',

    // Notifications tab
    'settings.notif.email':      'Receive emails for important updates',
    'settings.notif.weekly':     'Weekly digest email',

    // Shortcuts tab
    'settings.shortcuts.title':  'Keyboard Shortcuts',
    'settings.shortcuts.search': 'Quick Search',
    'settings.shortcuts.bold':   'Bold Text',
    'settings.shortcuts.italic': 'Italic Text',
    'settings.shortcuts.escape': 'Close Open Modal',
    'settings.shortcuts.save':   'Save Note',
    'settings.shortcuts.newNote':'Create New Note',
  },
} as const

type TranslationKey = keyof typeof translations['tr']

// ── Active language (reactive via localStorage) ───────────────
function getStoredLang(): Language {
  return (localStorage.getItem('nf-lang') as Language) ?? 'tr'
}

export function setStoredLang(lang: Language) {
  localStorage.setItem('nf-lang', lang)
}

// ── t() — main translation function ──────────────────────────
export function t(key: TranslationKey, lang?: Language): string {
  const l = lang ?? getStoredLang()
  return (translations[l] as Record<string, string>)[key] ?? key
}

// ── React hook ────────────────────────────────────────────────
import { useAuthStore } from '@/store/authStore'

export function useT() {
  const preferences = useAuthStore(s => s.preferences)
  const lang: Language = (preferences?.language as Language) ?? getStoredLang()
  return (key: TranslationKey) => t(key, lang)
}
