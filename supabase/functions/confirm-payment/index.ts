// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'npm:stripe@14'
import QRCode from 'npm:qrcode@1.5.4'

const adminClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-04-10',
})

// ── Email copy ────────────────────────────────────────────────────────────────

const PREP_TIPS: Record<string, string[]> = {
  ski_school: [
    'Dress in warm, waterproof layers — a base layer, fleece mid-layer, and a ski jacket.',
    'Bring your own gloves and goggles if possible.',
    'Arrive 15 minutes early so we can fit your equipment without rushing.',
    'Eat a solid breakfast — ski school mornings are high-energy!',
  ],
  ski_rental: [
    'Wear wool or synthetic ski socks — cotton gets cold and wet.',
    'Bring your own helmet if you have one; we also provide them.',
    'Our staff will custom-fit boots and bindings for you on the day.',
  ],
  bike_rental: [
    'Wear comfortable, fitted clothing and closed-toe shoes.',
    'Bring at least 1 litre of water and a light snack for longer rides.',
    'Helmet is included with your rental — please wear it at all times.',
  ],
  bike_guiding: [
    'Bring sunscreen, water (1.5–2 L), and a light rain jacket.',
    'Light gloves and sunglasses are recommended for mountain trails.',
    "Tell your guide your fitness level before you set off — they'll pace the group.",
  ],
}

function buildEmailHtml(params: {
  firstName: string
  serviceName: string
  date: string
  startTime: string
  endTime: string | null
  bookingId: string
  totalPrice: number
  currency: string
  participantCount: number
  serviceType: string
}): string {
  const tips = PREP_TIPS[params.serviceType] ?? []
  const timeRange = params.endTime
    ? `${params.startTime.slice(0, 5)} – ${params.endTime.slice(0, 5)}`
    : params.startTime.slice(0, 5)

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:system-ui,-apple-system,sans-serif;color:#1f2937;margin:0;padding:0;background:#f9fafb">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 28px">
      <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,.7)">PeakPass</p>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#fff">You're all set! 🏔</h1>
    </div>

    <!-- Body -->
    <div style="padding:28px">
      <p style="margin:0 0 20px;font-size:15px;color:#374151">
        Hi <strong>${params.firstName}</strong>, your booking is confirmed.
        Show the QR code below when you arrive.
      </p>

      <!-- Booking card -->
      <div style="background:#f3f4f6;border-radius:12px;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Booking details</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:4px 0;color:#6b7280">Service</td><td style="text-align:right;font-weight:600;color:#111827">${params.serviceName}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Date</td><td style="text-align:right;font-weight:600;color:#111827">${params.date}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Time</td><td style="text-align:right;font-weight:600;color:#111827">${timeRange}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Participants</td><td style="text-align:right;font-weight:600;color:#111827">${params.participantCount}</td></tr>
          <tr><td style="padding:4px 0;color:#6b7280">Total paid</td><td style="text-align:right;font-weight:700;color:#7c3aed">${params.currency.toUpperCase()} ${params.totalPrice.toFixed(2)}</td></tr>
        </table>
        <p style="margin:12px 0 0;font-size:11px;color:#9ca3af">Booking ref: ${params.bookingId.toUpperCase().slice(0, 8)}</p>
      </div>

      ${tips.length > 0 ? `
      <!-- Tips -->
      <div style="margin-bottom:24px">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:#374151">Preparation tips</p>
        <ul style="margin:0;padding-left:18px;font-size:14px;color:#4b5563;line-height:1.7">
          ${tips.map((t) => `<li>${t}</li>`).join('\n          ')}
        </ul>
      </div>` : ''}

      <!-- QR note -->
      <div style="background:#ede9fe;border-radius:12px;padding:16px;font-size:13px;color:#5b21b6">
        📱 <strong>QR code attached.</strong> Show it to your instructor or rental desk on arrival — no printout needed, your phone works perfectly.
      </div>
    </div>

    <!-- Footer -->
    <div style="padding:16px 28px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;text-align:center">
      © PeakPass · Questions? Reply to this email or visit peakpass.app
    </div>
  </div>
</body>
</html>`
}

async function sendConfirmationEmail(params: {
  to: string
  firstName: string
  serviceName: string
  serviceType: string
  date: string
  startTime: string
  endTime: string | null
  bookingId: string
  totalPrice: number
  currency: string
  participantCount: number
}): Promise<void> {
  // Generate QR PNG (encodes the check-in URL)
  const qrUrl     = `https://peakpass.app/checkin/${params.bookingId}`
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 300, margin: 2, errorCorrectionLevel: 'M' })
  const qrBase64  = qrDataUrl.replace('data:image/png;base64,', '')

  const html = buildEmailHtml(params)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from:    'PeakPass <noreply@peakpass.app>',
      to:      [params.to],
      subject: `✅ Confirmed: ${params.serviceName} on ${params.date}`,
      html,
      attachments: [{
        filename: 'peakpass-qr.png',
        content:  qrBase64,
      }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[confirm-payment] Resend error:', text)
    // Don't throw — email failure should not break the webhook response
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const sig         = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  const rawBody     = await req.text()

  // Verify webhook signature
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(rawBody, sig!, webhookSecret)
  } catch (e: any) {
    console.error('[confirm-payment] Signature verification failed:', e.message)
    return new Response(`Webhook error: ${e.message}`, { status: 400 })
  }

  if (event.type !== 'payment_intent.succeeded') {
    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const pi = event.data.object as Stripe.PaymentIntent

  try {
    // Find booking by PaymentIntent ID
    const { data: booking, error: bookingErr } = await adminClient
      .from('bookings')
      .select('*, booking_participants(*)')
      .eq('stripe_payment_intent_id', pi.id)
      .single()

    if (bookingErr || !booking) {
      console.error('[confirm-payment] Booking not found for PI:', pi.id)
      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Update booking to confirmed
    await adminClient
      .from('bookings')
      .update({ status: 'confirmed' })
      .eq('id', booking.id)

    // Fetch service and slot for email content
    const [{ data: service }, { data: slot }] = await Promise.all([
      adminClient.from('services').select('*').eq('id', booking.service_id).single(),
      adminClient.from('availability_slots').select('*').eq('id', booking.availability_slot_id).single(),
    ])

    // Resolve recipient email
    let recipientEmail: string | null = null
    let firstName = 'Guest'

    if (booking.customer_id) {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('email, first_name')
        .eq('id', booking.customer_id)
        .single()
      if (profile) {
        recipientEmail = profile.email
        firstName      = profile.first_name
      }
    } else if (booking.customer_notes?.startsWith('guest_email:')) {
      recipientEmail = booking.customer_notes.replace('guest_email:', '')
    }

    if (recipientEmail && service && slot) {
      const participants: any[] = booking.booking_participants ?? []
      await sendConfirmationEmail({
        to:               recipientEmail,
        firstName,
        serviceName:      service.name,
        serviceType:      service.type,
        date:             slot.date,
        startTime:        slot.start_time,
        endTime:          slot.end_time ?? null,
        bookingId:        booking.id,
        totalPrice:       booking.total_price,
        currency:         booking.currency,
        participantCount: participants.length,
      })
    }
  } catch (e: any) {
    console.error('[confirm-payment] Error processing event:', e)
    // Still return 200 so Stripe doesn't retry indefinitely for non-critical errors
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
