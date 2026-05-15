import { format } from 'date-fns'
import type { AvailabilitySlot } from '../../types'
import { supabase } from './client'

function assertData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`[availability] ${context}: ${error.message}`)
  if (data === null) throw new Error(`[availability] ${context}: no data returned`)
  return data
}

/**
 * Returns a single availability slot by its UUID.
 */
export async function getSlotById(id: string): Promise<AvailabilitySlot> {
  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('id', id)
    .single()

  return assertData(data, error, `getSlotById(${id})`)
}

export type SlotInsert = {
  service_id: string
  operator_id: string
  date: string           // 'yyyy-MM-dd'
  start_time: string     // 'HH:mm'
  end_time: string       // 'HH:mm'
  capacity_total: number
  price_override?: number | null
  notes?: string | null
}

/**
 * Returns ALL slots for a service in a date range regardless of remaining capacity
 * or active status — used by operators managing their own availability.
 */
export async function getAllSlotsByService(
  serviceId: string,
  dateRange: { from: Date; to: Date },
): Promise<AvailabilitySlot[]> {
  const from = format(dateRange.from, 'yyyy-MM-dd')
  const to = format(dateRange.to, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('service_id', serviceId)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('start_time')

  return assertData(data, error, `getAllSlotsByService(${serviceId})`) as AvailabilitySlot[]
}

/**
 * Creates a new availability slot for a service. Returns the created row.
 */
export async function createSlot(insert: SlotInsert): Promise<AvailabilitySlot> {
  const { data, error } = await supabase
    .from('availability_slots')
    .insert({
      ...insert,
      capacity_booked: 0,
      active: true,
    })
    .select()
    .single()

  return assertData(data, error, 'createSlot') as AvailabilitySlot
}

/**
 * Hard-deletes a slot by ID. Only safe when capacity_booked === 0.
 * For slots with bookings, use blockSlot() to deactivate instead.
 */
export async function deleteSlot(slotId: string): Promise<void> {
  const { error } = await supabase
    .from('availability_slots')
    .delete()
    .eq('id', slotId)

  if (error) throw new Error(`[availability] deleteSlot: ${error.message}`)
}

/**
 * Returns active slots for a service within an inclusive date range,
 * where at least one space is still available (capacity_booked < capacity_total).
 */
export async function getAvailableSlots(
  serviceId: string,
  dateRange: { from: Date; to: Date },
): Promise<AvailabilitySlot[]> {
  const from = format(dateRange.from, 'yyyy-MM-dd')
  const to = format(dateRange.to, 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('availability_slots')
    .select('*')
    .eq('service_id', serviceId)
    .eq('active', true)
    .gte('date', from)
    .lte('date', to)
    .order('date')
    .order('start_time')

  const slots = assertData(data, error, `getAvailableSlots(${serviceId})`)

  // Filter client-side to guarantee capacity invariant is never exposed
  return slots.filter((s) => s.capacity_booked < s.capacity_total)
}

/**
 * Marks a slot as inactive so operators can block it from being booked.
 */
export async function blockSlot(slotId: string): Promise<AvailabilitySlot> {
  const { data, error } = await supabase
    .from('availability_slots')
    .update({ active: false })
    .eq('id', slotId)
    .select()
    .single()

  return assertData(data, error, `blockSlot(${slotId})`)
}

/**
 * Atomically increments capacity_booked by 1 for a slot.
 *
 * The update is conditioned on capacity_booked < capacity_total so the DB-level
 * CHECK constraint is never violated. If the slot is full the update affects 0
 * rows and an error is thrown.
 *
 * For high-traffic production use, replace this with a Supabase RPC that runs
 * the increment inside a single SQL statement to eliminate the TOCTOU window.
 */
export async function decrementCapacity(slotId: string): Promise<AvailabilitySlot> {
  // Fetch current state
  const { data: current, error: fetchError } = await supabase
    .from('availability_slots')
    .select('capacity_booked, capacity_total')
    .eq('id', slotId)
    .single()

  if (fetchError || !current) {
    throw new Error(`[availability] decrementCapacity: slot not found (${slotId})`)
  }

  if (current.capacity_booked >= current.capacity_total) {
    throw new Error(`[availability] decrementCapacity: slot ${slotId} is fully booked`)
  }

  // Update only if the slot is still not full (optimistic guard)
  const { data, error } = await supabase
    .from('availability_slots')
    .update({ capacity_booked: current.capacity_booked + 1 })
    .eq('id', slotId)
    .lt('capacity_booked', current.capacity_total)
    .select()
    .single()

  if (error || !data) {
    throw new Error(
      `[availability] decrementCapacity: slot ${slotId} was claimed concurrently or is full`,
    )
  }

  return data as AvailabilitySlot
}
