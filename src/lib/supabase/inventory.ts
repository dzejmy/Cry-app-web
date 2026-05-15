import type { EquipmentInventory } from '../../types'
import { supabase } from './client'

function assertData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`[inventory] ${context}: ${error.message}`)
  if (data === null) throw new Error(`[inventory] ${context}: no data returned`)
  return data
}

export async function getInventoryByOperator(operatorId: string): Promise<EquipmentInventory[]> {
  const { data, error } = await supabase
    .from('equipment_inventory')
    .select('*')
    .eq('operator_id', operatorId)
    .order('category')
    .order('size')

  return assertData(data, error, `getInventoryByOperator(${operatorId})`) as EquipmentInventory[]
}

export async function updateInventoryAvailability(
  id: string,
  quantityAvailable: number,
): Promise<EquipmentInventory> {
  const { data, error } = await supabase
    .from('equipment_inventory')
    .update({ quantity_available: quantityAvailable, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  return assertData(data, error, `updateInventoryAvailability(${id})`) as EquipmentInventory
}
