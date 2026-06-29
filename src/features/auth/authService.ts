import { supabase } from '@/lib/supabase'

export interface AuthError {
  message: string
}

// ---- Sign Up ----
export async function signUp(email: string, password: string, displayName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: displayName },
    },
  })

  if (error) throw translateError(error.message)
  return data
}

// ---- Sign In ----
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw translateError(error.message)
  return data
}

// ---- Sign In with Google ----
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/notlar`,
    },
  })
  if (error) throw translateError(error.message)
  return data
}

// ---- Sign Out ----
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw translateError(error.message)
}

// ---- Password Reset ----
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/sifre-sifirla`,
  })
  if (error) throw translateError(error.message)
}

// ---- Translate Supabase error messages to Turkish ----
function translateError(msg: string): Error {
  const map: Record<string, string> = {
    'Invalid login credentials':           'E-posta veya şifre hatalı.',
    'Email not confirmed':                 'E-posta adresin henüz doğrulanmamış. Gelen kutunu kontrol et.',
    'User already registered':             'Bu e-posta adresi zaten kayıtlı.',
    'Password should be at least 6 characters': 'Şifre en az 6 karakter olmalı.',
    'Unable to validate email address':    'Geçersiz e-posta adresi.',
    'For security purposes':               'Güvenlik amacıyla lütfen bir süre bekleyin.',
    'Email rate limit exceeded':           'Çok fazla deneme. Lütfen bir süre bekleyin.',
  }

  const found = Object.entries(map).find(([key]) => msg.toLowerCase().includes(key.toLowerCase()))
  return new Error(found ? found[1] : 'Bir hata oluştu. Lütfen tekrar deneyin.')
}
