import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY as string

/** URL ve anon key dolu mu? (boşsa her istek sessizce patlar) */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    supabaseUrl && supabaseUrl !== 'your_supabase_project_url' && supabaseKey,
  )
}

if (!isSupabaseConfigured()) {
  console.warn(
    '[NoteForge] Supabase URL is not configured.\n' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env.local file.\n' +
    'See: https://supabase.com/dashboard → Project Settings → API'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseKey ?? '', {
  auth: {
    autoRefreshToken:  true,
    persistSession:    true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
})
