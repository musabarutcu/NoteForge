import { supabase } from '@/lib/supabase'
import type { UserPreferences, UserPreferencesUpdate, ProfileUpdate } from '@/types/database'

export const DEFAULT_PREFERENCES: Omit<UserPreferences, 'user_id' | 'updated_at'> = {
  font_family:          'Inter',
  font_size:            16,
  line_height:          1.6,
  page_width:           'medium',
  theme:                'dark',
  language:             'tr',
  notifications_email:  true,
  notifications_weekly: false,
}

// ── Get preferences ──────────────────────────────────────────
export async function getPreferences(userId: string): Promise<UserPreferences | null> {
  const { data } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .single()
  return data as UserPreferences | null
}

// ── Upsert preferences ───────────────────────────────────────
export async function upsertPreferences(
  userId: string,
  update: UserPreferencesUpdate,
): Promise<UserPreferences> {
  const { data, error } = await supabase
    .from('user_preferences')
    .upsert(
      { user_id: userId, ...update, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data as UserPreferences
}

// ── Update profile (display_name) ────────────────────────────
export async function updateProfile(userId: string, update: ProfileUpdate) {
  const { error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

// ── Change password ──────────────────────────────────────────
export async function changePassword(newPassword: string) {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}

// ── Delete account ───────────────────────────────────────────
// Deletes all user data then removes the auth user via admin edge function
// NOTE: Cascade deletes handle notes/folders/tags/media via FK constraints.
// The auth.users delete requires a Supabase Edge Function or service_role call.
// For now we delete user data and sign out — the orphaned auth.user
// can be cleaned up via Supabase dashboard or a future edge function.
export async function deleteAccount(userId: string) {
  // 1. Delete all notes (cascades to note_tags, media_assets)
  await supabase.from('notes').delete().eq('user_id', userId)

  // 2. Delete folders
  await supabase.from('folders').delete().eq('user_id', userId)

  // 3. Delete tags
  await supabase.from('tags').delete().eq('user_id', userId)

  // 4. Delete preferences
  await supabase.from('user_preferences').delete().eq('user_id', userId)

  // 5. Delete profile
  await supabase.from('profiles').delete().eq('id', userId)

  // 6. Sign out
  await supabase.auth.signOut()
}
