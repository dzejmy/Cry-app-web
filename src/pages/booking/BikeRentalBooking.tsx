import {
  useState, useEffect, useRef, useCallback,
  createContext, useContext,
} from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  format, parseISO, differenceInDays, addDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isToday,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Check, CheckCircle2, Users, CalendarDays,
  ArrowLeft, RotateCcw, ChevronDown, ChevronUp, Zap, Shield,
} from 'lucide-react'
import { z } from 'zod'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

import { useBikeRentalStore } from '../../store/bikeRentalStore'
import type { BikeRentalParticipant, RidingStyle } from '../../store/bikeRentalStore'
import {
  recommendBike, BIKE_TIER_COLORS, BIKE_TIER_LABELS,
  BIKE_TIERS_BY_STYLE, bikeFrameSize,
} from '../../utils/equipment'
import type { BikeTier } from '../../utils/equipment'
import { getServicesByOperator } from '../../lib/supabase/services'
import { getAvailableSlots } from '../../lib/supabase/availability'
import { createBooking } from '../../lib/supabase/bookings'
import type { Service, Operator, Resort } from '../../types'
import { getOperatorById } from '../../lib/supabase/operators'
import { getResortById } from '../../lib/supabase/resorts'
import { useAuth } from '../../hooks/useAuth'
import { useSeasonStore } from '../../store/seasonStore'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'

// ─── Stripe ───────────────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder')

// ─── Booking context ──────────────────────────────────────────────────────────

interface BookingCtxValue {
  operatorId: string
  resortId: string
  service: Service | null
  operator: Operator | null
  resort: Resort | null
}

const BookingCtx = createContext<BookingCtxValue>({
  operatorId: '', resortId: '', service: null, operator: null, resort: null,
})

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const DateRangeSchema = z
  .object({
    pickup: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ret: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.ret > d.pickup, { message: 'Return date must be after pick-up', path: ['ret'] })
  .refine(
    (d) => {
      const days = differenceInDays(parseISO(d.ret), parseISO(d.pickup))
      return days >= 1 && days <= 14
    },
    { message: 'Rental period must be 1–14 days', path: ['ret'] },
  )

const ParticipantSchema = z
  .object({
    firstName: z.string().min(1, 'Required'),
    lastName: z.string().min(1, 'Required'),
    age: z.number({ invalid_type_error: 'Required' }).int().min(6, 'Min age 6').max(99),
    heightCm: z.number({ invalid_type_error: 'Required' }).int().min(100, 'Min 100 cm').max(220),
    weightKg: z.number({ invalid_type_error: 'Required' }).min(15).max(250),
    ridingStyle: z.enum(['trail', 'enduro', 'cross_country', 'leisure']),
  })

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEPS = ['Dates', 'Participants', 'Bike Reco', 'Review', 'Payment', 'Done']

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-16 z-20">
      <div className="max-w-screen-md mx-auto flex items-center gap-1">
        {STEPS.map((label, i) => {
          const n = i + 1
          const done = n < step
          const active = n === step
          return (
            <div key={n} className="flex items-center gap-1 flex-1 min-w-0">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  done || active ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500',
                ].join(' ')}>
                  {done ? <Check className="w-3.5 h-3.5" /> : n}
                </div>
                <span className={['text-[9px] font-medium hidden sm:block', active ? 'text-amber-600' : 'text-gray-400'].join(' ')}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={['h-0.5 flex-1 rounded-full transition-colors', done ? 'bg-amber-500' : 'bg-gray-200'].join(' ')} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

function DateRangePicker({
  pickupDate, returnDate, availableDates, loading, onChange,
}: {
  pickupDate: string | null
  returnDate: string | null
  availableDates: Set<string>
  loading: boolean
  onChange: (pickup: string, ret: string) => void
}) {
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const [selecting, setSelecting] = useState<'start' | 'end'>(pickupDate ? 'end' : 'start')
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: startOfMonth(displayMonth), end: endOfMonth(displayMonth) })
  const startPad = (getDay(startOfMonth(displayMonth)) + 6) % 7

  function handleDayClick(dateStr: string) {
    if (dateStr < todayStr) return
    if (selecting === 'start') { onChange(dateStr, ''); setSelecting('end'); return }
    if (!pickupDate || dateStr <= pickupDate) { onChange(dateStr, ''); setSelecting('end'); return }
    const d = differenceInDays(parseISO(dateStr), parseISO(pickupDate))
    if (d > 14) { toast.error('Maximum rental is 14 days.'); return }
    onChange(pickupDate, dateStr)
    setSelecting('start')
  }

  function dayClasses(dateStr: string): string {
    const past = dateStr < todayStr
    const isStart = dateStr === pickupDate
    const isEnd = dateStr === returnDate
    const inRange = pickupDate && returnDate && dateStr > pickupDate && dateStr < returnDate
    const inPreview = pickupDate && !returnDate && hoverDate && selecting === 'end' && dateStr > pickupDate && dateStr < hoverDate
    const tooFar = pickupDate && selecting === 'end' && differenceInDays(parseISO(dateStr), parseISO(pickupDate)) > 14

    if (past || tooFar) return 'text-gray-300 cursor-not-allowed'
    if (isStart) return 'bg-amber-500 text-white rounded-l-full font-bold cursor-pointer'
    if (isEnd) return 'bg-amber-500 text-white rounded-r-full font-bold cursor-pointer'
    if (inRange) return 'bg-amber-100 text-amber-700 cursor-pointer'
    if (inPreview) return 'bg-amber-50 text-amber-600 cursor-pointer'
    if (isToday(parseISO(dateStr))) return 'ring-1 ring-amber-400 text-amber-700 rounded-full cursor-pointer'
    return 'text-gray-700 hover:bg-gray-100 rounded-full cursor-pointer'
  }

  return (
    <div className="max-w-sm">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setDisplayMonth((m) => subMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" aria-label="Previous month">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{format(displayMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setDisplayMonth((m) => addMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500" aria-label="Next month">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }).map((_, i) => <span key={`p${i}`} />)}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const past = dateStr < todayStr
          return (
            <div
              key={dateStr}
              className={['flex flex-col items-center py-1 select-none transition-colors', dayClasses(dateStr)].join(' ')}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => setHoverDate(dateStr)}
              onMouseLeave={() => setHoverDate(null)}
              role="button" tabIndex={past ? -1 : 0}
              onKeyDown={(e) => e.key === 'Enter' && handleDayClick(dateStr)}
            >
              <span className="text-xs leading-5">{format(day, 'd')}</span>
              {loading
                ? <span className="w-1 h-1 rounded-full bg-gray-200 animate-pulse" />
                : <span className={['w-1 h-1 rounded-full', past ? 'bg-transparent' : availableDates.has(dateStr) ? 'bg-green-500' : 'bg-gray-200'].join(' ')} />
              }
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        {selecting === 'start'
          ? 'Click a date to set pick-up'
          : pickupDate ? `Pick-up: ${format(parseISO(pickupDate), 'd MMM')} — click return date` : ''}
      </p>
      <div className="flex gap-4 mt-3 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" /> Unknown</span>
      </div>
    </div>
  )
}

// ─── QR display ───────────────────────────────────────────────────────────────

function QRDisplay({ bookingId }: { bookingId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const largeRef = useRef<HTMLCanvasElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, bookingId, { width: 200, margin: 2 })
  }, [bookingId])
  useEffect(() => {
    if (expanded && largeRef.current) QRCode.toCanvas(largeRef.current, bookingId, { width: 280, margin: 3 })
  }, [expanded, bookingId])

  return (
    <>
      <button onClick={() => setExpanded(true)} className="inline-block rounded-2xl overflow-hidden shadow-md" aria-label="Expand QR">
        <canvas ref={canvasRef} className="block" />
      </button>
      <p className="text-xs text-gray-400 mt-1">Tap to expand</p>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4" onClick={() => setExpanded(false)}>
          <canvas ref={largeRef} className="rounded-2xl" onClick={(e) => e.stopPropagation()} />
          <p className="text-white/60 text-sm">Tap anywhere to close</p>
        </div>
      )}
    </>
  )
}

// ─── Participant form ─────────────────────────────────────────────────────────

const RIDING_STYLES: { value: RidingStyle; label: string; icon: string; desc: string }[] = [
  { value: 'leisure',       label: 'Leisure',       icon: '🛤️', desc: 'Scenic paths, easy terrain' },
  { value: 'trail',         label: 'Trail',         icon: '🌲', desc: 'Singletrack, some tech' },
  { value: 'enduro',        label: 'Enduro',        icon: '🏔️', desc: 'Technical, aggressive' },
  { value: 'cross_country', label: 'XC',            icon: '⚡', desc: 'Efficient, climb-focused' },
]

const MOTOR_OPTIONS: { value: NonNullable<BikeRentalParticipant['motorPreference']>; label: string }[] = [
  { value: 'mid_drive',    label: 'Mid-drive (better climbing)' },
  { value: 'hub_drive',    label: 'Hub-drive (smoother assist)' },
  { value: 'no_preference', label: 'No preference' },
]

function Toggle({
  checked, onChange, label, sub,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={['w-11 h-6 rounded-full transition-colors relative', checked ? 'bg-amber-500' : 'bg-gray-200'].join(' ')}
        role="switch" aria-checked={checked}
      >
        <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </button>
    </div>
  )
}

function ParticipantForm({ index, participant, error }: {
  index: number
  participant: BikeRentalParticipant
  error: Record<string, string> | null
}) {
  const { updateParticipant } = useBikeRentalStore()
  const [open, setOpen] = useState(index === 0)

  function field<K extends keyof BikeRentalParticipant>(key: K) {
    return (val: BikeRentalParticipant[K]) => updateParticipant(index, { [key]: val } as Partial<BikeRentalParticipant>)
  }

  const complete = participant.firstName && participant.lastName && participant.age &&
    participant.heightCm && participant.weightKg && participant.ridingStyle

  function numInput(key: keyof BikeRentalParticipant, label: string, min: number, max: number, unit: string) {
    const val = participant[key] as number | null
    const err = error?.[key as string]
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label} <span className="text-gray-400">({unit})</span></label>
        <input
          type="number" min={min} max={max} value={val ?? ''}
          onChange={(e) => field(key)(e.target.value === '' ? null : Number(e.target.value) as any)}
          className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500', err ? 'border-red-400' : 'border-gray-300'].join(' ')}
        />
        {err && <p className="text-xs text-red-600 mt-0.5">{err}</p>}
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
          <span className="text-sm font-medium text-gray-800">
            {participant.firstName && participant.lastName ? `${participant.firstName} ${participant.lastName}` : `Participant ${index + 1}`}
          </span>
          {complete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
              <input type="text" value={participant.firstName}
                onChange={(e) => field('firstName')(e.target.value)} placeholder="Jan"
                className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500', error?.firstName ? 'border-red-400' : 'border-gray-300'].join(' ')} />
              {error?.firstName && <p className="text-xs text-red-600 mt-0.5">{error.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
              <input type="text" value={participant.lastName}
                onChange={(e) => field('lastName')(e.target.value)} placeholder="Novák"
                className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500', error?.lastName ? 'border-red-400' : 'border-gray-300'].join(' ')} />
              {error?.lastName && <p className="text-xs text-red-600 mt-0.5">{error.lastName}</p>}
            </div>
          </div>

          {/* Age + measurements */}
          <div className="grid grid-cols-3 gap-3">
            {numInput('age', 'Age', 6, 99, 'yrs')}
            {numInput('heightCm', 'Height', 100, 220, 'cm')}
            {numInput('weightKg', 'Weight', 15, 250, 'kg')}
          </div>

          {/* Riding style */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Riding style</label>
            <div className="grid grid-cols-2 gap-2">
              {RIDING_STYLES.map((opt) => (
                <button
                  key={opt.value} type="button"
                  onClick={() => field('ridingStyle')(opt.value)}
                  className={[
                    'flex items-center gap-2 py-2.5 px-3 rounded-xl border text-sm font-medium transition-all',
                    participant.ridingStyle === opt.value
                      ? 'border-amber-500 bg-amber-50 text-amber-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <div className="text-left">
                    <p className="text-xs font-semibold">{opt.label}</p>
                    <p className="text-[10px] text-gray-400">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            {error?.ridingStyle && <p className="text-xs text-red-600 mt-1">{error.ridingStyle}</p>}
          </div>

          {/* E-bike toggle */}
          <Toggle
            checked={participant.ebike}
            onChange={field('ebike')}
            label="E-Bike"
            sub="Pedal-assist motor (+€10/day)"
          />

          {participant.ebike && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-2">Motor preference</label>
              <div className="space-y-1.5">
                {MOTOR_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio" name={`motor-${index}`} value={opt.value}
                      checked={participant.motorPreference === opt.value}
                      onChange={() => field('motorPreference')(opt.value)}
                      className="accent-amber-500"
                    />
                    <span className="text-xs text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Accessories */}
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-gray-600">Accessories</p>
            <Toggle checked={participant.helmet} onChange={field('helmet')} label="Helmet" sub="Strongly recommended" />
            <Toggle checked={participant.gloves} onChange={field('gloves')} label="Gloves" />
            <Toggle checked={participant.bodyProtection} onChange={field('bodyProtection')} label="Body protection (pads)" sub="Back + elbows + knees" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Season guard ─────────────────────────────────────────────────────────────

function SummerOnly() {
  const navigate = useNavigate()
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-8 gap-4">
      <span className="text-5xl">❄️</span>
      <h2 className="text-xl font-bold text-gray-900">Come back in summer!</h2>
      <p className="text-sm text-gray-500 max-w-xs">
        Bike rentals are only available during the summer season. Switch season in the header to browse summer services.
      </p>
      <Button onClick={() => navigate('/')}>Back to home</Button>
    </div>
  )
}

// ─── Step 1: Dates ────────────────────────────────────────────────────────────

function Step1() {
  const { service } = useContext(BookingCtx)
  const { pickupDate, returnDate, setDates, setStep } = useBikeRentalStore()
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())

  useEffect(() => {
    if (!service) return
    setLoadingDates(true)
    getAvailableSlots(service.id, { from: startOfMonth(viewMonth), to: addDays(endOfMonth(viewMonth), 31) })
      .then((slots) => setAvailableDates(new Set(slots.map((s) => s.date))))
      .catch(console.error)
      .finally(() => setLoadingDates(false))
  }, [service, viewMonth])

  function handleNext() {
    const result = DateRangeSchema.safeParse({ pickup: pickupDate ?? '', ret: returnDate ?? '' })
    if (!result.success) { toast.error(result.error.errors[0]?.message ?? 'Please select dates'); return }
    setStep(2)
  }

  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : null

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Select rental dates</h2>
      <p className="text-sm text-gray-500 mb-6">Pick-up and return at the resort. Max 14 days.</p>

      <DateRangePicker
        pickupDate={pickupDate} returnDate={returnDate}
        availableDates={availableDates} loading={loadingDates}
        onChange={(pickup, ret) => { setDates(pickup, ret); setViewMonth(new Date(pickup || new Date())) }}
      />

      {pickupDate && returnDate && (
        <div className="mt-5 flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
          <CalendarDays className="w-5 h-5 text-amber-500 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-amber-800">
              {format(parseISO(pickupDate), 'd MMM')} → {format(parseISO(returnDate), 'd MMM yyyy')}
            </span>
            <span className="text-amber-600 ml-2">({days} day{days !== 1 ? 's' : ''})</span>
          </div>
          <button onClick={() => setDates('', '')} className="ml-auto text-amber-400 hover:text-amber-600" aria-label="Clear dates">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="mt-8">
        <Button size="lg" className="w-full !bg-amber-500 hover:!bg-amber-600" onClick={handleNext} disabled={!pickupDate || !returnDate}>
          Continue
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Participants ─────────────────────────────────────────────────────

function Step2() {
  const { participantCount, participants, setParticipantCount, setStep } = useBikeRentalStore()
  const [errors, setErrors] = useState<(Record<string, string> | null)[]>([])

  function handleNext() {
    const errs = participants.map((p) => {
      const result = ParticipantSchema.safeParse({
        ...p,
        age: p.age ?? undefined,
        heightCm: p.heightCm ?? undefined,
        weightKg: p.weightKg ?? undefined,
        ridingStyle: p.ridingStyle ?? undefined,
      })
      if (result.success) return null
      const map: Record<string, string> = {}
      result.error.errors.forEach((e) => { const k = e.path[0] as string; if (!map[k]) map[k] = e.message })
      return map
    })
    setErrors(errs)
    if (errs.some(Boolean)) { toast.error('Please fill in all participant details'); return }
    setStep(3)
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Participants</h2>
      <p className="text-sm text-gray-500 mb-6">Tell us about everyone who needs a bike.</p>

      <div className="flex items-center gap-4 mb-6 bg-gray-50 rounded-xl p-4">
        <Users className="w-5 h-5 text-gray-500 shrink-0" />
        <span className="text-sm font-medium text-gray-700 flex-1">How many riders?</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setParticipantCount(Math.max(1, participantCount - 1))} disabled={participantCount <= 1}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40">−</button>
          <span className="text-lg font-bold text-gray-900 w-6 text-center">{participantCount}</span>
          <button onClick={() => setParticipantCount(Math.min(8, participantCount + 1))} disabled={participantCount >= 8}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40">+</button>
        </div>
      </div>

      <div className="space-y-3">
        {participants.map((p, i) => (
          <ParticipantForm key={i} index={i} participant={p} error={errors[i] ?? null} />
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-amber-500 hover:!bg-amber-600" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 3: Bike recommendation ──────────────────────────────────────────────

function Step3() {
  const { participants, updateParticipant, setStep } = useBikeRentalStore()

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Bike recommendations</h2>
      <p className="text-sm text-gray-500 mb-6">
        Based on height, weight and riding style. Override anytime.
      </p>

      <div className="space-y-6">
        {participants.map((p, i) => {
          if (!p.heightCm || !p.weightKg || !p.ridingStyle) return null

          const computed = recommendBike({
            heightCm: p.heightCm,
            weightKg: p.weightKg,
            ridingStyle: p.ridingStyle,
            ebike: p.ebike,
          })
          const activeTier = (p.recoTierOverride as BikeTier | null) ?? computed.tier
          const reco = activeTier === computed.tier
            ? computed
            : { ...computed, tier: activeTier, label: BIKE_TIER_LABELS[activeTier], reason: 'Custom override' }
          const colors = BIKE_TIER_COLORS[activeTier]
          const styleKey = p.ebike ? `${p.ridingStyle}_ebike` : p.ridingStyle
          const alternatives = (BIKE_TIERS_BY_STYLE[styleKey] ?? BIKE_TIERS_BY_STYLE[p.ridingStyle] ?? []).filter((t) => t !== activeTier)
          const frameSize = bikeFrameSize(p.heightCm)

          return (
            <div key={i} className={['rounded-2xl border p-5', colors.bg, colors.border].join(' ')}>
              <div className="flex items-center gap-2 mb-3">
                <span className={['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white', colors.dot].join(' ')}>{i + 1}</span>
                <span className="font-semibold text-gray-900 text-sm">{p.firstName} {p.lastName}</span>
                <span className="ml-auto text-xs text-gray-400">Frame {frameSize} · {p.heightCm} cm</span>
              </div>

              <div className="bg-white rounded-xl p-4 mb-3 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className={['font-bold text-base', colors.text].join(' ')}>{reco.label}</p>
                    <p className="text-xs text-gray-500 italic">{reco.tagline}</p>
                  </div>
                  {p.ebike && <span className="flex items-center gap-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full"><Zap className="w-3 h-3" />E-Bike</span>}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">{reco.description}</p>
                <ul className="space-y-1">
                  {reco.specs.map((spec, si) => (
                    <li key={si} className="flex items-center gap-2 text-xs text-gray-700">
                      <Check className="w-3 h-3 text-green-500 shrink-0" />{spec}
                    </li>
                  ))}
                </ul>
                {p.bodyProtection && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-violet-700">
                    <Shield className="w-3 h-3" /> Body protection included
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-3 italic">{reco.reason}</p>
              </div>

              {alternatives.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Override to:</p>
                  <div className="flex gap-2 flex-wrap">
                    {alternatives.map((tier) => {
                      const tc = BIKE_TIER_COLORS[tier]
                      return (
                        <button key={tier}
                          onClick={() => updateParticipant(i, { recoTierOverride: tier === computed.tier ? null : tier })}
                          className={['text-xs px-3 py-1.5 rounded-lg border font-medium transition-all', activeTier === tier ? `${tc.bg} ${tc.text} ${tc.border}` : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'].join(' ')}
                        >
                          {BIKE_TIER_LABELS[tier]}
                        </button>
                      )
                    })}
                    {p.recoTierOverride && (
                      <button onClick={() => updateParticipant(i, { recoTierOverride: null })}
                        className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50">
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(2)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-amber-500 hover:!bg-amber-600" onClick={() => setStep(4)}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function Step4() {
  const { service, operator, resort } = useContext(BookingCtx)
  const { pickupDate, returnDate, participants, termsAccepted, setTermsAccepted, setStep } = useBikeRentalStore()

  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : 0
  const pricePerPersonPerDay = service?.price_per_person ?? 0
  const ebikeCount = participants.filter((p) => p.ebike).length
  const ebikeExtra = ebikeCount * 10 * days
  const subtotal = pricePerPersonPerDay * days * participants.length + ebikeExtra
  const currency = service?.currency ?? 'EUR'

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Review your booking</h2>
      <p className="text-sm text-gray-500 mb-6">Check everything before payment.</p>

      <div className="bg-gray-50 rounded-2xl p-4 mb-5 text-sm space-y-1">
        {[
          ['Operator', operator?.name],
          ['Resort', resort?.name],
          ['Pick-up', pickupDate ? format(parseISO(pickupDate), 'd MMM yyyy') : '—'],
          ['Return', returnDate ? format(parseISO(returnDate), 'd MMM yyyy') : '—'],
          ['Duration', `${days} day${days !== 1 ? 's' : ''}`],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between">
            <span className="text-gray-500">{k}</span>
            <span className="font-medium text-gray-900">{v ?? '—'}</span>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-gray-700 mb-3">Bikes per rider</h3>
      <div className="space-y-2 mb-5">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm">
            <div>
              <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
              <span className="text-gray-400 mx-2">·</span>
              <span className="text-gray-600 capitalize">{p.ridingStyle?.replace('_', '-') ?? '—'}</span>
              {p.ebike && <span className="ml-1.5 text-xs font-semibold text-amber-600">⚡ E-bike</span>}
            </div>
            <div className="text-xs text-gray-400 text-right">
              {[p.helmet && 'helmet', p.gloves && 'gloves', p.bodyProtection && 'pads'].filter(Boolean).join(' + ') || 'no extras'}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pricing</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Bike rental rate</span><span>€{pricePerPersonPerDay.toFixed(0)} / person / day</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>{participants.length} rider{participants.length > 1 ? 's' : ''} × {days} day{days > 1 ? 's' : ''}</span>
            <span>€{(pricePerPersonPerDay * days * participants.length).toFixed(2)}</span>
          </div>
          {ebikeCount > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>E-bike surcharge ({ebikeCount} × {days} day{days > 1 ? 's' : ''} × €10)</span>
              <span>€{ebikeExtra.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-bold text-base">
          <span>Total</span><span>{currency} {subtotal.toFixed(2)}</span>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer mb-8">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-amber-500" />
        <span className="text-xs text-gray-600 leading-relaxed">
          I agree to the rental terms. Equipment must be returned in the same condition. The operator may charge for damage or late returns.
        </span>
      </label>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(3)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-amber-500 hover:!bg-amber-600" onClick={() => {
          if (!termsAccepted) { toast.error('Please accept the rental terms'); return }
          setStep(5)
        }}>
          Continue to Payment
        </Button>
      </div>
    </div>
  )
}

// ─── Step 5: Payment ──────────────────────────────────────────────────────────

function CardPaymentForm() {
  const { service, operatorId, resortId } = useContext(BookingCtx)
  const { pickupDate, returnDate, participants, setStep, setConfirmedBookingId } = useBikeRentalStore()
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : 0
  const ebikeExtra = participants.filter((p) => p.ebike).length * 10 * days
  const total = (service?.price_per_person ?? 0) * days * participants.length + ebikeExtra

  async function handleConfirm() {
    if (!stripe || !elements || !service || !user) return
    setSubmitting(true)
    try {
      const slots = await getAvailableSlots(service.id, { from: parseISO(pickupDate!), to: parseISO(pickupDate!) })
      if (slots.length === 0) {
        toast.error('No availability for the selected pick-up date. Please choose different dates.')
        setSubmitting(false)
        return
      }

      const booking = await createBooking({
        customer_id: user.id,
        operator_id: operatorId,
        resort_id: resortId,
        service_id: service.id,
        availability_slot_id: slots[0].id,
        type: 'rental_only',
        total_price: total,
        currency: service.currency,
        stripe_payment_intent_id: null,
        participants: participants.map((p) => ({
          first_name: p.firstName,
          last_name: p.lastName,
          age: p.age,
          school_data: null,
          rental_data: {
            equipment_type: 'bike' as const,
            height_cm: p.heightCm!,
            weight_kg: p.weightKg!,
            boot_size: 0,
            helmet_size: p.helmet ? 'M' : '',
            preferred_brand: [
              p.ridingStyle ?? '',
              p.ebike ? 'ebike' : '',
              p.motorPreference ?? '',
              p.gloves ? 'gloves' : '',
              p.bodyProtection ? 'pads' : '',
            ].filter(Boolean).join(','),
          },
        })),
      })

      setConfirmedBookingId(booking.id)
      setStep(6)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Booking failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
        <strong>Demo mode:</strong> No charge is made. A backend PaymentIntent endpoint is required for live payments.
      </div>
      <div className="border border-gray-200 rounded-xl p-4 mb-5">
        <CardElement options={{ style: { base: { fontSize: '16px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } } } }} />
      </div>
      <div className="flex justify-between text-sm font-bold text-gray-900 mb-5">
        <span>Total to pay</span>
        <span>{service?.currency ?? 'EUR'} {total.toFixed(2)}</span>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => useBikeRentalStore.getState().setStep(4)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-amber-500 hover:!bg-amber-600" isLoading={submitting} onClick={handleConfirm}>
          Confirm Booking
        </Button>
      </div>
    </div>
  )
}

function Step5() {
  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Payment</h2>
      <p className="text-sm text-gray-500 mb-6">Your card details are secured by Stripe.</p>
      <Elements stripe={stripePromise}><CardPaymentForm /></Elements>
    </div>
  )
}

// ─── Step 6: Confirmation ─────────────────────────────────────────────────────

function Step6() {
  const { resort, operator } = useContext(BookingCtx)
  const { confirmedBookingId, pickupDate, returnDate, participants, reset } = useBikeRentalStore()
  const navigate = useNavigate()

  if (!confirmedBookingId) return null
  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : 0

  return (
    <div className="max-w-screen-md mx-auto px-4 py-10 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-9 h-9 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">You're all set! 🚵</h2>
      <p className="text-sm text-gray-500 mb-6">
        Bike rental confirmed at <strong>{operator?.name}</strong>, {resort?.name}.
      </p>

      <div className="bg-gray-50 rounded-xl px-4 py-2 inline-block mb-6">
        <p className="text-xs text-gray-400 mb-0.5">Booking reference</p>
        <p className="font-mono text-sm font-bold text-gray-800">{confirmedBookingId.toUpperCase().slice(0, 8)}</p>
      </div>

      <div className="flex flex-col items-center gap-1 mb-8">
        <QRDisplay bookingId={confirmedBookingId} />
        <p className="text-xs text-gray-400 mt-1">Show this at the bike rental desk on pick-up day</p>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 text-sm text-left">
        <div className="flex justify-between mb-1">
          <span className="text-gray-500">Pick-up</span>
          <span className="font-semibold text-gray-900">{pickupDate ? format(parseISO(pickupDate), 'd MMMM yyyy') : '—'}</span>
        </div>
        <div className="flex justify-between mb-1">
          <span className="text-gray-500">Return</span>
          <span className="font-semibold text-gray-900">{returnDate ? format(parseISO(returnDate), 'd MMMM yyyy') : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Duration</span>
          <span className="font-semibold text-gray-900">{days} day{days !== 1 ? 's' : ''} · {participants.length} rider{participants.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      <div className="space-y-2 mb-8 text-left">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
            <span className="text-gray-400 text-xs ml-auto capitalize">
              {p.ridingStyle?.replace('_', '-')} {p.ebike ? '⚡' : '🚵'}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <Link to="/my-trips" className="text-amber-600 hover:text-amber-700 font-medium text-sm">View in My Trips →</Link>
        <button onClick={() => { reset(); navigate('/') }} className="text-gray-400 hover:text-gray-600 text-sm">Back to home</button>
      </div>
    </div>
  )
}

// ─── Main coordinator ─────────────────────────────────────────────────────────

export default function BikeRentalBooking() {
  const { operatorId, resortId } = useParams<{ operatorId: string; resortId: string }>()
  const navigate = useNavigate()
  const { season } = useSeasonStore()
  const step = useBikeRentalStore((s) => s.step)

  const [service, setService] = useState<Service | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [resort, setResort] = useState<Resort | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!operatorId || !resortId) return
    setLoading(true)
    Promise.all([getServicesByOperator(operatorId, resortId), getOperatorById(operatorId), getResortById(resortId)])
      .then(([services, op, res]) => {
        const svc = services.find((s) => s.type === 'bike_rental')
        if (!svc) { setError('No bike rental service found for this operator.'); return }
        setService(svc); setOperator(op); setResort(res)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [operatorId, resortId])

  if (season !== 'summer') return <SummerOnly />

  if (loading) {
    return (
      <div className="pt-16 max-w-screen-md mx-auto px-4 py-8 space-y-4">
        <Skeleton width="w-48" height="h-7" />
        <Skeleton height="h-4" /><Skeleton height="h-4" width="w-3/4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="pt-16 max-w-screen-md mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-red-700 font-medium mb-4">{error}</p>
          <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Go back</Button>
        </div>
      </div>
    )
  }

  return (
    <BookingCtx.Provider value={{ operatorId: operatorId!, resortId: resortId!, service, operator, resort }}>
      <div className="min-h-screen pb-8">
        <ProgressBar step={step} />
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
        {step === 5 && <Step5 />}
        {step === 6 && <Step6 />}
      </div>
    </BookingCtx.Provider>
  )
}
