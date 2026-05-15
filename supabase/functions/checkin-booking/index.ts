// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, json, err } from '../_shared/cors.ts'

const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!

const adminClient = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Auth: extract caller's identity from JWT ─────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer '))
      return err('Missing Authorization header', 401)

    const jwt = authHeader.replace('Bearer ', '')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return err('Invalid or expired token', 401)

    // ── Resolve operator from caller's profile ───────────────────────────────
    const { data: operator, error: opErr } = await adminClient
      .from('operators')
      .select('id')
      .eq('profile_id', user.id)
      .single()

    if (opErr || !operator)
      return err('Caller is not linked to an operator account', 403)

    // ── Parse body ───────────────────────────────────────────────────────────
    const { qrCodeToken } = await req.json()
    if (!qrCodeToken) return err('qrCodeToken is required')

    // ── Look up booking (booking ID is the QR token) ─────────────────────────
    const { data: booking, error: bookingErr } = await adminClient
      .from('bookings')
      .select('*, booking_participants(*)')
      .eq('id', qrCodeToken)
      .single()

    if (bookingErr || !booking) return err('Booking not found', 404)

    // ── Ownership check ───────────────────────────────────────────────────────
    if (booking.operator_id !== operator.id)
      return err('This booking does not belong to your operator account', 403)

    // ── Status guard ──────────────────────────────────────────────────────────
    if (booking.status === 'cancelled')
      return err('Booking has been cancelled', 400)
    if (booking.status === 'arrived' || booking.status === 'completed')
      return json({ booking, alreadyCheckedIn: true })

    // ── Mark as arrived ───────────────────────────────────────────────────────
    const { data: updated, error: updateErr } = await adminClient
      .from('bookings')
      .update({ status: 'arrived' })
      .eq('id', booking.id)
      .select('*, booking_participants(*)')
      .single()

    if (updateErr || !updated) throw new Error(updateErr?.message ?? 'Update failed')

    // Fetch slot and service for display context
    const [{ data: slot }, { data: service }] = await Promise.all([
      adminClient.from('availability_slots').select('date, start_time, end_time').eq('id', booking.availability_slot_id).single(),
      adminClient.from('services').select('name, type').eq('id', booking.service_id).single(),
    ])

    return json({
      booking: updated,
      slot:    slot ?? null,
      service: service ?? null,
      alreadyCheckedIn: false,
    })
  } catch (e: any) {
    console.error('[checkin-booking]', e)
    return err(e.message ?? 'Internal server error', 500)
  }
})
