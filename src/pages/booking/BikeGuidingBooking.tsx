import {
  useState, useEffect, useRef, useMemo,
  createContext, useContext,
} from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths, isToday,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Check, CheckCircle2, Users, Clock,
  ArrowLeft, ChevronDown, ChevronUp, Zap, Filter,
  Globe, Star, CheckCircle,
} from 'lucide-react'
import { z } from 'zod'
import toast from 'react-hot-toast'
import QRCode from 'qrcode'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'

import { useBikeGuidingStore } from '../../store/bikeGuidingStore'
import type { GuidingParticipant, GuidingRental, TourType } from '../../store/bikeGuidingStore'
import type { RidingStyle } from '../../store/bikeRentalStore'
import { getServicesByOperator } from '../../lib/supabase/services'
import { getAvailableSlots } from '../../lib/supabase/availability'
import { createBooking } from '../../lib/supabase/bookings'
import type { Service, Operator, Resort, AvailabilitySlot } from '../../types'
import { getOperatorById } from '../../lib/supabase/operators'
import { getResortById } from '../../lib/supabase/resorts'
import { useAuth } from '../../hooks/useAuth'
import { useSeasonStore } from '../../store/seasonStore'
import Button from '../../components/ui/Button'
import Skeleton from '../../components/ui/Skeleton'

// ─── Stripe ───────────────────────────────────────────────────────────────────

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? 'pk_test_placeholder')

// ─── Mock guide data ──────────────────────────────────────────────────────────

interface MockGuide {
  id: string
  name: string
  emoji: string
  languages: string[]
  specialities: string[]
  difficulty: number   // 1–5
  bio: string
  yearsExp: number
}

const ALL_GUIDES: MockGuide[] = [
  {
    id: 'guide-marco',
    name: 'Marco Bianchi',
    emoji: '🏔️',
    languages: ['English', 'Italian', 'German'],
    specialities: ['Enduro', 'Freeride'],
    difficulty: 5,
    bio: 'Former EWS racer with 12 years guiding in the Alps. Specialises in technical descents and enduro stage racing terrain.',
    yearsExp: 12,
  },
  {
    id: 'guide-anna',
    name: 'Anna Kowalski',
    emoji: '🌲',
    languages: ['English', 'Polish', 'Czech'],
    specialities: ['Trail', 'Cross-Country'],
    difficulty: 3,
    bio: 'Expert at reading trail flow and helping riders build confidence. Passionate trail runner turned MTB guide.',
    yearsExp: 6,
  },
  {
    id: 'guide-luca',
    name: 'Luca Fontana',
    emoji: '🛤️',
    languages: ['English', 'Italian', 'French'],
    specialities: ['Leisure', 'Scenic Routes', 'E-Bike'],
    difficulty: 2,
    bio: 'Cycling tour guide specialising in scenic valley routes and e-bike adventures. Perfect for families and casual riders.',
    yearsExp: 8,
  },
  {
    id: 'guide-petra',
    name: 'Petra Novák',
    emoji: '⛰️',
    languages: ['English', 'Slovak', 'Czech', 'German'],
    specialities: ['Trail', 'Enduro', 'Kids\' Riding'],
    difficulty: 4,
    bio: 'Mountain guide and coach focused on technique and progression. Great for intermediate riders ready to level up.',
    yearsExp: 9,
  },
  {
    id: 'guide-jakob',
    name: 'Jakob Müller',
    emoji: '🗺️',
    languages: ['English', 'German'],
    specialities: ['Cross-Country', 'Bikepacking', 'Multi-Day'],
    difficulty: 4,
    bio: 'Multi-day adventure specialist who knows every trail and hut in the region. Wilderness first aid certified.',
    yearsExp: 14,
  },
  {
    id: 'guide-sofia',
    name: 'Sofia Ricci',
    emoji: '🌅',
    languages: ['English', 'Italian'],
    specialities: ['Flow Trails', 'Trail', 'Leisure'],
    difficulty: 3,
    bio: 'Flow trail enthusiast who brings joy to every ride. Beginner-friendly but always fun for all levels.',
    yearsExp: 5,
  },
]

// ─── Tour types ───────────────────────────────────────────────────────────────

interface TourOption {
  id: TourType
  label: string
  duration: string
  emoji: string
  badge: string
  badgeColor: string
  description: string
  exampleTrails: string[]
}

const TOUR_OPTIONS: TourOption[] = [
  {
    id: 'half_day',
    label: 'Half Day',
    duration: '3–4 hours',
    emoji: '⛰️',
    badge: 'Most popular',
    badgeColor: 'bg-green-100 text-green-700',
    description: 'A focused ride covering the best local trails. Perfect for a morning or afternoon adventure.',
    exampleTrails: ['Flow trail circuit', 'Viewpoint singletrack', 'Technical warm-up descent'],
  },
  {
    id: 'full_day',
    label: 'Full Day',
    duration: '6–8 hours',
    emoji: '🏔️',
    badge: 'Best experience',
    badgeColor: 'bg-blue-100 text-blue-700',
    description: 'A complete mountain day covering multiple trail zones with a lunch break at a mountain hut.',
    exampleTrails: ['Ridgeline traverse', 'Enduro descent', 'Alpine meadow cruise', 'Rock garden section'],
  },
  {
    id: 'multi_day',
    label: 'Multi-Day',
    duration: '2–5 days',
    emoji: '🗺️',
    badge: 'Epic adventure',
    badgeColor: 'bg-violet-100 text-violet-700',
    description: 'Hut-to-hut touring covering entire mountain regions. Includes navigation, logistics and route planning.',
    exampleTrails: ['Mountain pass crossings', 'Regional trail networks', 'Overnight at alpine huts'],
  },
]

// ─── Booking context ──────────────────────────────────────────────────────────

interface BookingCtxValue {
  operatorId: string
  resortId: string
  service: Service | null
  rentalService: Service | null
  operator: Operator | null
  resort: Resort | null
}

const BookingCtx = createContext<BookingCtxValue>({
  operatorId: '', resortId: '', service: null, rentalService: null, operator: null, resort: null,
})

// ─── Progress bar ─────────────────────────────────────────────────────────────

const STEP_LABELS = ['Guide', 'Tour', 'Date', 'Riders', 'Bundle', 'Review', 'Payment', 'Done']
const STEP_LABELS_NO_BUNDLE = ['Guide', 'Tour', 'Date', 'Riders', 'Review', 'Payment', 'Done']

function ProgressBar({ step, hasBundle }: { step: number; hasBundle: boolean }) {
  const labels = hasBundle ? STEP_LABELS : STEP_LABELS_NO_BUNDLE
  const displayIdx = hasBundle || step <= 4 ? step - 1 : step - 2
  const total = labels.length

  return (
    <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-16 z-20">
      <div className="max-w-screen-md mx-auto flex items-center gap-1">
        {labels.map((label, i) => {
          const done = i < displayIdx
          const active = i === displayIdx
          return (
            <div key={i} className="flex items-center gap-1 flex-1 min-w-0">
              <div className="flex flex-col items-center gap-0.5 shrink-0">
                <div className={[
                  'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                  done || active ? 'bg-lime-500 text-white' : 'bg-gray-200 text-gray-500',
                ].join(' ')}>
                  {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={['text-[9px] font-medium hidden sm:block', active ? 'text-lime-600' : 'text-gray-400'].join(' ')}>{label}</span>
              </div>
              {i < total - 1 && (
                <div className={['h-0.5 flex-1 rounded-full transition-colors', done ? 'bg-lime-500' : 'bg-gray-200'].join(' ')} />
              )}
            </div>
          )
        })}
      </div>
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
        Guided bike tours are only available during the summer season. Switch season in the header to browse summer services.
      </p>
      <Button onClick={() => navigate('/')}>Back to home</Button>
    </div>
  )
}

// ─── Fitness level picker ─────────────────────────────────────────────────────

const FITNESS_LEVELS = [
  { value: 1, label: 'Easy', desc: 'Gentle paths, no tech', barColor: 'bg-green-500', textColor: 'text-green-700' },
  { value: 2, label: 'Casual', desc: 'Some hills & loose gravel', barColor: 'bg-lime-500', textColor: 'text-lime-700' },
  { value: 3, label: 'Moderate', desc: 'Technical roots & drops', barColor: 'bg-yellow-500', textColor: 'text-yellow-700' },
  { value: 4, label: 'Challenging', desc: 'Expert singletrack', barColor: 'bg-orange-500', textColor: 'text-orange-700' },
  { value: 5, label: 'Extreme', desc: 'Full-send enduro', barColor: 'bg-red-500', textColor: 'text-red-700' },
]

function FitnessLevelPicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const selected = FITNESS_LEVELS.find((l) => l.value === value) ?? null
  return (
    <div className="space-y-2">
      <div className="flex items-end gap-1.5" role="radiogroup">
        {FITNESS_LEVELS.map((level) => {
          const isSelected = value === level.value
          return (
            <button key={level.value} type="button" role="radio" aria-checked={isSelected}
              onClick={() => onChange(level.value)}
              className={['flex-1 rounded-t-md transition-all focus:outline-none', isSelected ? level.barColor : 'bg-gray-200 hover:bg-gray-300'].join(' ')}
              style={{ height: `${level.value * 8 + 16}px` }}
            />
          )
        })}
      </div>
      <div className="flex gap-1.5">
        {FITNESS_LEVELS.map((level) => (
          <span key={level.value} className={['flex-1 text-center text-[10px] font-medium truncate', value === level.value ? level.textColor : 'text-gray-400'].join(' ')}>
            {level.label}
          </span>
        ))}
      </div>
      {selected && <p className={['text-xs text-center', selected.textColor].join(' ')}>{selected.label} — {selected.desc}</p>}
    </div>
  )
}

// ─── Toggle helper ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-xs font-medium text-gray-600">{label}</span>
        {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={['w-11 h-6 rounded-full transition-colors relative', checked ? 'bg-lime-500' : 'bg-gray-200'].join(' ')}
        role="switch" aria-checked={checked}>
        <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
      </button>
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
      <button onClick={() => setExpanded(true)} className="inline-block rounded-2xl overflow-hidden shadow-md">
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

// ─── Step 1: Browse guides ────────────────────────────────────────────────────

function Step1() {
  const { selectedGuideId, setGuide, setStep } = useBikeGuidingStore()
  const [diffFilter, setDiffFilter] = useState<number | null>(null)
  const [langFilter, setLangFilter] = useState('')
  const [showFilter, setShowFilter] = useState(false)

  const allLanguages = useMemo(() => {
    const langs = new Set<string>()
    ALL_GUIDES.forEach((g) => g.languages.forEach((l) => langs.add(l)))
    return [...langs].sort()
  }, [])

  const filtered = ALL_GUIDES.filter((g) => {
    if (diffFilter !== null && g.difficulty !== diffFilter) return false
    if (langFilter && !g.languages.includes(langFilter)) return false
    return true
  })

  function handleNext() {
    if (!selectedGuideId) { toast.error('Please select a guide to continue'); return }
    setStep(2)
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Choose your guide</h2>
      <p className="text-sm text-gray-500 mb-4">All guides are certified mountain bike leaders.</p>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setShowFilter((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50">
          <Filter className="w-3.5 h-3.5" /> Filter
          {(diffFilter !== null || langFilter) && <span className="w-2 h-2 rounded-full bg-lime-500" />}
        </button>
        {diffFilter !== null && (
          <button onClick={() => setDiffFilter(null)}
            className="px-3 py-2 bg-lime-100 text-lime-700 rounded-xl text-xs font-medium flex items-center gap-1">
            Level {diffFilter} ×
          </button>
        )}
        {langFilter && (
          <button onClick={() => setLangFilter('')}
            className="px-3 py-2 bg-lime-100 text-lime-700 rounded-xl text-xs font-medium flex items-center gap-1">
            {langFilter} ×
          </button>
        )}
      </div>

      {showFilter && (
        <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-4 space-y-3">
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Trail difficulty</p>
            <div className="flex gap-2">
              {[null, 1, 2, 3, 4, 5].map((d) => (
                <button key={d ?? 'all'} onClick={() => setDiffFilter(d)}
                  className={['flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors', diffFilter === d ? 'bg-lime-500 text-white border-lime-500' : 'border-gray-200 text-gray-600 hover:bg-gray-50'].join(' ')}>
                  {d === null ? 'All' : `★ ${d}`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Language</p>
            <select value={langFilter} onChange={(e) => setLangFilter(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500">
              <option value="">Any language</option>
              {allLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Guide grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm">No guides match your filters.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {filtered.map((guide) => {
            const selected = selectedGuideId === guide.id
            return (
              <button key={guide.id} onClick={() => setGuide(guide.id)}
                className={[
                  'text-left rounded-2xl border p-4 transition-all',
                  selected ? 'border-lime-500 bg-lime-50 shadow-md' : 'border-gray-100 bg-white hover:border-lime-300 hover:shadow-sm',
                ].join(' ')}>
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-lime-100 flex items-center justify-center text-2xl flex-shrink-0">
                    {guide.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-gray-900 text-sm">{guide.name}</p>
                      {selected && <CheckCircle className="w-4 h-4 text-lime-500 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-gray-400">{guide.yearsExp} yrs experience</p>
                    {/* Difficulty stars */}
                    <div className="flex items-center gap-0.5 my-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star key={n} className={['w-3 h-3', n <= guide.difficulty ? 'fill-amber-400 text-amber-400' : 'text-gray-200'].join(' ')} />
                      ))}
                      <span className="text-[10px] text-gray-400 ml-1">Trail level {guide.difficulty}/5</span>
                    </div>
                    {/* Specialities */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      {guide.specialities.map((s) => (
                        <span key={s} className="text-[9px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">{s}</span>
                      ))}
                    </div>
                    {/* Languages */}
                    <div className="flex items-center gap-1 mt-1.5">
                      <Globe className="w-3 h-3 text-gray-400" />
                      <span className="text-[10px] text-gray-400">{guide.languages.join(', ')}</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-3 leading-relaxed">{guide.bio}</p>
              </button>
            )
          })}
        </div>
      )}

      <Button size="lg" className="w-full !bg-lime-500 hover:!bg-lime-600" onClick={handleNext} disabled={!selectedGuideId}>
        Continue with selected guide
      </Button>
    </div>
  )
}

// ─── Step 2: Tour type ────────────────────────────────────────────────────────

function Step2() {
  const { tourType, setTourType, setStep } = useBikeGuidingStore()

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Choose your tour</h2>
      <p className="text-sm text-gray-500 mb-6">Pick the experience that fits your schedule.</p>

      <div className="space-y-3 mb-8">
        {TOUR_OPTIONS.map((opt) => {
          const selected = tourType === opt.id
          return (
            <button key={opt.id} onClick={() => setTourType(opt.id)}
              className={[
                'w-full text-left rounded-2xl border p-5 transition-all',
                selected ? 'border-lime-500 bg-lime-50 shadow-md' : 'border-gray-100 bg-white hover:border-lime-300 hover:shadow-sm',
              ].join(' ')}>
              <div className="flex items-start gap-4">
                <span className="text-3xl">{opt.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <p className="font-bold text-gray-900">{opt.label}</p>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${opt.badgeColor}`}>{opt.badge}</span>
                    {selected && <CheckCircle className="w-4 h-4 text-lime-500 ml-auto" />}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
                    <Clock className="w-3.5 h-3.5" />{opt.duration}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{opt.description}</p>
                  <div className="space-y-1">
                    {opt.exampleTrails.map((trail) => (
                      <div key={trail} className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Check className="w-3 h-3 text-lime-500 shrink-0" />{trail}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(1)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-lime-500 hover:!bg-lime-600" onClick={() => {
          if (!tourType) { toast.error('Please select a tour type'); return }
          setStep(3)
        }}>
          Continue
        </Button>
      </div>
    </div>
  )
}

// ─── Step 3: Date + slot ──────────────────────────────────────────────────────

function Step3() {
  const { service } = useContext(BookingCtx)
  const { selectedDate, selectedSlotId, setDate, setSlot, setStep } = useBikeGuidingStore()
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [loadingDates, setLoadingDates] = useState(false)
  const [loadingSlots, setLoadingSlots] = useState(false)

  useEffect(() => {
    if (!service) return
    setLoadingDates(true)
    getAvailableSlots(service.id, { from: startOfMonth(displayMonth), to: endOfMonth(displayMonth) })
      .then((s) => setAvailableDates(new Set(s.map((sl) => sl.date))))
      .catch(console.error)
      .finally(() => setLoadingDates(false))
  }, [service, displayMonth])

  useEffect(() => {
    if (!service || !selectedDate) return
    setLoadingSlots(true)
    getAvailableSlots(service.id, { from: parseISO(selectedDate), to: parseISO(selectedDate) })
      .then(setSlots)
      .catch(console.error)
      .finally(() => setLoadingSlots(false))
  }, [service, selectedDate])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: startOfMonth(displayMonth), end: endOfMonth(displayMonth) })
  const startPad = (getDay(startOfMonth(displayMonth)) + 6) % 7

  function handleDayClick(dateStr: string) {
    if (dateStr < todayStr || !availableDates.has(dateStr)) {
      if (dateStr >= todayStr) toast.error('No tours available on this date')
      return
    }
    setDate(dateStr)
  }

  function dayClasses(dateStr: string): string {
    const past = dateStr < todayStr
    const avail = availableDates.has(dateStr)
    if (past) return 'text-gray-300 cursor-not-allowed'
    if (dateStr === selectedDate) return 'bg-lime-500 text-white rounded-full font-bold cursor-pointer'
    if (!avail) return 'text-gray-400 cursor-not-allowed'
    if (isToday(parseISO(dateStr))) return 'ring-1 ring-lime-400 text-lime-700 rounded-full cursor-pointer'
    return 'text-gray-700 hover:bg-gray-100 rounded-full cursor-pointer'
  }

  function handleNext() {
    if (!selectedDate) { toast.error('Please select a date'); return }
    if (!selectedSlotId) { toast.error('Please select a time slot'); return }
    setStep(4)
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Select date & time</h2>
      <p className="text-sm text-gray-500 mb-6">Green dates have available spots.</p>

      {/* Calendar */}
      <div className="max-w-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setDisplayMonth((m) => subMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-gray-800">{format(displayMonth, 'MMMM yyyy')}</span>
          <button onClick={() => setDisplayMonth((m) => addMonths(m, 1))} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
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
            return (
              <div key={dateStr} onClick={() => handleDayClick(dateStr)}
                className={['flex flex-col items-center py-1 select-none transition-colors', dayClasses(dateStr)].join(' ')}
                role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && handleDayClick(dateStr)}>
                <span className="text-xs leading-5">{format(day, 'd')}</span>
                {loadingDates
                  ? <span className="w-1 h-1 rounded-full bg-gray-200 animate-pulse" />
                  : <span className={['w-1 h-1 rounded-full', dateStr < todayStr ? 'bg-transparent' : availableDates.has(dateStr) ? 'bg-green-500' : 'bg-gray-200'].join(' ')} />
                }
              </div>
            )
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Available slots for {format(parseISO(selectedDate), 'EEEE, d MMMM')}
          </h3>
          {loadingSlots ? (
            <div className="flex gap-2">
              <Skeleton width="w-24" height="h-12" /><Skeleton width="w-24" height="h-12" />
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm text-gray-400">No slots available for this date.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((slot) => {
                const remaining = slot.capacity_total - slot.capacity_booked
                const active = selectedSlotId === slot.id
                return (
                  <button key={slot.id} onClick={() => setSlot(slot.id, slot.start_time)}
                    className={[
                      'flex flex-col items-center px-4 py-3 rounded-xl border text-sm font-medium transition-all',
                      active ? 'border-lime-500 bg-lime-50 text-lime-700' : 'border-gray-200 hover:border-lime-300 text-gray-700',
                    ].join(' ')}>
                    <span>{slot.start_time.slice(0, 5)}</span>
                    <span className={['text-[10px] font-normal', remaining <= 2 ? 'text-orange-500' : 'text-gray-400'].join(' ')}>
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
        <Button variant="secondary" size="lg" onClick={() => setStep(2)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-lime-500 hover:!bg-lime-600" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 4: Participants ─────────────────────────────────────────────────────

const ParticipantSchema = z.object({
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  age: z.number({ invalid_type_error: 'Required' }).int().min(6, 'Min age 6').max(99),
  fitnessLevel: z.number({ invalid_type_error: 'Required' }).int().min(1).max(5),
})

function ParticipantCard({ index, participant }: { index: number; participant: GuidingParticipant }) {
  const { updateParticipant } = useBikeGuidingStore()
  const [open, setOpen] = useState(index === 0)

  const complete = participant.firstName && participant.lastName && participant.age && participant.fitnessLevel

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
      <button className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-lime-500 text-white text-xs font-bold flex items-center justify-center">{index + 1}</span>
          <span className="text-sm font-medium text-gray-800">
            {participant.firstName && participant.lastName ? `${participant.firstName} ${participant.lastName}` : `Participant ${index + 1}`}
          </span>
          {complete && <CheckCircle2 className="w-4 h-4 text-green-500" />}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">First name</label>
              <input type="text" value={participant.firstName} placeholder="Jan"
                onChange={(e) => updateParticipant(index, { firstName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last name</label>
              <input type="text" value={participant.lastName} placeholder="Novák"
                onChange={(e) => updateParticipant(index, { lastName: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Age</label>
            <input type="number" min={6} max={99} value={participant.age ?? ''}
              onChange={(e) => updateParticipant(index, { age: e.target.value === '' ? null : Number(e.target.value) })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Fitness & riding level</label>
            <FitnessLevelPicker value={participant.fitnessLevel} onChange={(v) => updateParticipant(index, { fitnessLevel: v })} />
          </div>
        </div>
      )}
    </div>
  )
}

function Step4() {
  const { participantCount, participants, setParticipantCount, setStep } = useBikeGuidingStore()
  const [errors, setErrors] = useState<(Record<string, string> | null)[]>([])

  function handleNext() {
    const errs = participants.map((p) => {
      const result = ParticipantSchema.safeParse({ ...p, age: p.age ?? undefined, fitnessLevel: p.fitnessLevel ?? undefined })
      if (result.success) return null
      const map: Record<string, string> = {}
      result.error.errors.forEach((e) => { const k = e.path[0] as string; if (!map[k]) map[k] = e.message })
      return map
    })
    setErrors(errs)
    if (errs.some(Boolean)) { toast.error('Please fill in all participant details'); return }
    setStep(5)
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Participants</h2>
      <p className="text-sm text-gray-500 mb-6">Tell us about everyone joining the tour.</p>

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
        {participants.map((p, i) => <ParticipantCard key={i} index={i} participant={p} />)}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(3)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-lime-500 hover:!bg-lime-600" onClick={handleNext}>Continue</Button>
      </div>
    </div>
  )
}

// ─── Step 5: Bundle ───────────────────────────────────────────────────────────

const RIDING_STYLES: { value: RidingStyle; label: string; icon: string }[] = [
  { value: 'leisure', label: 'Leisure', icon: '🛤️' },
  { value: 'trail', label: 'Trail', icon: '🌲' },
  { value: 'enduro', label: 'Enduro', icon: '🏔️' },
  { value: 'cross_country', label: 'XC', icon: '⚡' },
]

function RentalInlineForm({ index, rental }: { index: number; rental: GuidingRental }) {
  const { updateRental } = useBikeGuidingStore()

  function field<K extends keyof GuidingRental>(key: K) {
    return (val: GuidingRental[K]) => updateRental(index, { [key]: val } as Partial<GuidingRental>)
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-100 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        {(['heightCm', 'weightKg'] as const).map((key) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              {key === 'heightCm' ? 'Height (cm)' : 'Weight (kg)'}
            </label>
            <input type="number" min={key === 'heightCm' ? 100 : 15} max={key === 'heightCm' ? 220 : 250}
              value={(rental[key] as number | null) ?? ''}
              onChange={(e) => field(key)(e.target.value === '' ? null : Number(e.target.value) as any)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-lime-500" />
          </div>
        ))}
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-2">Riding style</label>
        <div className="grid grid-cols-2 gap-2">
          {RIDING_STYLES.map((opt) => (
            <button key={opt.value} type="button" onClick={() => field('ridingStyle')(opt.value)}
              className={['flex items-center gap-2 py-2 px-3 rounded-xl border text-xs font-medium transition-all', rental.ridingStyle === opt.value ? 'border-lime-500 bg-lime-50 text-lime-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'].join(' ')}>
              <span>{opt.icon}</span>{opt.label}
            </button>
          ))}
        </div>
      </div>

      <Toggle checked={rental.ebike} onChange={field('ebike')} label="E-Bike" sub="Pedal-assist (+€10)" />
      <Toggle checked={rental.helmet} onChange={field('helmet')} label="Helmet" />
      <Toggle checked={rental.bodyProtection} onChange={field('bodyProtection')} label="Body protection" sub="Pads for arms, back & knees" />
    </div>
  )
}

function Step5() {
  const { rentalService } = useContext(BookingCtx)
  const { participants, selectedDate, setStep, updateParticipant } = useBikeGuidingStore()
  const [rentalAvailable, setRentalAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    if (!rentalService || !selectedDate) { setRentalAvailable(false); return }
    getAvailableSlots(rentalService.id, { from: parseISO(selectedDate), to: parseISO(selectedDate) })
      .then((slots) => setRentalAvailable(slots.length > 0))
      .catch(() => setRentalAvailable(false))
  }, [rentalService, selectedDate])

  const hasBundle = rentalService !== null

  if (!hasBundle) {
    setStep(6)
    return null
  }

  const rentalCount = participants.filter((p) => p.rentalEnabled).length

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Need a bike too?</h2>
      <p className="text-sm text-gray-500 mb-5">Add a bike rental for the day of your guided tour.</p>

      {rentalAvailable === false && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5 text-sm text-amber-700">
          Bike rental is not available on your selected tour date. You can still book the guided tour.
        </div>
      )}

      {rentalAvailable !== false && (
        <div className="bg-lime-50 border border-lime-100 rounded-xl p-4 mb-5 flex gap-3 items-start">
          <Zap className="w-5 h-5 text-lime-500 shrink-0 mt-0.5" />
          <div className="text-sm text-lime-800">
            <p className="font-semibold">Bike rental is available on your tour date!</p>
            <p className="text-xs mt-0.5 text-lime-700">Enable it per rider below. Rental price is for 1 day (the tour day).</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {participants.map((p, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-lime-100 text-lime-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <span className="text-sm font-medium text-gray-900">
                  {p.firstName && p.lastName ? `${p.firstName} ${p.lastName}` : `Participant ${i + 1}`}
                </span>
              </div>
              <Toggle
                checked={p.rentalEnabled}
                onChange={(v) => updateParticipant(i, { rentalEnabled: v })}
                label=""
              />
            </div>
            {p.rentalEnabled && <RentalInlineForm index={i} rental={p.rental} />}
          </div>
        ))}
      </div>

      <div className="mt-8 flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(4)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-lime-500 hover:!bg-lime-600" onClick={() => setStep(6)}>Continue</Button>
      </div>
      <button onClick={() => { participants.forEach((_, i) => updateParticipant(i, { rentalEnabled: false })); setStep(6) }}
        className="w-full mt-3 text-xs text-gray-400 hover:text-gray-600 transition-colors">
        Skip — guided tour only
      </button>
    </div>
  )
}

// ─── Step 6: Review ───────────────────────────────────────────────────────────

const APRES_RIDE_PRICE = 15

function Step6() {
  const { service, rentalService, operator, resort } = useContext(BookingCtx)
  const { selectedGuideId, tourType, selectedDate, selectedSlotTime, participants, apresRideAddon, setApresRideAddon, termsAccepted, setTermsAccepted, setStep } = useBikeGuidingStore()

  const guide = ALL_GUIDES.find((g) => g.id === selectedGuideId)
  const tour = TOUR_OPTIONS.find((t) => t.id === tourType)
  const rentalParticipants = participants.filter((p) => p.rentalEnabled)
  const hasBundle = rentalParticipants.length > 0

  const schoolTotal = (service?.price_per_person ?? 0) * participants.length
  const rentalTotal = (rentalService?.price_per_person ?? 0) * rentalParticipants.length
  const ebikeExtra = rentalParticipants.filter((p) => p.rental.ebike).length * 10
  const apresTotal = apresRideAddon ? APRES_RIDE_PRICE * participants.length : 0
  const total = schoolTotal + rentalTotal + ebikeExtra + apresTotal
  const currency = service?.currency ?? 'EUR'

  function handleNext() {
    if (!termsAccepted) { toast.error('Please accept the terms to continue'); return }
    setStep(7)
  }

  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Review your booking</h2>
      <p className="text-sm text-gray-500 mb-6">Check everything before payment.</p>

      {hasBundle && (
        <div className="bg-gradient-to-r from-lime-500 to-emerald-500 text-white rounded-2xl px-4 py-2 inline-flex items-center gap-2 mb-5 text-xs font-semibold">
          🚵 Guided Tour + 🚲 Bike Bundle
        </div>
      )}

      <div className="bg-gray-50 rounded-2xl p-4 mb-5 text-sm space-y-1">
        {[
          ['Guide', guide?.name],
          ['Tour type', tour?.label],
          ['Operator', operator?.name],
          ['Resort', resort?.name],
          ['Date', selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy') : '—'],
          ['Start time', selectedSlotTime?.slice(0, 5)],
        ].map(([k, v]) => v ? (
          <div key={k as string} className="flex justify-between">
            <span className="text-gray-500">{k}</span>
            <span className="font-medium text-gray-900">{v}</span>
          </div>
        ) : null)}
      </div>

      {/* Participants */}
      <div className="space-y-2 mb-5">
        {participants.map((p, i) => (
          <div key={i} className="bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{p.firstName} {p.lastName}</span>
              <span className="text-xs text-gray-400">Fitness {p.fitnessLevel}/5</span>
            </div>
            {p.rentalEnabled && (
              <p className="text-xs text-lime-700 mt-1">
                + Bike ({p.rental.ridingStyle ?? '—'}{p.rental.ebike ? ', ⚡ e-bike' : ''}{p.rental.helmet ? ', helmet' : ''}{p.rental.bodyProtection ? ', pads' : ''})
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Après-ride */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900">🍻 Après-ride package</p>
            <p className="text-xs text-gray-400 mt-0.5">Drinks & snacks at the hut after your ride</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600">€{APRES_RIDE_PRICE} × {participants.length} person{participants.length > 1 ? 's' : ''}</span>
            <button onClick={() => setApresRideAddon(!apresRideAddon)}
              className={['w-11 h-6 rounded-full transition-colors relative', apresRideAddon ? 'bg-lime-500' : 'bg-gray-200'].join(' ')}
              role="switch" aria-checked={apresRideAddon}>
              <span className={['absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform', apresRideAddon ? 'translate-x-5' : 'translate-x-0'].join(' ')} />
            </button>
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="bg-white border border-gray-100 rounded-2xl p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pricing</h3>
        <div className="space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>Guided tour ({participants.length} rider{participants.length > 1 ? 's' : ''})</span>
            <span>€{schoolTotal.toFixed(2)}</span>
          </div>
          {rentalParticipants.length > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Bike rental ({rentalParticipants.length} rider{rentalParticipants.length > 1 ? 's' : ''}, 1 day)</span>
              <span>€{rentalTotal.toFixed(2)}</span>
            </div>
          )}
          {ebikeExtra > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>E-bike surcharge</span>
              <span>€{ebikeExtra.toFixed(2)}</span>
            </div>
          )}
          {apresRideAddon && (
            <div className="flex justify-between text-lime-700">
              <span>Après-ride package</span>
              <span>€{apresTotal.toFixed(2)}</span>
            </div>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between font-bold text-base">
          <span>Total</span><span>{currency} {total.toFixed(2)}</span>
        </div>
      </div>

      <label className="flex items-start gap-3 cursor-pointer mb-8">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-lime-500" />
        <span className="text-xs text-gray-600 leading-relaxed">
          I agree to the booking terms. Cancellations must be made 24 hours in advance. The guide's safety instructions must be followed at all times.
        </span>
      </label>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => setStep(5)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-lime-500 hover:!bg-lime-600" onClick={handleNext}>Continue to Payment</Button>
      </div>
    </div>
  )
}

// ─── Step 7: Payment ──────────────────────────────────────────────────────────

function CardPaymentForm() {
  const { service, rentalService, operatorId, resortId } = useContext(BookingCtx)
  const { selectedSlotId, participants, apresRideAddon, setStep, setConfirmedBookingId } = useBikeGuidingStore()
  const { user } = useAuth()
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const rentalParticipants = participants.filter((p) => p.rentalEnabled)
  const ebikeExtra = rentalParticipants.filter((p) => p.rental.ebike).length * 10
  const schoolTotal = (service?.price_per_person ?? 0) * participants.length
  const rentalTotal = (rentalService?.price_per_person ?? 0) * rentalParticipants.length
  const apresTotal = apresRideAddon ? APRES_RIDE_PRICE * participants.length : 0
  const total = schoolTotal + rentalTotal + ebikeExtra + apresTotal
  const bookingType = rentalParticipants.length > 0 ? 'bundle' as const : 'guiding_only' as const

  async function handleConfirm() {
    if (!stripe || !elements || !service || !user || !selectedSlotId) return
    setSubmitting(true)
    try {
      const booking = await createBooking({
        customer_id: user.id,
        operator_id: operatorId,
        resort_id: resortId,
        service_id: service.id,
        availability_slot_id: selectedSlotId,
        type: bookingType,
        total_price: total,
        currency: service.currency,
        stripe_payment_intent_id: null,
        customer_notes: apresRideAddon ? 'Après-ride package requested' : null,
        participants: participants.map((p) => ({
          first_name: p.firstName,
          last_name: p.lastName,
          age: p.age,
          school_data: {
            skill_level: p.fitnessLevel && p.fitnessLevel <= 2 ? 'beginner' as const : p.fitnessLevel === 3 ? 'intermediate' as const : 'advanced' as const,
            instructor_preference: null,
            special_requirements: null,
          },
          rental_data: p.rentalEnabled ? {
            equipment_type: 'bike' as const,
            height_cm: p.rental.heightCm ?? 170,
            weight_kg: p.rental.weightKg ?? 70,
            boot_size: 0,
            helmet_size: p.rental.helmet ? 'M' : '',
            preferred_brand: [
              p.rental.ridingStyle ?? '',
              p.rental.ebike ? 'ebike' : '',
              p.rental.bodyProtection ? 'pads' : '',
            ].filter(Boolean).join(','),
          } : null,
        })),
      })
      setConfirmedBookingId(booking.id)
      setStep(8)
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
        <span>Total to pay</span><span>{service?.currency ?? 'EUR'} {total.toFixed(2)}</span>
      </div>
      <div className="flex gap-3">
        <Button variant="secondary" size="lg" onClick={() => useBikeGuidingStore.getState().setStep(6)}>Back</Button>
        <Button size="lg" className="flex-1 !bg-lime-500 hover:!bg-lime-600" isLoading={submitting} onClick={handleConfirm}>
          Confirm Booking
        </Button>
      </div>
    </div>
  )
}

function Step7() {
  return (
    <div className="max-w-screen-md mx-auto px-4 py-8">
      <h2 className="text-xl font-bold text-gray-900 mb-1">Payment</h2>
      <p className="text-sm text-gray-500 mb-6">Your card details are secured by Stripe.</p>
      <Elements stripe={stripePromise}><CardPaymentForm /></Elements>
    </div>
  )
}

// ─── Step 8: Confirmation ─────────────────────────────────────────────────────

function Step8() {
  const { resort, operator } = useContext(BookingCtx)
  const { confirmedBookingId, selectedGuideId, tourType, selectedDate, selectedSlotTime, participants, apresRideAddon, reset } = useBikeGuidingStore()
  const navigate = useNavigate()

  if (!confirmedBookingId) return null

  const guide = ALL_GUIDES.find((g) => g.id === selectedGuideId)
  const tour = TOUR_OPTIONS.find((t) => t.id === tourType)
  const rentalParticipants = participants.filter((p) => p.rentalEnabled)
  const hasBundle = rentalParticipants.length > 0

  return (
    <div className="max-w-screen-md mx-auto px-4 py-10 text-center">
      <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 className="w-9 h-9 text-green-600" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-1">Ride booked! 🚵‍♂️</h2>
      <p className="text-sm text-gray-500 mb-6">
        Guided by <strong>{guide?.name}</strong> at {operator?.name}, {resort?.name}.
      </p>

      <div className="bg-gray-50 rounded-xl px-4 py-2 inline-block mb-6">
        <p className="text-xs text-gray-400 mb-0.5">Booking reference</p>
        <p className="font-mono text-sm font-bold text-gray-800">{confirmedBookingId.toUpperCase().slice(0, 8)}</p>
      </div>

      <div className="flex flex-col items-center gap-1 mb-8">
        <QRDisplay bookingId={confirmedBookingId} />
        <p className="text-xs text-gray-400 mt-1">Show this at the meeting point</p>
      </div>

      {/* Tour details */}
      <div className="bg-lime-50 border border-lime-100 rounded-2xl p-4 mb-4 text-sm text-left">
        <p className="font-semibold text-lime-800 mb-2">Tour details</p>
        {[
          ['Guide', `${guide?.emoji} ${guide?.name}`],
          ['Tour', tour?.label],
          ['Date', selectedDate ? format(parseISO(selectedDate), 'EEEE, d MMMM yyyy') : '—'],
          ['Meeting time', selectedSlotTime?.slice(0, 5)],
          ['Riders', `${participants.length} person${participants.length > 1 ? 's' : ''}`],
          ...(apresRideAddon ? [['Après-ride', '🍻 Included']] : []),
        ].map(([k, v]) => (
          <div key={k as string} className="flex justify-between mb-1">
            <span className="text-gray-500">{k}</span>
            <span className="font-medium text-gray-800">{v}</span>
          </div>
        ))}
      </div>

      {/* Bike details */}
      {hasBundle && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 text-sm text-left">
          <p className="font-semibold text-amber-800 mb-2">🚲 Bike rental included</p>
          {rentalParticipants.map((p, i) => (
            <p key={i} className="text-xs text-gray-600 mb-0.5">
              {p.firstName} {p.lastName}: {p.rental.ridingStyle ?? '—'}{p.rental.ebike ? ' ⚡' : ''}{p.rental.helmet ? ', helmet' : ''}{p.rental.bodyProtection ? ', pads' : ''}
            </p>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mb-8">Your guide and equipment will be ready when you arrive at the meeting point.</p>

      <div className="flex flex-col gap-3">
        <Link to="/my-trips" className="text-lime-600 hover:text-lime-700 font-medium text-sm">View in My Trips →</Link>
        <button onClick={() => { reset(); navigate('/') }} className="text-gray-400 hover:text-gray-600 text-sm">Back to home</button>
      </div>
    </div>
  )
}

// ─── Main coordinator ─────────────────────────────────────────────────────────

export default function BikeGuidingBooking() {
  const { operatorId, resortId } = useParams<{ operatorId: string; resortId: string }>()
  const navigate = useNavigate()
  const { season } = useSeasonStore()
  const { step } = useBikeGuidingStore()

  const [service, setService] = useState<Service | null>(null)
  const [rentalService, setRentalService] = useState<Service | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [resort, setResort] = useState<Resort | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const hasBundle = rentalService !== null

  function next(from: number) {
    if (from === 4 && !hasBundle) { useBikeGuidingStore.getState().setStep(6); return }
    useBikeGuidingStore.getState().setStep(from + 1)
  }

  function back(from: number) {
    if (from === 6 && !hasBundle) { useBikeGuidingStore.getState().setStep(4); return }
    useBikeGuidingStore.getState().setStep(from - 1)
  }

  useEffect(() => {
    if (!operatorId || !resortId) return
    setLoading(true)
    Promise.all([getServicesByOperator(operatorId, resortId), getOperatorById(operatorId), getResortById(resortId)])
      .then(([services, op, res]) => {
        const svc = services.find((s) => s.type === 'bike_guiding')
        if (!svc) { setError('No bike guiding service found for this operator.'); return }
        const rental = services.find((s) => s.type === 'bike_rental') ?? null
        setService(svc); setRentalService(rental); setOperator(op); setResort(res)
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
    <BookingCtx.Provider value={{ operatorId: operatorId!, resortId: resortId!, service, rentalService, operator, resort }}>
      <div className="min-h-screen pb-8">
        <ProgressBar step={step} hasBundle={hasBundle} />
        {step === 1 && <Step1 />}
        {step === 2 && <Step2 />}
        {step === 3 && <Step3 />}
        {step === 4 && <Step4 />}
        {step === 5 && hasBundle && <Step5 />}
        {step === 6 && <Step6 />}
        {step === 7 && <Step7 />}
        {step === 8 && <Step8 />}
      </div>
    </BookingCtx.Provider>
  )
}
