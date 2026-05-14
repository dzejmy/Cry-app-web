import type { Operator, OfferPageContent } from '../../types'
import { supabase } from './client'

function assertData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`[operators] ${context}: ${error.message}`)
  if (data === null) throw new Error(`[operators] ${context}: no data returned`)
  return data
}

/**
 * Returns all verified, active operators that operate at a given resort.
 */
export async function getOperatorsByResort(resortId: string): Promise<Operator[]> {
  const { data, error } = await supabase
    .from('operator_resorts')
    .select('operators(*)')
    .eq('resort_id', resortId)
    .eq('active', true)

  if (error) throw new Error(`[operators] getOperatorsByResort: ${error.message}`)

  // Unwrap the nested join result
  const operators = (data ?? [])
    .map((row) => (row as unknown as { operators: Operator | null }).operators)
    .filter((op): op is Operator => op !== null && op.verified && op.active)

  return operators
}

/**
 * Returns a single operator by its UUID.
 */
export async function getOperatorById(id: string): Promise<Operator> {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('id', id)
    .single()

  return assertData(data, error, `getOperatorById(${id})`)
}

/**
 * Returns the published offer page for an operator at a resort.
 * Returns null if no published page exists.
 */
export async function getOfferPage(
  operatorId: string,
  resortId: string,
): Promise<OfferPageContent | null> {
  const { data, error } = await supabase
    .from('offer_page_content')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('resort_id', resortId)
    .eq('published', true)
    .maybeSingle()

  if (error) throw new Error(`[operators] getOfferPage: ${error.message}`)
  return data
}
