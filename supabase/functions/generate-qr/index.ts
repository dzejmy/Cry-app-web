// deno-lint-ignore-file no-explicit-any
import { createClient } from 'npm:@supabase/supabase-js@2'
import QRCode from 'npm:qrcode@1.5.4'
import { corsHeaders, json, err } from '../_shared/cors.ts'

const supabaseUrl    = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey        = Deno.env.get('SUPABASE_ANON_KEY')!

const adminClient = createClient(supabaseUrl, serviceRoleKey)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer '))
      return err('Missing Authorization header', 401)

    const jwt = authHeader.replace('Bearer ', '')
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    })

    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return err('Invalid or expired token', 401)

    // ── Parse bookingId ───────────────────────────────────────────────────────
    const url      = new URL(req.url)
    const bookingId = url.searchParams.get('bookingId') ?? (await req.json().catch(() => ({}))).bookingId

    if (!bookingId) return err('bookingId is required')

    // ── Fetch booking ─────────────────────────────────────────────────────────
    const { data: booking, error: bookingErr } = await adminClient
      .from('bookings')
      .select('id, customer_id, operator_id')
      .eq('id', bookingId)
      .single()

    if (bookingErr || !booking) return err('Booking not found', 404)

    // ── Authorisation: caller must be booking owner OR the booking's operator ─
    const isCustomer = booking.customer_id === user.id

    let isOperator = false
    if (!isCustomer) {
      const { data: operator } = await adminClient
        .from('operators')
        .select('id')
        .eq('profile_id', user.id)
        .single()
      isOperator = operator?.id === booking.operator_id
    }

    if (!isCustomer && !isOperator)
      return err('Not authorised to generate QR for this booking', 403)

    // ── Generate QR PNG ───────────────────────────────────────────────────────
    const qrUrl     = `https://peakpass.app/checkin/${booking.id}`
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width:                300,
      margin:               2,
      errorCorrectionLevel: 'M',
      color: {
        dark:  '#1e1b4b',   // deep indigo
        light: '#ffffff',
      },
    })

    // Strip the data URL prefix to return raw base64
    const base64 = qrDataUrl.replace('data:image/png;base64,', '')

    return json({ base64, dataUrl: qrDataUrl, bookingId: booking.id })
  } catch (e: any) {
    console.error('[generate-qr]', e)
    return err(e.message ?? 'Internal server error', 500)
  }
})
