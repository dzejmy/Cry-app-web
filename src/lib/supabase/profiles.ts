import type { Profile } from '../../types'
import { supabase } from './client'

export interface ProfileUpdate {
  first_name?: string
  last_name?: string
  phone?: string | null
  preferred_language?: string
  avatar_url?: string | null
}

export async function updateProfile(userId: string, fields: ProfileUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) throw new Error(`[profiles] updateProfile: ${error.message}`)
  if (!data) throw new Error('[profiles] updateProfile: no data returned')
  return data as Profile
}
