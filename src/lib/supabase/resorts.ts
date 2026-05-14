import type { Resort, SeasonMode } from '../../types'
import { supabase } from './client'

function assertData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`[resorts] ${context}: ${error.message}`)
  if (data === null) throw new Error(`[resorts] ${context}: no data returned`)
  return data
}

/**
 * Returns all active resorts, optionally filtered to those that support a season.
 */
export async function getResorts(season?: SeasonMode): Promise<Resort[]> {
  let query = supabase
    .from('resorts')
    .select('*')
    .eq('active', true)
    .order('name')

  if (season) {
    query = query.contains('season_modes', [season])
  }

  const { data, error } = await query
  return assertData(data, error, 'getResorts')
}

/**
 * Returns a single resort by its UUID.
 */
export async function getResortById(id: string): Promise<Resort> {
  const { data, error } = await supabase
    .from('resorts')
    .select('*')
    .eq('id', id)
    .single()

  return assertData(data, error, `getResortById(${id})`)
}
