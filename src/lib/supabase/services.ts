import type { Service } from '../../types'
import { supabase } from './client'

function assertData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`[services] ${context}: ${error.message}`)
  if (data === null) throw new Error(`[services] ${context}: no data returned`)
  return data
}

/**
 * Returns all active services offered by an operator at a specific resort.
 */
export async function getServicesByOperator(
  operatorId: string,
  resortId: string,
): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('resort_id', resortId)
    .eq('active', true)
    .order('type')

  return assertData(data, error, `getServicesByOperator(${operatorId}, ${resortId})`)
}

/**
 * Returns all active services for an operator across all resorts.
 * Used by the operator dashboard/availability management where resortId is unknown.
 */
export async function getAllServicesByOperator(operatorId: string): Promise<Service[]> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('active', true)
    .order('type')

  return assertData(data, error, `getAllServicesByOperator(${operatorId})`)
}

/**
 * Returns a single service by its UUID.
 */
export async function getServiceById(id: string): Promise<Service> {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('id', id)
    .single()

  return assertData(data, error, `getServiceById(${id})`)
}
