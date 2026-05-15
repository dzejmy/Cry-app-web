import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ScanLine, CheckCircle2, XCircle, Keyboard, X,
  Users, Calendar, Clock, RefreshCw, AlertCircle, Package,
} from 'lucide-react'
import jsQR from 'jsqr'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getBookingByQRToken, updateBookingStatus } from '../../lib/supabase/bookings'
import { getServiceById } from '../../lib/supabase/services'
import { getSlotById } from '../../lib/supabase/availability'
import type {
  Booking, BookingParticipant, BookingStatus, Service, AvailabilitySlot, Operator,
} from '../../types'

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

interface ScanResult {
  booking: BookingWithParticipants
  service: Service
  slot: AvailabilitySlot
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending:   'Payment pending',
  confirmed: 'Confirmed — ready to check in',
  arrived:   'Already checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// ── Equipment checklist (bundle bookings) ─────────────────────────────────────

function EquipmentChecklist({ participants }: { participants: BookingParticipant[] }) {
  const rentalParticipants = participants.filter((p) => p.rental_data)
  if (rentalParticipants.length === 0) return null

  type CheckKey = string
  const [checked, setChecked] = useState<Set<CheckKey>>(new Set())

  function toggle(key: CheckKey) {
    setChecked((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const allItems: { key: string; label: string; participant: string }[] = []
  rentalParticipants.forEach((p) => {
    const r = p.rental_data!
    const name = `${p.first_name} ${p.last_name}`
    allItems.push({
      key: `${p.id}-equip`,
      label: `${r.equipment_type === 'ski' ? '⛷ Skis' : r.equipment_type === 'snowboard' ? '🏂 Snowboard' : r.equipment_type === 'bike' ? '🚵 Bike' : '⚡ E-Bike'} · ${r.height_cm > 0 ? `${r.height_cm} cm` : ''}${r.boot_size > 0 ? ` · EU ${r.boot_size}` : ''}`,
      participant: name,
    })
    if (r.helmet_size) {
      allItems.push({ key: `${p.id}-helmet`, label: `🪖 Helmet ${r.helmet_size}`, participant: name })
    }
    if (r.preferred_brand) {
      const extras = r.preferred_brand.split(',').filter((s) => s.trim() && s !== 'false')
      extras.forEach((extra, i) => {
        allItems.push({ key: `${p.id}-extra-${i}`, label: `📦 ${extra.trim()}`, participant: name })
      })
    }
  })

  const doneCount = allItems.filter((item) => checked.has(item.key)).length

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50 bg-violet-50">
        <Package className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-bold text-violet-800">Equipment handover</span>
        <span className="ml-auto text-xs font-semibold text-violet-600">
          {doneCount}/{allItems.length}
        </span>
      </div>
      <div className="divide-y divide-gray-50">
        {allItems.map((item) => (
          <label
            key={item.key}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <input
              type="checkbox"
              checked={checked.has(item.key)}
              onChange={() => toggle(item.key)}
              className="w-5 h-5 rounded border-gray-300 accent-violet-600 cursor-pointer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400">{item.participant}</p>
            </div>
            {checked.has(item.key) && (
              <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
            )}
          </label>
        ))}
      </div>
      {doneCount === allItems.length && allItems.length > 0 && (
        <div className="px-4 py-3 bg-green-50 text-xs text-green-700 font-semibold text-center">
          ✓ All equipment handed over
        </div>
      )}
    </div>
  )
}

// ── Result panel ──────────────────────────────────────────────────────────────

function ResultPanel({
  result, operator, onCheckIn, onReset, busy,
}: {
  result: ScanResult
  operator: Operator
  onCheckIn: () => void
  onReset: () => void
  busy: boolean
}) {
  const { booking, service, slot } = result
  const participants = booking.booking_participants ?? []

  const wrongOperator = booking.operator_id !== operator.id
  const isValid      = !wrongOperator && (booking.status === 'confirmed' || booking.status === 'pending')
  const alreadyIn    = !wrongOperator && booking.status === 'arrived'
  const isProblematic = wrongOperator || booking.status === 'cancelled' || booking.status === 'completed'

  const bannerClass = alreadyIn
    ? 'bg-blue-50 border-blue-200'
    : isValid
    ? 'bg-green-50 border-green-200'
    : 'bg-red-50 border-red-200'

  const bannerIcon = alreadyIn
    ? <CheckCircle2 className="w-8 h-8 text-blue-500 shrink-0" />
    : isValid
    ? <CheckCircle2 className="w-8 h-8 text-green-500 shrink-0" />
    : <XCircle className="w-8 h-8 text-red-500 shrink-0" />

  const bannerText = wrongOperator
    ? 'Not your booking'
    : alreadyIn
    ? 'Already checked in'
    : isValid
    ? 'Valid — ready to check in'
    : STATUS_LABELS[booking.status]

  const bannerColor = alreadyIn ? 'text-blue-700' : isValid ? 'text-green-700' : 'text-red-700'
  const bannerSub   = alreadyIn ? 'text-blue-500' : isValid ? 'text-green-600' : 'text-red-500'

  return (
    <div className="space-y-3">
      {/* Status banner */}
      <div className={`rounded-2xl p-4 flex items-center gap-3 border ${bannerClass}`}>
        {bannerIcon}
        <div>
          <p className={`font-bold text-sm ${bannerColor}`}>{bannerText}</p>
          <p className={`text-xs mt-0.5 ${bannerSub}`}>
            #{booking.id.slice(0, 8).toUpperCase()}
            {wrongOperator && ' — this booking belongs to a different operator'}
          </p>
        </div>
      </div>

      {/* Booking details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="font-bold text-gray-900">{service.name}</p>
          {booking.type === 'bundle' && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">📦 Bundle</span>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            {format(parseISO(slot.date), 'EEEE, d MMMM yyyy')}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock className="w-4 h-4 text-gray-400 shrink-0" />
            {slot.start_time.slice(0, 5)}{slot.end_time ? ` – ${slot.end_time.slice(0, 5)}` : ''}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4 text-gray-400 shrink-0" />
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </div>
        </div>

        {/* Participant list */}
        {participants.length > 0 && (
          <div className="pt-2 border-t border-gray-50 space-y-1">
            {participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-600 text-xs flex items-center justify-center font-semibold shrink-0">
                  {i + 1}
                </span>
                <span className="text-gray-800 font-medium">
                  {p.first_name} {p.last_name}
                  {p.age != null && <span className="text-gray-400 font-normal ml-1">· {p.age} yrs</span>}
                </span>
                {p.school_data && (
                  <span className="ml-auto text-xs text-gray-400 capitalize">{p.school_data.skill_level}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Equipment checklist (bundles) */}
      {booking.type === 'bundle' && <EquipmentChecklist participants={participants} />}

      {/* Check-in action */}
      {isValid && (
        <button
          onClick={onCheckIn}
          disabled={busy}
          className="w-full py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-bold text-base shadow-lg disabled:opacity-50 active:scale-95 transition-all"
        >
          {busy ? 'Checking in…' : '✓ Mark as Arrived'}
        </button>
      )}

      {alreadyIn && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 text-center font-medium">
          Guest already checked in — no action needed
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full py-3 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Scan another
      </button>
    </div>
  )
}

// ── Manual entry ──────────────────────────────────────────────────────────────

function ManualEntryModal({
  onSubmit, onClose,
}: {
  onSubmit: (id: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h2 className="font-bold text-gray-900 mb-1">Enter booking ID</h2>
        <p className="text-xs text-gray-400 mb-4">Paste the UUID from the booking confirmation</p>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
          onKeyDown={(e) => e.key === 'Enter' && value.trim() && onSubmit(value.trim())}
        />
        <button
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim()}
          className="w-full mt-3 py-3.5 bg-violet-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-40"
        >
          Look up booking
        </button>
        <button onClick={onClose} className="w-full mt-2 py-3 text-gray-500 text-sm">Cancel</button>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type ScanState = 'idle' | 'scanning' | 'loading' | 'result' | 'error'

export default function QRScannerPage() {
  const { user } = useAuth()
  const [operator, setOperator] = useState<Operator | null>(null)

  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number>(0)
  const scanningRef = useRef(false)

  const [state, setState]       = useState<ScanState>('idle')
  const [result, setResult]     = useState<ScanResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [checkInBusy, setCheckInBusy] = useState(false)

  useEffect(() => {
    if (user) {
      getOperatorByProfileId(user.id).then(setOperator).catch(console.error)
    }
    return () => stopCamera()
  }, [user])

  function stopCamera() {
    scanningRef.current = false
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setState('scanning')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        scanningRef.current = true
        requestAnimationFrame(scanFrame)
      }
    } catch {
      setState('idle')
      toast.error('Camera access denied. Use manual entry.')
    }
  }

  function scanFrame() {
    if (!scanningRef.current) return
    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return

    canvas.width  = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    })

    if (code?.data) {
      stopCamera()
      lookupBooking(code.data)
    } else {
      rafRef.current = requestAnimationFrame(scanFrame)
    }
  }

  async function lookupBooking(token: string) {
    setState('loading')
    try {
      const booking = await getBookingByQRToken(token) as BookingWithParticipants
      const [svc, slot] = await Promise.all([
        getServiceById(booking.service_id),
        getSlotById(booking.availability_slot_id),
      ])
      setResult({ booking, service: svc, slot })
      setState('result')
    } catch {
      setErrorMsg('Booking not found — the QR code may be invalid or expired.')
      setState('error')
    }
  }

  async function handleCheckIn() {
    if (!result) return
    setCheckInBusy(true)
    try {
      const updated = await updateBookingStatus(result.booking.id, 'arrived') as BookingWithParticipants
      setResult((prev) => prev ? { ...prev, booking: updated } : prev)
      toast.success('Guest checked in! ✓')
    } catch {
      toast.error('Check-in failed. Please try again.')
    } finally {
      setCheckInBusy(false)
    }
  }

  function reset() {
    setState('idle')
    setResult(null)
    setErrorMsg('')
    stopCamera()
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24">
        <div className="bg-white border-b border-gray-100 px-4 pt-5 pb-5">
          <h1 className="text-xl font-bold text-gray-900">QR Check-In</h1>
          <p className="text-sm text-gray-400 mt-0.5">Scan guest codes at arrival</p>
        </div>

        <div className="px-4 py-5 max-w-lg mx-auto space-y-4">
          {/* Idle */}
          {state === 'idle' && (
            <div className="flex flex-col items-center text-center pt-8 gap-5">
              <div className="w-28 h-28 rounded-3xl bg-violet-50 flex items-center justify-center">
                <ScanLine className="w-14 h-14 text-violet-400" />
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">Ready to scan</p>
                <p className="text-sm text-gray-400 mt-1 max-w-xs">
                  Point the camera at the customer's QR code or enter the booking ID manually
                </p>
              </div>
              <button
                onClick={startCamera}
                className="w-full py-4 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition-all"
              >
                Open camera
              </button>
              <button
                onClick={() => setShowManual(true)}
                className="w-full py-3.5 border-2 border-gray-200 text-gray-700 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <Keyboard className="w-4 h-4" />
                Enter booking ID manually
              </button>
            </div>
          )}

          {/* Camera */}
          {state === 'scanning' && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square shadow-xl">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Viewfinder overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="relative w-56 h-56">
                    {/* Corner marks */}
                    {[
                      'top-0 left-0',
                      'top-0 right-0 rotate-90',
                      'bottom-0 right-0 rotate-180',
                      'bottom-0 left-0 -rotate-90',
                    ].map((pos, i) => (
                      <div
                        key={i}
                        className={`absolute ${pos} w-8 h-8 border-white`}
                        style={{ borderTopWidth: 3, borderLeftWidth: 3, borderRadius: '2px 0 0 0' }}
                      />
                    ))}
                    {/* Animated scan line */}
                    <div
                      className="absolute left-0 right-0 h-0.5 bg-violet-400/80"
                      style={{ animation: 'scan 2s ease-in-out infinite' }}
                    />
                  </div>
                </div>
              </div>
              {/* Hidden canvas for jsQR processing */}
              <canvas ref={canvasRef} className="hidden" />

              <button
                onClick={() => { stopCamera(); setState('idle') }}
                className="w-full py-3 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-gray-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={() => { stopCamera(); setState('idle'); setShowManual(true) }}
                className="w-full py-3 text-violet-600 text-sm font-semibold flex items-center justify-center gap-2"
              >
                <Keyboard className="w-4 h-4" />
                Enter ID manually
              </button>
            </div>
          )}

          {/* Loading */}
          {state === 'loading' && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center">
                <div className="w-7 h-7 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-gray-500">Looking up booking…</p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex flex-col items-center text-center gap-3">
                <XCircle className="w-12 h-12 text-red-400" />
                <div>
                  <p className="font-bold text-red-700">Booking not found</p>
                  <p className="text-sm text-red-500 mt-1">{errorMsg}</p>
                </div>
              </div>
              <button
                onClick={reset}
                className="w-full py-3.5 bg-gray-900 text-white rounded-2xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Try again
              </button>
            </div>
          )}

          {/* Result */}
          {state === 'result' && result && operator && (
            <ResultPanel
              result={result}
              operator={operator}
              onCheckIn={handleCheckIn}
              onReset={reset}
              busy={checkInBusy}
            />
          )}
        </div>
      </div>

      {showManual && (
        <ManualEntryModal
          onSubmit={(id) => { setShowManual(false); lookupBooking(id) }}
          onClose={() => setShowManual(false)}
        />
      )}

      <style>{`
        @keyframes scan {
          0%, 100% { top: 0%; }
          50% { top: calc(100% - 2px); }
        }
      `}</style>
    </>
  )
}
