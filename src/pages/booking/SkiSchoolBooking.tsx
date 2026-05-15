import {
  useState, useEffect, useRef,
  createContext, useContext,
} from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths, isToday,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Check, CheckCircle2, Users,
  ArrowLeft, Clock, ChevronDown, ChevronUp, Star,
} from 'lucide-react'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

import { useSkiSchoolStore } from '../../store/skiSchoolStore'
import type { LessonType, SchoolParticipant } from '../../store/skiSchoolStore'
import { getServicesByOperator } from '../../lib/supabase/services'
import { getAvailableSlots } from '../../lib/supabase/availability'
import { createBooking } from '../../lib/supabase/bookings'
import { getOperatorById } from '../../lib/supabase/operators'
import { getResortById } from '../../lib/supabase/resorts'
import type { Service, Operator, Resort, AvailabilitySlot } from '../../types'
import { useAuth } from '../../hooks/useAuth'
import SkillLevelPicker from '../../components/ui/SkillLevelPicker'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'

// ─── Stripe ───────────────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder')

// ─── Lesson type config ───────────────────────────────────────────────────────

interface LessonConfig {
  type: LessonType
  icon: string
  label: string
  description: string
  detail: string
  badge: string
  badgeColor: string
}

const LESSON_TYPES: LessonConfig[] = [
  {
    type: 'private',
    icon: '🎿',
    label: 'Private Lesson',
    description: '1-on-1 with a certified instructor. Fastest progress with fully personalised coaching.',
    detail: 'Solo · Any age · Any level',
    badge: 'Best progress',
    badgeColor: 'bg-violet-100 text-violet-700',
  },
  {
    type: 'group',
    icon: '👥',
    label: 'Group Lesson',
    description: 'Small groups of similar ability. Great value, social, and highly motivating.',
    detail: '4–8 people · Same level',
    badge: 'Best value',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    type: 'kids',
    icon: '🧒',
    label: 'Kids Lesson',
    description: 'Certified children\'s instructors in a safe, fun environment built for young learners.',
    detail: 'Ages 4–12 · Small groups',
    badge: 'Under 12',
    badgeColor: 'bg-green-100 text-green-700',
  },
]

// ─── Booking context ──────────────────────────────────────────────────────────

interface SchoolCtxValue {
  operatorId: string
  resortId: string
  service: Service | null
  rentalService: Service | null
  operator: Operator | null
  resort: Resort | null
}

const SchoolCtx = createContext<SchoolCtxValue>({
  operatorId: '', resortId: '',
  service: null, rentalService: null, operator: null, resort: null,
})

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ step, hasBundle }: { step: number; hasBundle: boolean }) {
  const allLabels = ['Lesson', 'Schedule', 'Participants', 'Bundle', 'Add-ons', 'Review', 'Payment', 'Done']
  const labels = hasBundle ? allLabels : allLabels.filter((l) => l !== 'Bundle')
  // Map internal step (1-8) to display index (0-based)
  const displayIdx = hasBundle || step <= 3 ? step - 1 : step - 2

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-16 z-20">
      <div className="max-w-screen-md mx-auto">
        <div className="flex items-center gap-1">
          {labels.map((label, i) => {
            const done = i < displayIdx
            const active = i === displayIdx
            return (
              <div key={label} className="flex items-center gap-1 flex-1 min-w-0">
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <div className={[
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                    done || active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500',
                  ].join(' ')}>
                    {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className={['text-[9px] font-medium hidden sm:block', active ? 'text-blue-600' : 'text-gray-400'].join(' ')}>
                    {label}
                  </span>
                </div>
                {i < labels.length - 1 && (
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

// ─── Single date picker ───────────────────────────────────────────────────────

function SingleDatePicker({
  selectedDate, availableDates, loading, onChange,
}: {
  selectedDate: string | null
  availableDates: Set<string>
  loading: boolean
  onChange: (date: string) => void
}) {
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: startOfMonth(displayMonth), end: endOfMonth(displayMonth) })
  const startPad = (getDay(startOfMonth(displayMonth)) + 6) % 7

  function handleClick(dateStr: string) {
    if (dateStr < todayStr) return
    if (!availableDates.has(dateStr)) {
      toast('No lessons available on this date — try another.', { icon: '📅' })
      return
    }
    onChange(dateStr)
  }

  return (
    <div className="max-w-xs">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setDisplayMonth((m) => subMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-800">{format(displayMonth, 'MMMM yyyy')}</span>
        <button onClick={() => setDisplayMonth((m) => addMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
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
          const avail = availableDates.has(dateStr)
          const sel = dateStr === selectedDate
          const today = isToday(day)

          return (
            <div
              key={dateStr}
              onClick={() => handleClick(dateStr)}
              className={[
                'flex flex-col items-center py-1 rounded-full transition-colors select-none',
                past ? 'cursor-not-allowed opacity-30' :
                  sel ? 'bg-blue-600 cursor-pointer' :
                  avail ? 'hover:bg-blue-50 cursor-pointer' :
                  'cursor-not-allowed opacity-40',
                today && !sel ? 'ring-1 ring-blue-400' : '',
              ].join(' ')}
              role={!past ? 'button' : undefined}
              tabIndex={!past && avail ? 0 : -1}
              onKeyDown={(e) => e.key === 'Enter' && handleClick(dateStr)}
            >
              <span className={['text-xs leading-5 font-medium', sel ? 'text-white' : avail ? 'text-gray-800' : 'text-gray-400'].join(' ')}>
                {format(day, 'd')}
              </span>
              {loading ? (
                <span className="w-1 h-1 rounded-full bg-gray-200 animate-pulse" />
              ) : (
                <span className={['w-1 h-1 rounded-full', past ? 'bg-transparent' : avail ? sel ? 'bg-blue-300' : 'bg-green-500' : 'bg-transparent'].join(' ')} />
              )}
            </div>
          )
        })}
      </div>

      <div className="flex gap-4 mt-3 text-xs text-gray-500 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Available</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-blue-600 inline-block" /> Selected</span>
      </div>
    </div>
  )
}

// ─── Rental inline form (bundle step) ────────────────────────────────────────

const EQUIP_OPTIONS = [
  { value: 'skis' as const,      label: 'Skis',      icon: '⛷' },
  { value: 'snowboard' as const, label: 'Snowboard', icon: '🏂' },
  { value: 'telemark' as const,  label: 'Telemark',  icon: '🎿' },
]

function RentalInlineForm({ index, error }: { index: number; error: Record<string, string> | null }) {
  const { participants, updateRental } = useSkiSchoolStore()
  const p = participants[index]
  const r = p.rental

  function field(key: keyof typeof r) {
    return (val: unknown) => updateRental(index, { [key]: val } as Partial<typeof r>)
  }

  function numInput(key: keyof typeof r, label: string, unit: string, min: number, max: number) {
    const val = r[key] as number | null
    const err = error?.[key as string]
    return (
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">{label} <span className="text-gray-400">({unit})</span></label>
        <input
          type="number" min={min} max={max}
          value={val ?? ''}
          onChange={(e) => field(key)(e.target.value === '' ? null : Number(e.target.value))}
          className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', err ? 'border-red-400' : 'border-gray-300'].join(' ')}
        />
        {err && <p className="text-xs text-red-600 mt-0.5">{err}</p>}
      </div>
    )
  }

  return (
    <div className="mt-3 p-4 bg-gray-50 rounded-xl space-y-4">
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
                field('poles')(opt.value !== 'snowboard')
              }}
              className={[
                'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all',
                r.equipmentType === opt.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50',
              ].join(' ')}
            >
              <span className="text-lg">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
        {error?.equipmentType && <p className="text-xs text-red-600 mt-1">{error.equipmentType}</p>}
      </div>

      {/* Measurements */}
      <div className="grid grid-cols-3 gap-3">
        {numInput('heightCm', 'Height', 'cm', 80, 220)}
        {numInput('weightKg', 'Weight', 'kg', 10, 250)}
        {numInput('shoeSizeEU', 'Shoe size', 'EU', 20, 55)}
      </div>

      {/* Helmet */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600">Helmet rental</span>
          <button
            type="button"
            onClick={() => field('helmet')(!r.helmet)}
            className={['w-11 h-6 rounded-full transition-colors relative', r.helmet ? 'bg-blue-600' : 'bg-gray-200'].join(' ')}
            role="switch" aria-checked={r.helmet}
          >
            <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', r.helmet ? 'translate-x-5' : ''].join(' ')} />
          </button>
        </div>
        {r.helmet && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Head circumference (cm)</label>
            <input
              type="number" min={48} max={70}
              value={r.helmetCircumferenceCm ?? ''}
              onChange={(e) => field('helmetCircumferenceCm')(e.target.value === '' ? null : Number(e.target.value))}
              placeholder="e.g. 56"
              className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.helmetCircumferenceCm ? 'border-red-400' : 'border-gray-300'].join(' ')}
            />
            {error?.helmetCircumferenceCm && <p className="text-xs text-red-600 mt-0.5">{error.helmetCircumferenceCm}</p>}
          </div>
        )}
      </div>

      {/* Poles (auto-set, can override) */}
      {r.equipmentType !== 'snowboard' && (
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-gray-600">Poles</span>
            <p className="text-[10px] text-gray-400">Recommended for skiing</p>
          </div>
          <button
            type="button"
            onClick={() => field('poles')(!r.poles)}
            className={['w-11 h-6 rounded-full transition-colors relative', r.poles ? 'bg-blue-600' : 'bg-gray-200'].join(' ')}
            role="switch" aria-checked={r.poles}
          >
            <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', r.poles ? 'translate-x-5' : ''].join(' ')} />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── QR display ───────────────────────────────────────────────────────────────

function QRDisplay({ bookingId }: { bookingId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const largeRef = useRef<HTMLCanvasElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (canvasRef.current) QRCode.toCanvas(canvasRef.current, bookingId, { width: 180, margin: 2 })
  }, [bookingId])

  useEffect(() => {
    if (expanded && largeRef.current) QRCode.toCanvas(largeRef.current, bookingId, { width: 280, margin: 3 })
  }, [expanded, bookingId])

  return (
    <>
      <button onClick={() => setExpanded(true)} className="inline-block rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow" aria-label="Tap to expand QR code">
        <canvas ref={canvasRef} className="block" />
      </button>
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center gap-4" onClick={() => setExpanded(false)}>
          <canvas ref={largeRef} className="rounded-2xl" onClick={(e) => e.stopPropagation()} />
          <p className="text-white/60 text-sm">Tap to close</p>
        </div>
      )}
    </>
  )
}

// ─── Step 1: Lesson type ──────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const { service } = useContext(SchoolCtx)
  const { lessonType, setLessonType } = useSkiSchoolStore()

  function handleNext() {
    if (!lessonType) { toast.error('Please choose a lesson type'); return }
    onNext()
  }

  const priceLabel = service ? `from €${service.price_per_person.toFixed(0)} / person` : ''

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Choose your lesson type</h2>
      <p className="text-sm text-gray-500 mb-6">{priceLabel}</p>

      <div className="space-y-3">
        {LESSON_TYPES.map((cfg) => (
          <button
            key={cfg.type}
            onClick={() => setLessonType(cfg.type)}
            className={[
              'w-full text-left p-5 rounded-2xl border-2 transition-all',
              lessonType === cfg.type ? 'border-blue-500 bg-blue-50' : 'border-gray-100 bg-white hover:border-gray-200',
            ].join(' ')}
          >
            <div className="flex items-start gap-4">
              <span className="text-3xl">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-gray-900">{cfg.label}</span>
                  <span className={['text-[10px] font-semibold px-2 py-0.5 rounded-full', cfg.badgeColor].join(' ')}>{cfg.badge}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{cfg.description}</p>
                <p className="text-xs text-gray-400 mt-1">{cfg.detail}</p>
              </div>
              <div className={['w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5', lessonType === cfg.type ? 'border-blue-500 bg-blue-500' : 'border-gray-300'].join(' ')}>
                {lessonType === cfg.type && <Check className="w-3 h-3 text-white" />}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-8">
        <Button size="lg" className="w-full" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 2: Date + time slot ─────────────────────────────────────────────────

function Step2({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { service } = useContext(SchoolCtx)
  const { selectedDate, selectedSlotId, setDate, setSlot } = useSkiSchoolStore()

  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [loadingDates, setLoadingDates] = useState(false)
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Fetch available dates for the displayed month range
  useEffect(() => {
    if (!service) return
    setLoadingDates(true)
    const from = new Date()
    const to = new Date(from.getFullYear(), from.getMonth() + 2, 0)
    getAvailableSlots(service.id, { from, to })
      .then((s) => setAvailableDates(new Set(s.map((sl) => sl.date))))
      .catch(console.error)
      .finally(() => setLoadingDates(false))
  }, [service])

  // Fetch slots for the selected date
  useEffect(() => {
    if (!service || !selectedDate) return
    setLoadingSlots(true)
    getAvailableSlots(service.id, {
      from: parseISO(selectedDate),
      to: parseISO(selectedDate),
    })
      .then(setSlots)
      .catch(console.error)
      .finally(() => setLoadingSlots(false))
  }, [service, selectedDate])

  function handleNext() {
    if (!selectedDate) { toast.error('Please select a date'); return }
    if (!selectedSlotId) { toast.error('Please select a time slot'); return }
    onNext()
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Pick a date and time</h2>
      <p className="text-sm text-gray-500 mb-6">Choose from available lesson slots.</p>

      <SingleDatePicker
        selectedDate={selectedDate}
        availableDates={availableDates}
        loading={loadingDates}
        onChange={(date) => { setDate(date); setSlots([]) }}
      />

      {/* Time slots */}
      {selectedDate && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-gray-400" />
            Available slots on {format(parseISO(selectedDate), 'd MMMM')}
          </h3>
          {loadingSlots ? (
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} width="w-20" height="h-10" />)}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-400 bg-gray-50 rounded-xl p-4">No slots found for this date.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const remaining = slot.capacity_total - slot.capacity_booked
                const selected = slot.id === selectedSlotId
                return (
                  <button
                    key={slot.id}
                    onClick={() => setSlot(slot.id, `${slot.start_time.slice(0, 5)} – ${slot.end_time.slice(0, 5)}`)}
                    className={[
                      'flex flex-col items-center px-4 py-2.5 rounded-xl border-2 text-sm font-medium transition-all',
                      selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-blue-300',
                    ].join(' ')}
                  >
                    <span className="font-semibold">{slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}</span>
                    <span className={['text-[10px] mt-0.5', remaining <= 2 ? 'text-orange-500' : 'text-gray-400'].join(' ')}>
                      {remaining} spot{remaining !== 1 ? 's' : ''} left
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>Back</Button>
        <Button size="lg" className="flex-1" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 3: Participants ─────────────────────────────────────────────────────

function Step3({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { lessonType, participantCount, participants, setParticipantCount, updateParticipant } = useSkiSchoolStore()
  const [errors, setErrors] = useState<(Record<string, string> | null)[]>([])
  const isKids = lessonType === 'kids'

  function validate(): boolean {
    const errs = participants.map((p) => {
      const e: Record<string, string> = {}
      if (!p.firstName) e.firstName = 'Required'
      if (!p.lastName) e.lastName = 'Required'
      if (!p.age || p.age < 3) e.age = 'Min age 3'
      if (!p.skillLevel) e.skillLevel = 'Required'
      if (isKids && !p.guardianName) e.guardianName = 'Required for kids lessons'
      if (isKids && !p.guardianPhone) e.guardianPhone = 'Required for kids lessons'
      return Object.keys(e).length > 0 ? e : null
    })
    setErrors(errs)
    return errs.every((e) => e === null)
  }

  function handleNext() {
    if (validate()) onNext()
    else toast.error('Please complete all participant details')
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Participants</h2>
      <p className="text-sm text-gray-500 mb-6">
        {isKids ? 'Kids lessons require a parent or guardian contact.' : 'Tell us who is joining the lesson.'}
      </p>

      {/* Count selector */}
      <div className="flex items-center gap-4 mb-6 bg-gray-50 rounded-xl p-4">
        <Users className="w-5 h-5 text-gray-500 shrink-0" />
        <span className="text-sm font-medium text-gray-700 flex-1">How many people?</span>
        <div className="flex items-center gap-3">
          <button onClick={() => setParticipantCount(Math.max(1, participantCount - 1))}
            disabled={participantCount <= 1}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40">−</button>
          <span className="text-lg font-bold text-gray-900 w-6 text-center">{participantCount}</span>
          <button onClick={() => setParticipantCount(Math.min(8, participantCount + 1))}
            disabled={participantCount >= 8}
            className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-100 disabled:opacity-40">+</button>
        </div>
      </div>

      {/* Participant forms */}
      <div className="space-y-3">
        {participants.map((p, i) => (
          <ParticipantCard key={i} index={i} participant={p} error={errors[i] ?? null} isKids={isKids} onUpdate={(data) => updateParticipant(i, data)} />
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>Back</Button>
        <Button size="lg" className="flex-1" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  )
}

function ParticipantCard({
  index, participant: p, error, isKids, onUpdate,
}: {
  index: number
  participant: SchoolParticipant
  error: Record<string, string> | null
  isKids: boolean
  onUpdate: (data: Partial<SchoolParticipant>) => void
}) {
  const [open, setOpen] = useState(index === 0)
  const complete = p.firstName && p.lastName && p.age && p.skillLevel

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
          <span className="text-sm font-medium text-gray-800">
            {p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : `Participant ${index + 1}`}
          </span>
          {complete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(['firstName', 'lastName'] as const).map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{key === 'firstName' ? 'First name' : 'Last name'}</label>
                <input type="text" value={p[key]} onChange={(e) => onUpdate({ [key]: e.target.value })}
                  placeholder={key === 'firstName' ? 'Jan' : 'Novák'}
                  className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.[key] ? 'border-red-400' : 'border-gray-300'].join(' ')} />
                {error?.[key] && <p className="text-xs text-red-600 mt-0.5">{error[key]}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
              <input type="number" min={3} max={99} value={p.age ?? ''}
                onChange={(e) => onUpdate({ age: e.target.value === '' ? null : Number(e.target.value) })}
                className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.age ? 'border-red-400' : 'border-gray-300'].join(' ')} />
              {error?.age && <p className="text-xs text-red-600 mt-0.5">{error.age}</p>}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Skill level</label>
            <SkillLevelPicker value={p.skillLevel} onChange={(v) => onUpdate({ skillLevel: v })} />
            {error?.skillLevel && <p className="text-xs text-red-600 mt-1">{error.skillLevel}</p>}
          </div>

          {isKids && (
            <div className="pt-3 border-t border-gray-100 space-y-3">
              <p className="text-xs font-semibold text-gray-700">Parent / Guardian contact</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Full name</label>
                  <input type="text" value={p.guardianName} onChange={(e) => onUpdate({ guardianName: e.target.value })}
                    className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.guardianName ? 'border-red-400' : 'border-gray-300'].join(' ')} />
                  {error?.guardianName && <p className="text-xs text-red-600 mt-0.5">{error.guardianName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone</label>
                  <input type="tel" value={p.guardianPhone} onChange={(e) => onUpdate({ guardianPhone: e.target.value })}
                    className={['w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500', error?.guardianPhone ? 'border-red-400' : 'border-gray-300'].join(' ')} />
                  {error?.guardianPhone && <p className="text-xs text-red-600 mt-0.5">{error.guardianPhone}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Step 4: Bundle rental add-on ─────────────────────────────────────────────

function Step4Bundle({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { rentalService } = useContext(SchoolCtx)
  const { selectedDate, participants, updateParticipant } = useSkiSchoolStore()
  const [rentalAvailable, setRentalAvailable] = useState(false)
  const [loadingRental, setLoadingRental] = useState(true)
  const [bundleErrors, setBundleErrors] = useState<(Record<string, string> | null)[]>([])

  useEffect(() => {
    if (!rentalService || !selectedDate) { setLoadingRental(false); return }
    getAvailableSlots(rentalService.id, { from: parseISO(selectedDate), to: parseISO(selectedDate) })
      .then((slots) => setRentalAvailable(slots.length > 0))
      .catch(console.error)
      .finally(() => setLoadingRental(false))
  }, [rentalService, selectedDate])

  function validateBundle(): boolean {
    const errs = participants.map((p) => {
      if (!p.rentalEnabled) return null
      const e: Record<string, string> = {}
      if (!p.rental.equipmentType) e.equipmentType = 'Required'
      if (!p.rental.heightCm) e.heightCm = 'Required'
      if (!p.rental.weightKg) e.weightKg = 'Required'
      if (!p.rental.shoeSizeEU) e.shoeSizeEU = 'Required'
      if (p.rental.helmet && !p.rental.helmetCircumferenceCm) e.helmetCircumferenceCm = 'Required'
      return Object.keys(e).length > 0 ? e : null
    })
    setBundleErrors(errs)
    return errs.every((e) => e === null)
  }

  function handleNext() {
    if (validateBundle()) onNext()
    else toast.error('Please fill in rental details for all toggled participants')
  }

  const anyEnabled = participants.some((p) => p.rentalEnabled)

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-2">
        <span className="text-3xl">🎿+🥾</span>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Need equipment too?</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            This school also offers rental — add gear now and pick everything up together.
          </p>
        </div>
      </div>

      {loadingRental ? (
        <div className="mt-6 space-y-3">
          <Skeleton height="h-16" />
          <Skeleton height="h-16" />
        </div>
      ) : !rentalAvailable ? (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
          Equipment is fully booked for your lesson date. You can still book the lesson without rental.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {participants.map((p, i) => (
            <div key={i} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              {/* Toggle row */}
              <div className="flex items-center justify-between px-4 py-4">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Add rental for {p.firstName || `Participant ${i + 1}`}</p>
                    {p.rentalEnabled && p.rental.equipmentType && (
                      <p className="text-xs text-gray-400 capitalize">{p.rental.equipmentType} · {p.rental.heightCm ? `${p.rental.heightCm}cm` : 'measurements needed'}</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => updateParticipant(i, { rentalEnabled: !p.rentalEnabled })}
                  className={['w-11 h-6 rounded-full transition-colors relative shrink-0', p.rentalEnabled ? 'bg-blue-600' : 'bg-gray-200'].join(' ')}
                  role="switch" aria-checked={p.rentalEnabled}
                >
                  <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', p.rentalEnabled ? 'translate-x-5' : ''].join(' ')} />
                </button>
              </div>

              {/* Inline form */}
              {p.rentalEnabled && (
                <div className="px-4 pb-4">
                  <RentalInlineForm index={i} error={bundleErrors[i] ?? null} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bundle note */}
      {anyEnabled && (
        <div className="mt-4 flex gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
          Equipment and lesson are picked up together at the rental desk on arrival.
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3">
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={onBack}>Back</Button>
          <Button size="lg" className="flex-1" onClick={handleNext}>
            {anyEnabled ? 'Continue with bundle' : 'Continue'}
          </Button>
        </div>
        <button onClick={onNext} className="text-sm text-gray-400 hover:text-gray-600 transition-colors text-center">
          Skip — lesson only
        </button>
      </div>
    </div>
  )
}

// ─── Step 5: Add-ons ─────────────────────────────────────────────────────────

const APRES_SKI_PRICE = 15

function Step5AddOns({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { apresSkiAddon, participantCount, setApresSkiAddon } = useSkiSchoolStore()

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Add-ons</h2>
      <p className="text-sm text-gray-500 mb-6">Enhance your mountain experience.</p>

      {/* Après-ski package */}
      <div className={['flex items-center gap-4 p-5 rounded-2xl border-2 transition-all', apresSkiAddon ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-white'].join(' ')}>
        <span className="text-3xl">🍷</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-gray-900">Après-ski Package</span>
            <span className="text-[10px] bg-orange-100 text-orange-700 font-semibold px-2 py-0.5 rounded-full">Popular</span>
          </div>
          <p className="text-sm text-gray-600">Hot drinks, snacks, and a welcome drink at the lodge after your lesson.</p>
          <p className="text-xs text-gray-400 mt-1">€{APRES_SKI_PRICE} per person · {participantCount} person{participantCount > 1 ? 's' : ''} = €{(APRES_SKI_PRICE * participantCount).toFixed(0)}</p>
        </div>
        <button
          type="button"
          onClick={() => setApresSkiAddon(!apresSkiAddon)}
          className={['w-11 h-6 rounded-full transition-colors relative shrink-0', apresSkiAddon ? 'bg-orange-500' : 'bg-gray-200'].join(' ')}
          role="switch" aria-checked={apresSkiAddon}
        >
          <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', apresSkiAddon ? 'translate-x-5' : ''].join(' ')} />
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-6 text-center">More add-ons from this operator coming soon.</p>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>Back</Button>
        <Button size="lg" className="flex-1" onClick={onNext}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 6: Review ───────────────────────────────────────────────────────────

function Step6Review({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { service, rentalService, operator, resort } = useContext(SchoolCtx)
  const { lessonType, selectedDate, selectedSlotTime, participants, apresSkiAddon, termsAccepted, setTermsAccepted } = useSkiSchoolStore()

  const rentalParticipants = participants.filter((p) => p.rentalEnabled)
  const hasBundle = rentalParticipants.length > 0

  const schoolTotal = (service?.price_per_person ?? 0) * participants.length
  const rentalTotal = (rentalService?.price_per_person ?? 0) * rentalParticipants.length
  const apresTotal = apresSkiAddon ? APRES_SKI_PRICE * participants.length : 0
  const grandTotal = schoolTotal + rentalTotal + apresTotal

  function handleNext() {
    if (!termsAccepted) { toast.error('Please accept the terms to continue'); return }
    onNext()
  }

  const lessonLabel = LESSON_TYPES.find((l) => l.type === lessonType)?.label ?? 'Lesson'

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Review your booking</h2>
      <p className="text-sm text-gray-500 mb-6">Confirm the details before payment.</p>

      {/* Booking type badge */}
      {hasBundle && (
        <div className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-500 to-violet-500 text-white text-xs font-semibold px-3 py-1 rounded-full mb-4">
          ✨ Bundle booking
        </div>
      )}

      {/* Summary */}
      <div className="bg-gray-50 rounded-2xl p-4 mb-5 text-sm space-y-1.5">
        {[
          ['Operator', operator?.name],
          ['Resort', resort?.name],
          ['Lesson type', lessonLabel],
          ['Date', selectedDate ? format(parseISO(selectedDate), 'd MMMM yyyy') : '—'],
          ['Time', selectedSlotTime ?? '—'],
          ['Participants', `${participants.length} person${participants.length > 1 ? 's' : ''}`],
        ].map(([label, value]) => (
          <div key={label as string} className="flex justify-between">
            <span className="text-gray-500">{label}</span>
            <span className="font-medium text-gray-900">{value}</span>
          </div>
        ))}
      </div>

      {/* Participant list */}
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Participants</h3>
      <div className="space-y-2 mb-5">
        {participants.map((p, i) => (
          <div key={i} className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm">
            <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
            <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
            <span className="text-gray-400 text-xs ml-auto">Skill {p.skillLevel}/5</span>
            {p.rentalEnabled && (
              <span className="text-[10px] bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">+ gear</span>
            )}
          </div>
        ))}
      </div>

      {/* Price breakdown */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pricing</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Ski School ({participants.length} × €{service?.price_per_person.toFixed(0)})</span>
            <span>€{schoolTotal.toFixed(2)}</span>
          </div>
          {hasBundle && (
            <div className="flex justify-between text-gray-600">
              <span>Equipment rental ({rentalParticipants.length} × €{rentalService?.price_per_person.toFixed(0)})</span>
              <span>€{rentalTotal.toFixed(2)}</span>
            </div>
          )}
          {apresSkiAddon && (
            <div className="flex justify-between text-gray-600">
              <span>Après-ski ({participants.length} × €{APRES_SKI_PRICE})</span>
              <span>€{apresTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-bold text-base">
          <span>Total</span>
          <span>EUR {grandTotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Terms */}
      <label className="flex items-start gap-3 cursor-pointer mb-8">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-blue-600" />
        <span className="text-xs text-gray-600 leading-relaxed">
          I agree to the booking terms. Cancellations must be made 24 hours before the lesson. Rental equipment must be returned in good condition.
        </span>
      </label>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>Back</Button>
        <Button size="lg" className="flex-1" onClick={handleNext}>Continue to Payment</Button>
      </div>
    </div>
  )
}

// ─── Step 7: Payment ──────────────────────────────────────────────────────────

function SchoolPaymentForm({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { service, rentalService, operatorId, resortId } = useContext(SchoolCtx)
  const { selectedDate, selectedSlotId, participants, apresSkiAddon, setConfirmedBookingId } = useSkiSchoolStore()
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const rentalParticipants = participants.filter((p) => p.rentalEnabled)
  const hasBundle = rentalParticipants.length > 0
  const schoolTotal = (service?.price_per_person ?? 0) * participants.length
  const rentalTotal = (rentalService?.price_per_person ?? 0) * rentalParticipants.length
  const apresTotal = apresSkiAddon ? APRES_SKI_PRICE * participants.length : 0
  const grandTotal = schoolTotal + rentalTotal + apresTotal

  function skillToEnum(n: number): 'beginner' | 'intermediate' | 'advanced' {
    return n <= 2 ? 'beginner' : n === 3 ? 'intermediate' : 'advanced'
  }

  function helmetSize(cm: number | null): string {
    if (!cm) return 'M'
    if (cm < 53) return 'XS'; if (cm < 55) return 'S'; if (cm < 57) return 'M'
    if (cm < 59) return 'L'; if (cm < 62) return 'XL'; return 'XXL'
  }

  async function handleConfirm() {
    if (!stripe || !elements || !service || !user || !selectedSlotId) return
    setSubmitting(true)

    try {
      const participantRows = participants.map((p) => ({
        first_name: p.firstName,
        last_name: p.lastName,
        age: p.age,
        school_data: {
          skill_level: skillToEnum(p.skillLevel!),
          instructor_preference: null,
          special_requirements: p.guardianName
            ? `Guardian: ${p.guardianName} ${p.guardianPhone}`
            : null,
        },
        rental_data: p.rentalEnabled && p.rental.equipmentType
          ? {
              equipment_type: (p.rental.equipmentType === 'snowboard' ? 'snowboard' : 'ski') as 'ski' | 'snowboard',
              height_cm: p.rental.heightCm!,
              weight_kg: p.rental.weightKg!,
              boot_size: p.rental.shoeSizeEU!,
              helmet_size: helmetSize(p.rental.helmetCircumferenceCm),
              preferred_brand: null,
            }
          : null,
      }))

      const booking = await createBooking({
        customer_id: user.id,
        operator_id: operatorId,
        resort_id: resortId,
        service_id: service.id,
        availability_slot_id: selectedSlotId,
        type: hasBundle ? 'bundle' : 'school_only',
        total_price: grandTotal,
        currency: service.currency,
        stripe_payment_intent_id: null,
        customer_notes: apresSkiAddon ? 'Après-ski package requested' : null,
        participants: participantRows,
      })

      setConfirmedBookingId(booking.id)
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Booking failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-xs text-amber-700">
        <strong>Demo mode:</strong> Card details are collected but no charge is made. A backend PaymentIntent endpoint is required for live payments.
      </div>
      <div className="border border-gray-200 rounded-xl p-4 mb-5">
        <CardElement options={{ style: { base: { fontSize: '16px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } } } }} />
      </div>
      <div className="flex justify-between text-sm font-bold text-gray-900 mb-5">
        <span>Total</span>
        <span>{service?.currency ?? 'EUR'} {grandTotal.toFixed(2)}</span>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={onBack}>Back</Button>
        <Button size="lg" className="flex-1" isLoading={submitting} onClick={handleConfirm}>Confirm Booking</Button>
      </div>
    </div>
  )
}

function Step7Payment({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Payment</h2>
      <p className="text-sm text-gray-500 mb-6">Your card details are secured by Stripe.</p>
      <Elements stripe={stripePromise}>
        <SchoolPaymentForm onNext={onNext} onBack={onBack} />
      </Elements>
    </div>
  )
}

// ─── Step 8: Confirmation ─────────────────────────────────────────────────────

function Step8Confirmation() {
  const { operator, resort } = useContext(SchoolCtx)
  const { confirmedBookingId, lessonType, selectedDate, selectedSlotTime, participants, apresSkiAddon, reset } = useSkiSchoolStore()
  const navigate = useNavigate()

  if (!confirmedBookingId) return null

  const lessonLabel = LESSON_TYPES.find((l) => l.type === lessonType)?.label ?? 'Lesson'
  const rentalParticipants = participants.filter((p) => p.rentalEnabled)
  const hasBundle = rentalParticipants.length > 0

  return (
    <div className="max-w-screen-md mx-auto px-4 py-10 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-9 h-9 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">You're booked!</h2>
      <p className="text-sm text-gray-500 mb-6">
        {hasBundle
          ? 'Your instructor and equipment will be ready when you arrive.'
          : 'Your instructor will be ready when you arrive.'}
      </p>

      {/* Reference */}
      <div className="bg-gray-50 rounded-xl px-4 py-2 inline-block mb-6">
        <p className="text-xs text-gray-400 mb-0.5">Booking reference</p>
        <p className="font-mono text-sm font-bold text-gray-800">{confirmedBookingId.toUpperCase().slice(0, 8)}</p>
      </div>

      {/* QR */}
      <div className="flex flex-col items-center gap-1 mb-8">
        <QRDisplay bookingId={confirmedBookingId} />
        <p className="text-xs text-gray-400 mt-1">Show at the school desk on arrival</p>
      </div>

      {/* Lesson details */}
      <div className="bg-sky-50 border border-sky-100 rounded-2xl p-4 mb-4 text-sm text-left">
        <h3 className="font-semibold text-sky-800 mb-2 flex items-center gap-1.5">
          <Star className="w-4 h-4" /> Lesson Details
        </h3>
        <div className="space-y-1 text-sky-700">
          {[
            ['Type', lessonLabel],
            ['Date', selectedDate ? format(parseISO(selectedDate), 'd MMMM yyyy') : '—'],
            ['Time', selectedSlotTime ?? '—'],
            ['Participants', `${participants.length}`],
            ...(apresSkiAddon ? [['Add-on', 'Après-ski package 🍷']] : []),
          ].map(([label, value]) => (
            <div key={label as string} className="flex justify-between">
              <span className="opacity-70">{label}</span>
              <span className="font-medium">{value}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t border-sky-200 space-y-1">
          {participants.map((p, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-sky-600">
              <span>{p.firstName} {p.lastName}</span>
              <span>Skill {p.skillLevel}/5</span>
            </div>
          ))}
        </div>
      </div>

      {/* Equipment details (bundle only) */}
      {hasBundle && (
        <div className="bg-violet-50 border border-violet-100 rounded-2xl p-4 mb-4 text-sm text-left">
          <h3 className="font-semibold text-violet-800 mb-2 flex items-center gap-1.5">
            🎿 Equipment Details
          </h3>
          <div className="space-y-2">
            {rentalParticipants.map((p, i) => {
              const equipLabel = p.rental.equipmentType === 'snowboard' ? '🏂 Snowboard' : p.rental.equipmentType === 'telemark' ? '🎿 Telemark' : '⛷ Skis'
              return (
                <div key={i} className="flex items-center justify-between text-xs text-violet-700">
                  <span className="font-medium">{p.firstName} {p.lastName}</span>
                  <span>{equipLabel}{p.rental.helmet ? ' + helmet' : ''}{p.rental.poles && p.rental.equipmentType !== 'snowboard' ? ' + poles' : ''}</span>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-violet-500 mt-3">Pick up your gear at the rental desk together with your lesson check-in.</p>
        </div>
      )}

      {/* Wallet stubs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6 justify-center mt-6">
        <button onClick={() => toast('Apple Wallet integration coming soon')}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.56-1.701" /></svg>
          Apple Wallet
        </button>
        <button onClick={() => toast('Google Wallet integration coming soon')}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
          <svg viewBox="0 0 24 24" className="w-5 h-5"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
          Google Wallet
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <Link to="/my-trips" className="text-blue-600 hover:text-blue-700 font-medium text-sm">View in My Trips →</Link>
        <button onClick={() => { reset(); navigate('/') }} className="text-gray-400 hover:text-gray-600 text-sm">Back to home</button>
      </div>
    </div>
  )
}

// ─── Main coordinator ─────────────────────────────────────────────────────────

export default function SkiSchoolBooking() {
  const { operatorId, resortId } = useParams<{ operatorId: string; resortId: string }>()
  const navigate = useNavigate()
  const { step, setStep } = useSkiSchoolStore()

  const [service, setService] = useState<Service | null>(null)
  const [rentalService, setRentalService] = useState<Service | null>(null)
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
        const school = services.find((s) => s.type === 'ski_school')
        const rental = services.find((s) => s.type === 'ski_rental') ?? null
        if (!school) { setError('No ski school service found for this operator.'); return }
        setService(school)
        setRentalService(rental)
        setOperator(op)
        setResort(res)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [operatorId, resortId])

  const hasBundle = rentalService !== null

  // Step navigation helpers (accounts for bundle skip)
  function next(from: number) {
    if (from === 3 && !hasBundle) { setStep(5); return }
    if (from === 7) { setStep(8); return }
    setStep(from + 1)
  }
  function back(from: number) {
    if (from === 5 && !hasBundle) { setStep(3); return }
    setStep(from - 1)
  }

  if (loading) return (
    <div className="pt-16 max-w-screen-md mx-auto px-4 py-8 space-y-4">
      <Skeleton width="w-48" height="h-7" /><Skeleton height="h-4" /><Skeleton width="w-3/4" height="h-4" />
    </div>
  )

  if (error) return (
    <div className="pt-16 max-w-screen-md mx-auto px-4 py-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
        <p className="text-red-700 font-medium mb-4">{error}</p>
        <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="w-4 h-4 mr-1" /> Go back</Button>
      </div>
    </div>
  )

  return (
    <SchoolCtx.Provider value={{ operatorId: operatorId!, resortId: resortId!, service, rentalService, operator, resort }}>
      <div className="min-h-screen pb-8">
        <ProgressBar step={step} hasBundle={hasBundle} />
        {step === 1 && <Step1 onNext={() => next(1)} />}
        {step === 2 && <Step2 onNext={() => next(2)} onBack={() => back(2)} />}
        {step === 3 && <Step3 onNext={() => next(3)} onBack={() => back(3)} />}
        {step === 4 && <Step4Bundle onNext={() => next(4)} onBack={() => back(4)} />}
        {step === 5 && <Step5AddOns onNext={() => next(5)} onBack={() => back(5)} />}
        {step === 6 && <Step6Review onNext={() => next(6)} onBack={() => back(6)} />}
        {step === 7 && <Step7Payment onNext={() => next(7)} onBack={() => back(7)} />}
        {step === 8 && <Step8Confirmation />}
      </div>
    </SchoolCtx.Provider>
  )
}
