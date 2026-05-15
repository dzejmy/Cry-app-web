// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'
import { corsHeaders, json, err } from '../_shared/cors.ts'

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
})

// ── Booking type from service types ───────────────────────────────────────────

function resolveBookingType(serviceTypes: string[]): string {
  if (serviceTypes.length > 1) return 'bundle'
  switch (serviceTypes[0]) {
    case 'ski_school':  return 'school_only'
    case 'bike_guiding': return 'guiding_only'
    default:            return 'rental_only'
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const body = await req.json()
    const {
      serviceIds,
      participants,
      slotId,
      guestEmail,
      customerId,
      stripeToken,     // PaymentMethod ID from frontend
    } = body

    // ── Input validation ────────────────────────────────────────────────────
    if (!Array.isArray(serviceIds) || serviceIds.length === 0)
      return err('serviceIds is required')
    if (!Array.isArray(participants) || participants.length === 0)
      return err('participants is required')
    if (!slotId)        return err('slotId is required')
    if (!stripeToken)   return err('stripeToken is required')
    if (!customerId && !guestEmail)
      return err('Either customerId or guestEmail is required')

    // ── Fetch and validate slot ─────────────────────────────────────────────
    const { data: slot, error: slotErr } = await adminClient
      .from('availability_slots')
      .select('*')
      .eq('id', slotId)
      .single()

    if (slotErr || !slot) return err('Slot not found', 404)
    if (!slot.active)    return err('Slot is not available for booking', 400)

    const remaining = slot.capacity_total - slot.capacity_booked
    if (remaining < participants.length)
      return err(`Only ${remaining} spot${remaining === 1 ? '' : 's'} remaining`, 400)

    // ── Fetch services ──────────────────────────────────────────────────────
    const { data: services, error: svcErr } = await adminClient
      .from('services')
      .select('*')
      .in('id', serviceIds)
      .eq('active', true)

    if (svcErr || !services?.length) return err('One or more services not found', 404)

    const primaryService = services[0]
    const bookingType    = resolveBookingType(services.map((s: any) => s.type))

    // ── Validate rental equipment for bundle/rental bookings ────────────────
    const needsRental = bookingType === 'bundle' || bookingType === 'rental_only'
    if (needsRental) {
      const { data: inventory } = await adminClient
        .from('equipment_inventory')
        .select('quantity_available')
        .eq('operator_id', primaryService.operator_id)
        .gt('quantity_available', 0)

      if (!inventory?.length)
        return err('No rental equipment currently available', 400)
    }

    // ── Calculate total price ───────────────────────────────────────────────
    const pricePerPerson = services.reduce(
      (sum: number, s: any) => sum + (s.price_per_person ?? 0), 0,
    )
    const totalPrice = pricePerPerson * participants.length

    // ── Create Stripe PaymentIntent (manual capture = authorise only) ───────
    const paymentIntent = await stripe.paymentIntents.create({
      amount:         Math.round(totalPrice * 100),   // EUR cents
      currency:       'eur',
      payment_method: stripeToken,
      capture_method: 'manual',
      confirm:        false,
      metadata: {
        slotId,
        operatorId:   primaryService.operator_id,
        serviceType:  primaryService.type,
        bookingType,
      },
    })

    // ── Insert booking ──────────────────────────────────────────────────────
    const { data: booking, error: bookingErr } = await adminClient
      .from('bookings')
      .insert({
        customer_id:              customerId ?? null,
        operator_id:              primaryService.operator_id,
        resort_id:                primaryService.resort_id,
        service_id:               primaryService.id,
        availability_slot_id:     slotId,
        type:                     bookingType,
        status:                   'pending',
        total_price:              totalPrice,
        currency:                 primaryService.currency ?? 'eur',
        stripe_payment_intent_id: paymentIntent.id,
        customer_notes:           guestEmail ? `guest_email:${guestEmail}` : null,
      })
      .select()
      .single()

    if (bookingErr) throw new Error(bookingErr.message)

    // ── Insert participants ──────────────────────────────────────────────────
    const participantRows = participants.map((p: any) => ({
      booking_id:  booking.id,
      first_name:  p.first_name,
      last_name:   p.last_name,
      age:         p.age ?? null,
      school_data: p.school_data ?? null,
      rental_data: p.rental_data ?? null,
    }))

    const { error: partErr } = await adminClient
      .from('booking_participants')
      .insert(participantRows)

    if (partErr) {
      // Attempt cleanup — best-effort
      await adminClient.from('bookings').delete().eq('id', booking.id)
      await stripe.paymentIntents.cancel(paymentIntent.id)
      throw new Error(partErr.message)
    }

    // ── Decrement slot capacity (optimistic lock on capacity_booked) ─────────
    const { data: updated, error: capErr } = await adminClient
      .from('availability_slots')
      .update({ capacity_booked: slot.capacity_booked + participants.length })
      .eq('id', slotId)
      .eq('capacity_booked', slot.capacity_booked)   // must not have changed
      .select('id')

    if (capErr || !updated || updated.length === 0) {
      // Slot was taken concurrently — roll back
      await adminClient.from('bookings').delete().eq('id', booking.id)
      await stripe.paymentIntents.cancel(paymentIntent.id)
      return err('Slot was just claimed by another booking, please try again', 409)
    }

    return json({
      bookingId:    booking.id,
      clientSecret: paymentIntent.client_secret,
      qrCodeToken:  booking.id,   // booking ID serves as the QR token
    })
  } catch (e: any) {
    console.error('[create-booking]', e)
    return err(e.message ?? 'Internal server error', 500)
  }
})
