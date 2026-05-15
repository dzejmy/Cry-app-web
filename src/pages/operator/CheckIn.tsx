import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import {
  ScanLine,
  CheckCircle2,
  XCircle,
  Keyboard,
  X,
  Users,
  Calendar,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { getBookingByQRToken, updateBookingStatus } from '../../lib/supabase/bookings'
import { getServiceById } from '../../lib/supabase/services'
import { getSlotById } from '../../lib/supabase/availability'
import type {
  Booking,
  BookingParticipant,
  BookingStatus,
  Service,
  AvailabilitySlot,
} from '../../types'

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

// ── Types ────────────────────────────────────────────────────────────────────

interface ScanResult {
  booking: BookingWithParticipants
  service: Service
  slot: AvailabilitySlot
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Payment pending',
  confirmed: 'Confirmed',
  arrived: 'Already checked in',
  completed: 'Completed',
  cancelled: 'CANCELLED',
}

// ── Result panel ─────────────────────────────────────────────────────────────

function ResultPanel({
  result,
  onCheckIn,
  onReset,
  busy,
}: {
  result: ScanResult
  onCheckIn: () => void
  onReset: () => void
  busy: boolean
}) {
  const { booking, service, slot } = result
  const participants = booking.booking_participants ?? []

  const isValid = booking.status === 'confirmed' || booking.status === 'pending'
  const alreadyIn = booking.status === 'arrived'
  const isCompleted = booking.status === 'completed'
  const isCancelled = booking.status === 'cancelled'

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div
        className={`rounded-2xl p-5 flex items-center gap-4 ${
          alreadyIn
            ? 'bg-blue-50 border border-blue-200'
            : isValid
            ? 'bg-green-50 border border-green-200'
            : 'bg-red-50 border border-red-200'
        }`}
      >
        {alreadyIn ? (
          <CheckCircle2 className="w-8 h-8 text-blue-500 flex-shrink-0" />
        ) : isValid ? (
          <CheckCircle2 className="w-8 h-8 text-green-500 flex-shrink-0" />
        ) : (
          <XCircle className="w-8 h-8 text-red-500 flex-shrink-0" />
        )}
        <div>
          <p className={`font-bold text-sm ${alreadyIn ? 'text-blue-700' : isValid ? 'text-green-700' : 'text-red-700'}`}>
            {alreadyIn ? 'Already checked in' : isValid ? 'Valid booking' : STATUS_LABELS[booking.status]}
          </p>
          <p className={`text-xs mt-0.5 ${alreadyIn ? 'text-blue-500' : isValid ? 'text-green-600' : 'text-red-500'}`}>
            #{booking.id.slice(0, 8).toUpperCase()}
          </p>
        </div>
      </div>

      {/* Booking details */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
        <p className="font-bold text-gray-900">{service.name}</p>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4 text-gray-400" />
            {format(parseISO(slot.date), 'EEEE, d MMMM yyyy')}
          </div>
          {slot.start_time && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-4 h-4 text-gray-400" />
              {slot.start_time.slice(0, 5)}
              {slot.end_time && ` – ${slot.end_time.slice(0, 5)}`}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4 text-gray-400" />
            {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
          </div>
        </div>

        {/* Participants */}
        {participants.length > 0 && (
          <div className="pt-2 border-t border-gray-50 space-y-1">
            {participants.map((p, i) => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-medium flex-shrink-0">
                  {i + 1}
                </span>
                <span className="text-gray-700">
                  {p.first_name} {p.last_name}
                  {p.age != null && <span className="text-gray-400 ml-1">· {p.age} yrs</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {isValid && (
        <button
          onClick={onCheckIn}
          disabled={busy}
          className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-base shadow-lg disabled:opacity-50 active:scale-95 transition-transform"
        >
          {busy ? 'Checking in…' : '✓ Mark as Arrived'}
        </button>
      )}

      <button
        onClick={onReset}
        className="w-full py-3 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
      >
        <RefreshCw className="w-4 h-4" />
        Scan another
      </button>
    </div>
  )
}

// ── Manual entry modal ────────────────────────────────────────────────────────

function ManualEntryModal({
  onSubmit,
  onClose,
}: {
  onSubmit: (id: string) => void
  onClose: () => void
}) {
  const [value, setValue] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl p-6 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h2 className="font-bold text-gray-900 mb-4">Enter booking ID</h2>
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. a1b2c3d4-…"
          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          onKeyDown={(e) => e.key === 'Enter' && value.trim() && onSubmit(value.trim())}
        />
        <button
          onClick={() => value.trim() && onSubmit(value.trim())}
          disabled={!value.trim()}
          className="w-full mt-3 py-3.5 bg-blue-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-40"
        >
          Look up booking
        </button>
        <button onClick={onClose} className="w-full mt-2 py-3 text-gray-500 text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ScanState = 'idle' | 'scanning' | 'loading' | 'result' | 'error'

export default function CheckIn() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const detectorRef = useRef<any>(null)
  const frameRef = useRef<number>(0)

  const [state, setState] = useState<ScanState>('idle')
  const [cameraAllowed, setCameraAllowed] = useState<boolean | null>(null)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [checkInBusy, setCheckInBusy] = useState(false)

  // BarcodeDetector support check
  const hasDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [])

  function stopCamera() {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  async function startCamera() {
    setState('scanning')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      setCameraAllowed(true)

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
      }

      if (hasDetector) {
        // @ts-ignore
        detectorRef.current = new window.BarcodeDetector({ formats: ['qr_code'] })
        scanLoop()
      }
    } catch {
      setCameraAllowed(false)
      setState('idle')
      toast.error('Camera access denied. Use manual entry.')
    }
  }

  function scanLoop() {
    if (!videoRef.current || !detectorRef.current) return

    detectorRef.current
      .detect(videoRef.current)
      .then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          const raw = barcodes[0].rawValue as string
          stopCamera()
          lookupBooking(raw)
        } else {
          frameRef.current = requestAnimationFrame(scanLoop)
        }
      })
      .catch(() => {
        frameRef.current = requestAnimationFrame(scanLoop)
      })
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
      setErrorMsg('Booking not found. The QR code may be invalid.')
      setState('error')
    }
  }

  async function handleCheckIn() {
    if (!result) return
    setCheckInBusy(true)
    try {
      const updated = await updateBookingStatus(result.booking.id, 'arrived') as BookingWithParticipants
      setResult((prev) => prev ? { ...prev, booking: updated } : prev)
      toast.success('Guest checked in!')
    } catch {
      toast.error('Check-in failed. Try again.')
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
        {/* Header */}
        <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
          <h1 className="text-2xl font-bold text-gray-900">QR Check-In</h1>
          <p className="text-sm text-gray-400 mt-0.5">Scan guest QR codes at arrival</p>
        </div>

        <div className="px-4 py-5 space-y-4">
          {/* Idle state */}
          {state === 'idle' && (
            <div className="flex flex-col items-center text-center pt-8 gap-5">
              <div className="w-24 h-24 rounded-3xl bg-blue-50 flex items-center justify-center">
                <ScanLine className="w-12 h-12 text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Ready to scan</p>
                <p className="text-sm text-gray-400 mt-1">
                  {hasDetector
                    ? 'Use the camera or enter a booking ID manually'
                    : 'Your browser does not support QR scanning — use manual entry'}
                </p>
              </div>

              {hasDetector && (
                <button
                  onClick={startCamera}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-base shadow-md active:scale-95 transition-transform"
                >
                  Open camera
                </button>
              )}
              <button
                onClick={() => setShowManual(true)}
                className="w-full py-3.5 border border-gray-200 text-gray-700 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
              >
                <Keyboard className="w-4 h-4" />
                Enter booking ID manually
              </button>
            </div>
          )}

          {/* Camera scanner */}
          {state === 'scanning' && (
            <div className="space-y-4">
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-56 h-56 relative">
                    {/* Corner marks */}
                    {['top-0 left-0', 'top-0 right-0 rotate-90', 'bottom-0 right-0 rotate-180', 'bottom-0 left-0 -rotate-90'].map(
                      (pos, i) => (
                        <div
                          key={i}
                          className={`absolute ${pos} w-8 h-8 border-white`}
                          style={{
                            borderTopWidth: 3,
                            borderLeftWidth: 3,
                            borderRadius: '2px 0 0 0',
                          }}
                        />
                      ),
                    )}
                    {/* Scan line animation */}
                    <div className="absolute left-0 right-0 h-0.5 bg-blue-400/80 animate-[scan_2s_ease-in-out_infinite]" />
                  </div>
                </div>

                {/* Camera not available notice */}
                {cameraAllowed === false && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white text-center p-6">
                    <div>
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-400" />
                      <p className="text-sm">Camera access denied</p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => { stopCamera(); setState('idle') }}
                className="w-full py-3 border border-gray-200 text-gray-600 rounded-2xl text-sm font-medium flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={() => { stopCamera(); setState('idle'); setShowManual(true) }}
                className="w-full py-3 text-blue-600 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Keyboard className="w-4 h-4" />
                Enter ID manually
              </button>
            </div>
          )}

          {/* Loading */}
          {state === 'loading' && (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-sm text-gray-500">Looking up booking…</p>
            </div>
          )}

          {/* Error */}
          {state === 'error' && (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col items-center text-center gap-3">
                <XCircle className="w-10 h-10 text-red-400" />
                <div>
                  <p className="font-semibold text-red-700">Booking not found</p>
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
          {state === 'result' && result && (
            <ResultPanel
              result={result}
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

      {/* Scan line animation keyframe */}
      <style>{`
        @keyframes scan {
          0% { top: 0%; }
          50% { top: calc(100% - 2px); }
          100% { top: 0%; }
        }
      `}</style>
    </>
  )
}
