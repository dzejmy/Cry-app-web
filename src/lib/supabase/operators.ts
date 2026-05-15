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
 * Returns the operator record whose profile_id matches the given auth user ID.
 * Returns null if no operator has been created for this profile yet.
 */
export async function getOperatorByProfileId(profileId: string): Promise<Operator | null> {
  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle()

  if (error) throw new Error(`[operators] getOperatorByProfileId: ${error.message}`)
  return data
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

export interface OperatorUpdate {
  name?: string
  description?: string
  logo_url?: string | null
  website_url?: string | null
  phone?: string | null
  email?: string | null
}

export async function updateOperator(id: string, fields: OperatorUpdate): Promise<Operator> {
  const { data, error } = await supabase
    .from('operators')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  return assertData(data, error, `updateOperator(${id})`)
}

/**
 * Returns resort IDs this operator is linked to (active only).
 */
export async function getOperatorResortIds(operatorId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('operator_resorts')
    .select('resort_id')
    .eq('operator_id', operatorId)
    .eq('active', true)

  if (error) throw new Error(`[operators] getOperatorResortIds: ${error.message}`)
  return (data ?? []).map((row: { resort_id: string }) => row.resort_id)
}

/**
 * Links an operator to a resort.
 */
export async function addOperatorResort(operatorId: string, resortId: string): Promise<void> {
  const { error } = await supabase
    .from('operator_resorts')
    .upsert({ operator_id: operatorId, resort_id: resortId, active: true })

  if (error) throw new Error(`[operators] addOperatorResort: ${error.message}`)
}

/**
 * Removes the link between an operator and a resort.
 */
export async function removeOperatorResort(operatorId: string, resortId: string): Promise<void> {
  const { error } = await supabase
    .from('operator_resorts')
    .delete()
    .eq('operator_id', operatorId)
    .eq('resort_id', resortId)

  if (error) throw new Error(`[operators] removeOperatorResort: ${error.message}`)
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
