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
  ChevronLeft, ChevronRight, Mountain, Snowflake, ChevronDown, ChevronUp,
  Check, CheckCircle2, Users, CalendarDays, ArrowLeft, RotateCcw,
} from 'lucide-react'
import { z } from 'zod'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

import { useSkiRentalStore } from '../../store/skiRentalStore'
import type { RentalParticipant } from '../../store/skiRentalStore'
import { recommendEquipment, TIER_COLORS, TIERS_BY_EQUIPMENT, TIER_LABELS } from '../../utils/equipment'
import type { RecoTier } from '../../utils/equipment'
import { getServicesByOperator } from '../../lib/supabase/services'
import { getAvailableSlots } from '../../lib/supabase/availability'
import { createBooking } from '../../lib/supabase/bookings'
import type { Service, Operator, Resort } from '../../types'
import { getOperatorById } from '../../lib/supabase/operators'
import { getResortById } from '../../lib/supabase/resorts'
import { useAuth } from '../../hooks/useAuth'
import SkillLevelPicker from '../../components/ui/SkillLevelPicker'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'

// ─── Stripe ───────────────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder')

// ─── Booking context ─────────────────────────────────────────────────────────

interface BookingCtxValue {
  operatorId: string
  resortId: string
  service: Service | null
  operator: Operator | null
  resort: Resort | null
}

const BookingCtx = createContext<BookingCtxValue>({
  operatorId: '',
  resortId: '',
  service: null,
  operator: null,
  resort: null,
})

// ─── Zod step schemas ────────────────────────────────────────────────────────

const DateRangeSchema = z
  .object({
    pickup: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    ret: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((d) => d.ret > d.pickup, { message: 'Return date must be after pick-up date', path: ['ret'] })
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
    age: z.number({ invalid_type_error: 'Required' }).int().min(3, 'Min age 3').max(99),
    skillLevel: z.number({ invalid_type_error: 'Required' }).int().min(1).max(5),
    equipmentType: z.enum(['skis', 'snowboard', 'telemark']),
    heightCm: z.number({ invalid_type_error: 'Required' }).int().min(80, 'Min 80 cm').max(220),
    weightKg: z.number({ invalid_type_error: 'Required' }).min(10).max(250),
    shoeSizeEU: z.number({ invalid_type_error: 'Required' }).min(20).max(55),
    helmet: z.boolean(),
    helmetCircumferenceCm: z.number().min(48).max(70).nullable(),
    poles: z.boolean(),
  })
  .refine((d) => !d.helmet || d.helmetCircumferenceCm != null, {
    message: 'Required when helmet is selected',
    path: ['helmetCircumferenceCm'],
  })

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEPS = ['Dates', 'Participants', 'Equipment', 'Review', 'Payment', 'Done']

function ProgressBar({ step }: { step: number }) {
  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-16 z-20">
      <div className="max-w-screen-md mx-auto">
        <div className="flex items-center gap-1">
          {STEPS.map((label, i) => {
            const n = i + 1
            const done = n < step
            const active = n === step
            return (
              <div key={n} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <div
                    className={[
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                      done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
                    ].join(' ')}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : n}
                  </div>
                  <span className={['text-[9px] font-medium hidden sm:block', active ? 'text-blue-600' : 'text-gray-400'].join(' ')}>
                    {label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={['h-0.5 flex-1 rounded-full transition-colors', done ? 'bg-blue-600' : 'bg-gray-200'].join(' ')} />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Date Range Picker ────────────────────────────────────────────────────────

function DateRangePicker({
  pickupDate, returnDate, availableDates, loading,
  onChange,
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

    if (selecting === 'start') {
      onChange(dateStr, '')
      setSelecting('end')
      return
    }

    if (!pickupDate || dateStr <= pickupDate) {
      onChange(dateStr, '')
      setSelecting('end')
      return
    }

    const days = differenceInDays(parseISO(dateStr), parseISO(pickupDate))
    if (days > 14) {
      toast.error('Maximum rental period is 14 days.')
      return
    }

    onChange(pickupDate, dateStr)
    setSelecting('start')
  }

  function dayClasses(dateStr: string): string {
    const past = dateStr < todayStr
    const isStart = dateStr === pickupDate
    const isEnd = dateStr === returnDate

    const inConfirmed =
      pickupDate && returnDate && dateStr > pickupDate && dateStr < returnDate
    const inPreview =
      pickupDate && !returnDate && hoverDate &&
      selecting === 'end' && dateStr > pickupDate && dateStr < hoverDate

    const tooFar =
      pickupDate && selecting === 'end' &&
      differenceInDays(parseISO(dateStr), parseISO(pickupDate)) > 14

    if (past || tooFar)
      return 'text-gray-300 cursor-not-allowed'
    if (isStart)
      return 'bg-blue-600 text-white rounded-l-full font-bold cursor-pointer'
    if (isEnd)
      return 'bg-blue-600 text-white rounded-r-full font-bold cursor-pointer'
    if (inConfirmed)
      return 'bg-blue-100 text-blue-700 cursor-pointer'
    if (inPreview)
      return 'bg-blue-50 text-blue-600 cursor-pointer'
    if (isToday(parseISO(dateStr)))
      return 'ring-1 ring-blue-400 text-blue-700 rounded-full cursor-pointer'
    return 'text-gray-700 hover:bg-gray-100 rounded-full cursor-pointer'
  }

  return (
    <div className="max-w-sm">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setDisplayMonth((m) => subMonths(m, 1))}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{format(displayMonth, 'MMMM yyyy')}</span>
        <button
          onClick={() => setDisplayMonth((m) => addMonths(m, 1))}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</span>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7">
        {Array.from({ length: startPad }).map((_, i) => <span key={`p${i}`} />)}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const avail = availableDates.has(dateStr)
          const past = dateStr < todayStr

          return (
            <div
              key={dateStr}
              className={['flex flex-col items-center py-1 select-none transition-colors', dayClasses(dateStr)].join(' ')}
              onClick={() => handleDayClick(dateStr)}
              onMouseEnter={() => setHoverDate(dateStr)}
              onMouseLeave={() => setHoverDate(null)}
              role="button"
              tabIndex={past ? -1 : 0}
              onKeyDown={(e) => e.key === 'Enter' && handleDayClick(dateStr)}
            >
              <span className="text-xs leading-5">{format(day, 'd')}</span>
              {loading ? (
                <span className="w-1 h-1 rounded-full bg-gray-200 animate-pulse" />
              ) : (
                <span className={['w-1 h-1 rounded-full', past ? 'bg-transparent' : avail ? 'bg-green-500' : 'bg-gray-200'].join(' ')} />
              )}
            </div>
          )
        })}
      </div>

      {/* Hint */}
      <p className="text-xs text-gray-400 mt-3 text-center">
        {selecting === 'start'
          ? 'Click a date to set pick-up'
          : pickupDate
            ? `Pick-up: ${format(parseISO(pickupDate), 'd MMM')} — now click return date`
            : ''}
      </p>

      {/* Legend */}
      <div className="flex gap-4 mt-3 justify-center text-xs text-gray-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200" /> Unknown</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded bg-blue-600 inline-block" /> Selected</span>
      </div>
    </div>
  )
}

// ─── QR display ───────────────────────────────────────────────────────────────

function QRDisplay({ bookingId }: { bookingId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, bookingId, { width: 200, margin: 2 })
  }, [bookingId])

  return (
    <>
      <button
        onClick={() => setExpanded(true)}
        className="inline-block rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Tap to expand QR code"
      >
        <canvas ref={canvasRef} className="block" />
      </button>
      <p className="text-xs text-gray-400 mt-1">Tap to expand</p>

      {/* Full-screen lightbox */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4"
          onClick={() => setExpanded(false)}
        >
          <QRDisplayLarge bookingId={bookingId} />
          <p className="text-white/60 text-sm">Tap anywhere to close</p>
        </div>
      )}
    </>
  )
}

function QRDisplayLarge({ bookingId }: { bookingId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, bookingId, { width: 280, margin: 3 })
  }, [bookingId])
  return <canvas ref={canvasRef} className="rounded-2xl" onClick={(e) => e.stopPropagation()} />
}

// ─── Participant form ─────────────────────────────────────────────────────────

const EQUIP_OPTIONS: { value: RentalParticipant['equipmentType']; label: string; icon: string }[] = [
  { value: 'skis',      label: 'Skis',      icon: '⛷' },
  { value: 'snowboard', label: 'Snowboard', icon: '🏂' },
  { value: 'telemark',  label: 'Telemark',  icon: '🎿' },
]

function ParticipantForm({
  index,
  participant,
  error,
}: {
  index: number
  participant: RentalParticipant
  error: Record<string, string> | null
}) {
  const { updateParticipant } = useSkiRentalStore()
  const [open, setOpen] = useState(index === 0)

  function field(key: keyof RentalParticipant) {
    return (val: unknown) => updateParticipant(index, { [key]: val } as Partial<RentalParticipant>)
  }

  const complete =
    participant.firstName && participant.lastName && participant.age &&
    participant.skillLevel && participant.equipmentType &&
    participant.heightCm && participant.weightKg && participant.shoeSizeEU

  function numInput(
    key: keyof RentalParticipant,
    label: string,
    min: number,
    max: number,
    unit: string,
    errKey?: string,
  ) {
    const val = participant[key] as number | null
    const err = error?.[errKey ?? key]
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">
          {label} <span className="text-gray-400">({unit})</span>
        </label>
        <input
          type="number"
          min={min}
          max={max}
          value={val ?? ''}
          onChange={(e) => field(key)(e.target.value === '' ? null : Number(e.target.value))}
          className={[
            'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors',
            err ? 'border-red-400' : 'border-gray-300',
          ].join(' ')}
        />
        {err && <p className="text-xs text-red-600 mt-0.5">{err}</p>}
      </div>
    )
  }

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-800">
            {participant.firstName && participant.lastName
              ? `${participant.firstName} ${participant.lastName}`
              : `Participant ${index + 1}`}
          </span>
          {complete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
              <input
                type="text"
                value={participant.firstName}
                onChange={(e) => field('firstName')(e.target.value)}
                placeholder="Jan"
                className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.firstName ? 'border-red-400' : 'border-gray-300'].join(' ')}
              />
              {error?.firstName && <p className="text-xs text-red-600 mt-0.5">{error.firstName}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
              <input
                type="text"
                value={participant.lastName}
                onChange={(e) => field('lastName')(e.target.value)}
                placeholder="Novák"
                className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.lastName ? 'border-red-400' : 'border-gray-300'].join(' ')}
              />
              {error?.lastName && <p className="text-xs text-red-600 mt-0.5">{error.lastName}</p>}
            </div>
          </div>

          {/* Age + skill */}
          <div className="grid grid-cols-2 gap-3">
            {numInput('age', 'Age', 3, 99, 'years', 'age')}
          </div>

          {/* Skill level */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Skill level</label>
            <SkillLevelPicker value={participant.skillLevel} onChange={field('skillLevel')} />
            {error?.skillLevel && <p className="text-xs text-red-600 mt-1">{error.skillLevel}</p>}
          </div>

          {/* Equipment type */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Equipment</label>
            <div className="grid grid-cols-3 gap-2">
              {EQUIP_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    field('equipmentType')(opt.value)
                    if (opt.value === 'snowboard') field('poles')(false)
                    else field('poles')(true)
                  }}
                  className={[
                    'flex flex-col items-center gap-1 py-3 rounded-xl border text-xs font-medium transition-all',
                    participant.equipmentType === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  <span className="text-xl">{opt.icon}</span>
                  {opt.label}
                </button>
              ))}
            </div>
            {error?.equipmentType && <p className="text-xs text-red-600 mt-1">{error.equipmentType}</p>}
          </div>

          {/* Measurements */}
          <div className="grid grid-cols-3 gap-3">
            {numInput('heightCm', 'Height', 80, 220, 'cm', 'heightCm')}
            {numInput('weightKg', 'Weight', 10, 250, 'kg', 'weightKg')}
            {numInput('shoeSizeEU', 'Shoe size', 20, 55, 'EU', 'shoeSizeEU')}
          </div>

          {/* Helmet toggle */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Helmet rental</span>
              <button
                type="button"
                onClick={() => field('helmet')(!participant.helmet)}
                className={[
                  'w-11 h-6 rounded-full transition-colors relative',
                  participant.helmet ? 'bg-blue-600' : 'bg-gray-200',
                ].join(' ')}
                role="switch"
                aria-checked={participant.helmet}
              >
                <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', participant.helmet ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
              </button>
            </div>
            {participant.helmet && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Head circumference (cm)</label>
                <input
                  type="number"
                  min={48}
                  max={70}
                  value={participant.helmetCircumferenceCm ?? ''}
                  onChange={(e) => field('helmetCircumferenceCm')(e.target.value === '' ? null : Number(e.target.value))}
                  placeholder="e.g. 56"
                  className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.helmetCircumferenceCm ? 'border-red-400' : 'border-gray-300'].join(' ')}
                />
                {error?.helmetCircumferenceCm && <p className="text-xs text-red-600 mt-0.5">{error.helmetCircumferenceCm}</p>}
              </div>
            )}
          </div>

          {/* Poles toggle (auto-set, but user can override) */}
          {participant.equipmentType !== 'snowboard' && (
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-medium text-gray-600">Poles</span>
                <p className="text-[10px] text-gray-400">Recommended for skiing</p>
              </div>
              <button
                type="button"
                onClick={() => field('poles')(!participant.poles)}
                className={['w-11 h-6 rounded-full transition-colors relative', participant.poles ? 'bg-blue-600' : 'bg-gray-200'].join(' ')}
                role="switch"
                aria-checked={participant.poles}
              >
                <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', participant.poles ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 1: Date range ───────────────────────────────────────────────────────

function Step1() {
  const { service } = useContext(BookingCtx)
  const { pickupDate, returnDate, setDates, setStep } = useSkiRentalStore()
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState(false)
  const [viewMonth, setViewMonth] = useState(new Date())

  useEffect(() => {
    if (!service) return
    setLoadingDates(true)
    getAvailableSlots(service.id, {
      from: startOfMonth(viewMonth),
      to: addDays(endOfMonth(viewMonth), 31),
    })
      .then((slots) => {
        const set = new Set(slots.map((s) => s.date))
        setAvailableDates(set)
      })
      .catch(console.error)
      .finally(() => setLoadingDates(false))
  }, [service, viewMonth])

  function handleNext() {
    const result = DateRangeSchema.safeParse({ pickup: pickupDate ?? '', ret: returnDate ?? '' })
    if (!result.success) {
      toast.error(result.error.errors[0]?.message ?? 'Please select dates')
      return
    }
    setStep(2)
  }

  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : null

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Select rental dates</h2>
      <p className="text-sm text-gray-500 mb-6">Pick-up and return at the resort. Max 14 days.</p>

      <DateRangePicker
        pickupDate={pickupDate}
        returnDate={returnDate}
        availableDates={availableDates}
        loading={loadingDates}
        onChange={(pickup, ret) => {
          setDates(pickup, ret)
          const newDate = new Date(pickup || new Date())
          setViewMonth(newDate)
        }}
      />

      {/* Summary pill */}
      {pickupDate && returnDate && (
        <div className="mt-5 flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
          <CalendarDays className="w-5 h-5 text-blue-500 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-blue-800">
              {format(parseISO(pickupDate), 'd MMM')} → {format(parseISO(returnDate), 'd MMM yyyy')}
            </span>
            <span className="text-blue-600 ml-2">({days} day{days !== 1 ? 's' : ''})</span>
          </div>
          <button
            onClick={() => setDates('', '')}
            className="ml-auto text-blue-400 hover:text-blue-600 transition-colors"
            aria-label="Clear dates"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="mt-8">
        <Button size="lg" className="w-full" onClick={handleNext} disabled={!pickupDate || !returnDate}>
          Continue
        </Button>
      </div>
    </div>
  )
}

// ─── Step 2: Participants ─────────────────────────────────────────────────────

function Step2() {
  const { participantCount, participants, setParticipantCount, setStep } = useSkiRentalStore()
  const [errors, setErrors] = useState<(Record<string, string> | null)[]>([])

  function handleNext() {
    const errs: (Record<string, string> | null)[] = participants.map((p) => {
      const result = ParticipantSchema.safeParse({
        ...p,
        age: p.age ?? undefined,
        skillLevel: p.skillLevel ?? undefined,
        equipmentType: p.equipmentType ?? undefined,
        heightCm: p.heightCm ?? undefined,
        weightKg: p.weightKg ?? undefined,
        shoeSizeEU: p.shoeSizeEU ?? undefined,
      })
      if (result.success) return null
      const map: Record<string, string> = {}
      result.error.errors.forEach((e) => {
        const key = e.path[0] as string
        if (!map[key]) map[key] = e.message
      })
      return map
    })

    setErrors(errs)
    if (errs.some(Boolean)) {
      toast.error('Please fill in all participant details')
      return
    }
    setStep(3)
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Participants</h2>
      <p className="text-sm text-gray-500 mb-6">Tell us about everyone who needs equipment.</p>

      {/* Count selector */}
      <div className="flex items-center gap-4 mb-6 bg-gray-50 rounded-xl p-4">
        <Users className="w-5 h-5 text-gray-500 shrink-0" />
        <span className="text-sm font-medium text-gray-700 flex-1">How many people?</span>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setParticipantCount(Math.max(1, participantCount - 1))}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            disabled={participantCount <= 1}
          >
            −
          </button>
          <span className="text-lg font-bold text-gray-900 w-6 text-center">{participantCount}</span>
          <button
            onClick={() => setParticipantCount(Math.min(8, participantCount + 1))}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-40"
            disabled={participantCount >= 8}
          >
            +
          </button>
        </div>
      </div>

      {/* Participant forms */}
      <div className="space-y-3">
        {participants.map((p, i) => (
          <ParticipantForm key={i} index={i} participant={p} error={errors[i] ?? null} />
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
        <Button size="lg" className="flex-1" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 3: Equipment recommendation ────────────────────────────────────────

function Step3() {
  const { participants, updateParticipant, setStep } = useSkiRentalStore()

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Equipment recommendations</h2>
      <p className="text-sm text-gray-500 mb-6">
        Based on each person's measurements and skill level. You can override any recommendation.
      </p>

      <div className="space-y-6">
        {participants.map((p, i) => {
          if (!p.skillLevel || !p.heightCm || !p.weightKg || !p.shoeSizeEU || !p.equipmentType) return null

          const computed = recommendEquipment({
            skillLevel: p.skillLevel,
            heightCm: p.heightCm,
            weightKg: p.weightKg,
            shoeSizeEU: p.shoeSizeEU,
            equipmentType: p.equipmentType,
            helmet: p.helmet,
            helmetCircumferenceCm: p.helmetCircumferenceCm,
            poles: p.poles,
          })

          const activeTier = (p.recoTierOverride as RecoTier | null) ?? computed.tier
          const reco = activeTier === computed.tier
            ? computed
            : { ...computed, tier: activeTier, label: TIER_LABELS[activeTier], reason: 'Custom override' }

          const colors = TIER_COLORS[activeTier]
          const alternatives = TIERS_BY_EQUIPMENT[p.equipmentType].filter((t) => t !== activeTier)

          return (
            <div key={i} className={['rounded-2xl border p-5', colors.bg, colors.border].join(' ')}>
              {/* Participant header */}
              <div className="flex items-center gap-2 mb-3">
                <span className={['w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white', colors.dot].join(' ')}>
                  {i + 1}
                </span>
                <span className="font-semibold text-gray-900 text-sm">
                  {p.firstName} {p.lastName}
                </span>
                {p.recoTierOverride && (
                  <span className="ml-auto text-xs text-gray-400 italic">custom</span>
                )}
              </div>

              {/* Reco card */}
              <div className="bg-white rounded-xl p-4 mb-3 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className={['font-bold text-base', colors.text].join(' ')}>{reco.label}</p>
                    <p className="text-xs text-gray-500 italic">{reco.tagline}</p>
                  </div>
                  <span className={['text-[10px] font-semibold px-2 py-0.5 rounded-full border', colors.bg, colors.text, colors.border].join(' ')}>
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">{reco.description}</p>
                <ul className="space-y-1">
                  {reco.specs.map((spec, si) => (
                    <li key={si} className="flex items-center gap-2 text-xs text-gray-700">
                      <Check className="w-3 h-3 text-green-500 shrink-0" />
                      {spec}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-gray-400 mt-3 italic">{reco.reason}</p>
              </div>

              {/* Override options */}
              {alternatives.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">Override to:</p>
                  <div className="flex gap-2 flex-wrap">
                    {alternatives.map((tier) => {
                      const tc = TIER_COLORS[tier]
                      return (
                        <button
                          key={tier}
                          onClick={() =>
                            updateParticipant(i, {
                              recoTierOverride: tier === computed.tier ? null : tier,
                            })
                          }
                          className={[
                            'text-xs px-3 py-1.5 rounded-lg border font-medium transition-all',
                            activeTier === tier
                              ? `${tc.bg} ${tc.text} ${tc.border}`
                              : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                          ].join(' ')}
                        >
                          {TIER_LABELS[tier]}
                        </button>
                      )
                    })}
                    {p.recoTierOverride && (
                      <button
                        onClick={() => updateParticipant(i, { recoTierOverride: null })}
                        className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50"
                      >
                        Reset to recommended
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
        <Button size="lg" className="flex-1" onClick={() => setStep(4)}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 4: Review ───────────────────────────────────────────────────────────

function Step4() {
  const { service, operator, resort } = useContext(BookingCtx)
  const { pickupDate, returnDate, participants, termsAccepted, setTermsAccepted, setStep } = useSkiRentalStore()

  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : 0
  const pricePerPersonPerDay = service?.price_per_person ?? 0
  const subtotal = pricePerPersonPerDay * days * participants.length
  const currency = service?.currency ?? 'EUR'

  function handleNext() {
    if (!termsAccepted) {
      toast.error('Please accept the rental terms to continue')
      return
    }
    setStep(5)
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Review your booking</h2>
      <p className="text-sm text-gray-500 mb-6">Check everything before payment.</p>

      {/* Context summary */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-5 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-500">Operator</span>
          <span className="font-medium text-gray-900">{operator?.name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Resort</span>
          <span className="font-medium text-gray-900">{resort?.name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Pick-up</span>
          <span className="font-medium text-gray-900">{pickupDate ? format(parseISO(pickupDate), 'd MMM yyyy') : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Return</span>
          <span className="font-medium text-gray-900">{returnDate ? format(parseISO(returnDate), 'd MMM yyyy') : '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Duration</span>
          <span className="font-medium text-gray-900">{days} day{days !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Participants summary */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Equipment per person</h3>
      <div className="space-y-2 mb-5">
        {participants.map((p, i) => {
          const equipLabel = p.equipmentType
            ? { skis: '⛷ Skis', snowboard: '🏂 Snowboard', telemark: '🎿 Telemark' }[p.equipmentType]
            : '—'
          return (
            <div key={i} className="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
                <span className="text-gray-400 mx-2">·</span>
                <span className="text-gray-600">{equipLabel}</span>
                {p.helmet && <span className="text-gray-400 ml-2 text-xs">+ helmet</span>}
                {p.poles && p.equipmentType !== 'snowboard' && <span className="text-gray-400 ml-1 text-xs">+ poles</span>}
              </div>
              <span className="text-gray-500 text-xs">Skill {p.skillLevel}/5</span>
            </div>
          )
        })}
      </div>

      {/* Price breakdown */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pricing</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Rental rate</span>
            <span>€{pricePerPersonPerDay.toFixed(0)} / person / day</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>{participants.length} person{participants.length > 1 ? 's' : ''} × {days} day{days > 1 ? 's' : ''}</span>
            <span>€{subtotal.toFixed(2)}</span>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-bold text-base">
          <span>Total</span>
          <span>{currency} {subtotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer mb-8">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600"
        />
        <span className="text-xs text-gray-600 leading-relaxed">
          I agree to the rental terms and conditions. Equipment must be returned in the same condition.
          The operator reserves the right to charge for damage or late returns.
        </span>
      </label>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(3)}>Back</Button>
        <Button size="lg" className="flex-1" onClick={handleNext}>Continue to Payment</Button>
      </div>
    </div>
  )
}

// ─── Step 5: Payment (Stripe) ─────────────────────────────────────────────────

function CardPaymentForm() {
  const { service, operatorId, resortId } = useContext(BookingCtx)
  const { pickupDate, returnDate, participants, setStep, setConfirmedBookingId } = useSkiRentalStore()
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : 0
  const total = (service?.price_per_person ?? 0) * days * participants.length

  async function handleConfirm() {
    if (!stripe || !elements || !service || !user) return
    setSubmitting(true)

    try {
      // Find an availability slot for pickup date
      const slots = await getAvailableSlots(service.id, {
        from: parseISO(pickupDate!),
        to: parseISO(pickupDate!),
      })
      if (slots.length === 0) {
        toast.error('No availability for the selected pick-up date. Please choose different dates.')
        setSubmitting(false)
        return
      }
      const slotId = slots[0].id

      // Map participants to DB shape
      const participantRows = participants.map((p) => ({
        first_name: p.firstName,
        last_name: p.lastName,
        age: p.age,
        school_data: null,
        rental_data: {
          equipment_type: p.equipmentType === 'skis' || p.equipmentType === 'telemark' ? 'ski' as const : 'snowboard' as const,
          height_cm: p.heightCm!,
          weight_kg: p.weightKg!,
          boot_size: p.shoeSizeEU!,
          helmet_size: p.helmet && p.helmetCircumferenceCm
            ? (() => {
                const c = p.helmetCircumferenceCm
                if (c < 53) return 'XS'
                if (c < 55) return 'S'
                if (c < 57) return 'M'
                if (c < 59) return 'L'
                if (c < 62) return 'XL'
                return 'XXL'
              })()
            : 'M',
          preferred_brand: null,
        },
      }))

      const booking = await createBooking({
        customer_id: user.id,
        operator_id: operatorId,
        resort_id: resortId,
        service_id: service.id,
        availability_slot_id: slotId,
        type: 'rental_only',
        total_price: total,
        currency: service.currency,
        stripe_payment_intent_id: null, // TODO: integrate backend PaymentIntent endpoint
        participants: participantRows,
      })

      // NOTE: Real payment charge requires a backend endpoint that:
      // 1. Creates a Stripe PaymentIntent with the amount
      // 2. Returns the client_secret
      // 3. Call stripe.confirmCardPayment(clientSecret, { payment_method: { card: elements.getElement(CardElement) } })
      // For now we create the booking and skip the charge.

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
        <strong>Demo mode:</strong> Card details are collected via Stripe but no charge is made yet. A backend PaymentIntent endpoint is required for live payments.
      </div>

      <div className="border border-gray-200 rounded-xl p-4 mb-5">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                '::placeholder': { color: '#9ca3af' },
              },
            },
          }}
        />
      </div>

      <div className="flex justify-between text-sm font-bold text-gray-900 mb-5">
        <span>Total to pay</span>
        <span>{service?.currency ?? 'EUR'} {total.toFixed(2)}</span>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => useSkiRentalStore.getState().setStep(4)}>
          Back
        </Button>
        <Button size="lg" className="flex-1" isLoading={submitting} onClick={handleConfirm}>
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
      <Elements stripe={stripePromise}>
        <CardPaymentForm />
      </Elements>
    </div>
  )
}

// ─── Step 6: Confirmation ─────────────────────────────────────────────────────

function Step6() {
  const { resort, operator } = useContext(BookingCtx)
  const { confirmedBookingId, pickupDate, returnDate, participants, reset } = useSkiRentalStore()
  const navigate = useNavigate()

  if (!confirmedBookingId) return null

  const days = pickupDate && returnDate ? differenceInDays(parseISO(returnDate), parseISO(pickupDate)) : 0

  return (
    <div className="max-w-screen-md mx-auto px-4 py-10 text-center">
      {/* Success badge */}
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-9 h-9 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">You're all set!</h2>
      <p className="text-sm text-gray-500 mb-6">
        Booking confirmed at <strong>{operator?.name}</strong>, {resort?.name}.
      </p>

      {/* Booking ref */}
      <div className="bg-gray-50 rounded-xl px-4 py-2 inline-block mb-6">
        <p className="text-xs text-gray-400 mb-0.5">Booking reference</p>
        <p className="font-mono text-sm font-bold text-gray-800">{confirmedBookingId.toUpperCase().slice(0, 8)}</p>
      </div>

      {/* QR code */}
      <div className="flex flex-col items-center gap-1 mb-8">
        <QRDisplay bookingId={confirmedBookingId} />
        <p className="text-xs text-gray-400 mt-1">Show this at the rental desk on pick-up day</p>
      </div>

      {/* Dates summary */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-5 text-sm text-left">
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
          <span className="font-semibold text-gray-900">{days} day{days !== 1 ? 's' : ''} · {participants.length} person{participants.length > 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Participants summary */}
      <div className="space-y-2 mb-8 text-left">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
            <span className="text-gray-400 text-xs ml-auto">
              {p.equipmentType === 'skis' ? '⛷' : p.equipmentType === 'snowboard' ? '🏂' : '🎿'} {p.equipmentType}
            </span>
          </div>
        ))}
      </div>

      {/* Add to wallet stub */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-center">
        <button
          onClick={() => toast('Apple Wallet integration coming soon')}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.701" /></svg>
          Add to Apple Wallet
        </button>
        <button
          onClick={() => toast('Google Wallet integration coming soon')}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Add to Google Wallet
        </button>
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-3">
        <Link
          to="/my-trips"
          className="text-blue-600 hover:text-blue-700 font-medium text-sm transition-colors"
        >
          View in My Trips →
        </Link>
        <button
          onClick={() => { reset(); navigate('/') }}
          className="text-gray-400 hover:text-gray-600 text-sm transition-colors"
        >
          Back to home
        </button>
      </div>
    </div>
  )
}

// ─── Main coordinator ─────────────────────────────────────────────────────────

export default function SkiRentalBooking() {
  const { operatorId, resortId } = useParams<{ operatorId: string; resortId: string }>()
  const navigate = useNavigate()
  const step = useSkiRentalStore((s) => s.step)

  const [service, setService] = useState<Service | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [resort, setResort] = useState<Resort | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!operatorId || !resortId) return
    setLoading(true)

    Promise.all([
      getServicesByOperator(operatorId, resortId),
      getOperatorById(operatorId),
      getResortById(resortId),
    ])
      .then(([services, op, res]) => {
        const rentalService = services.find((s) => s.type === 'ski_rental')
        if (!rentalService) {
          setError('No ski rental service found for this operator.')
          return
        }
        setService(rentalService)
        setOperator(op)
        setResort(res)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [operatorId, resortId])

  if (loading) {
    return (
      <div className="pt-16 max-w-screen-md mx-auto px-4 py-8 space-y-4">
        <Skeleton width="w-48" height="h-7" />
        <Skeleton height="h-4" />
        <Skeleton height="h-4" width="w-3/4" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="pt-16 max-w-screen-md mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
          <p className="text-red-700 font-medium mb-4">{error}</p>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Go back
          </Button>
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
