import { useEffect, useState, useMemo } from 'react'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import {
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  Users,
  Calendar,
  Clock,
  Loader2,
  BadgeCheck,
  X,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getBookingsByOperator, updateBookingStatus } from '../../lib/supabase/bookings'
import { getServiceById } from '../../lib/supabase/services'
import { getSlotById } from '../../lib/supabase/availability'
import type {
  Booking,
  BookingParticipant,
  BookingStatus,
  Operator,
  Service,
  AvailabilitySlot,
  SkillLevel,
} from '../../types'

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

interface EnrichedBooking {
  booking: BookingWithParticipants
  service: Service
  slot: AvailabilitySlot
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  arrived: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
}

const NEXT_STATUS: Partial<Record<BookingStatus, { status: BookingStatus; label: string; color: string }>> = {
  pending: { status: 'confirmed', label: 'Confirm', color: 'bg-green-600 text-white' },
  confirmed: { status: 'arrived', label: 'Mark arrived', color: 'bg-blue-600 text-white' },
  arrived: { status: 'completed', label: 'Complete', color: 'bg-slate-700 text-white' },
}

const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

function dateLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEE, d MMM')
}

// ── Booking card ─────────────────────────────────────────────────────────────

function BookingCard({
  enriched,
  onStatusChange,
}: {
  enriched: EnrichedBooking
  onStatusChange: (bookingId: string, status: BookingStatus) => void
}) {
  const { booking, service, slot } = enriched
  const [expanded, setExpanded] = useState(false)
  const [busy, setBusy] = useState(false)

  const participants = booking.booking_participants ?? []
  const next = NEXT_STATUS[booking.status]

  async function advance() {
    if (!next) return
    setBusy(true)
    try {
      await updateBookingStatus(booking.id, next.status)
      onStatusChange(booking.id, next.status)
      toast.success(`Booking marked as ${STATUS_LABELS[next.status].toLowerCase()}`)
    } catch {
      toast.error('Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900 text-sm">
              {participants[0]
                ? `${participants[0].first_name} ${participants[0].last_name}`
                : `#${booking.id.slice(0, 6).toUpperCase()}`}
              {participants.length > 1 && (
                <span className="text-gray-400 font-normal ml-1">+{participants.length - 1}</span>
              )}
            </p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[booking.status]}`}>
              {STATUS_LABELS[booking.status]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">{service.name}</p>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {dateLabel(slot.date)}
            </span>
            {slot.start_time && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {slot.start_time.slice(0, 5)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {participants.length} pax
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <p className="text-sm font-bold text-gray-900">
            {booking.currency} {booking.total_price.toFixed(2)}
          </p>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 pb-4">
          {/* Participants */}
          <div className="mt-3 space-y-2">
            {participants.map((p, i) => (
              <div key={p.id} className="bg-gray-50 rounded-xl p-3">
                <p className="text-sm font-medium text-gray-800">
                  {i + 1}. {p.first_name} {p.last_name}
                  {p.age != null && <span className="text-gray-400 font-normal ml-1">· {p.age} yrs</span>}
                </p>

                {p.school_data && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-gray-500">
                      Skill: <span className="font-medium text-gray-700">{SKILL_LABELS[p.school_data.skill_level]}</span>
                    </p>
                    {p.school_data.special_requirements && (
                      <p className="text-xs text-gray-500">
                        Notes: <span className="font-medium text-gray-700">{p.school_data.special_requirements}</span>
                      </p>
                    )}
                  </div>
                )}

                {p.rental_data && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-gray-500">
                      {p.rental_data.equipment_type === 'ski' ? 'Skis' : 'Snowboard'} ·{' '}
                      {p.rental_data.height_cm} cm · {p.rental_data.weight_kg} kg · EU {p.rental_data.boot_size}
                      {p.rental_data.helmet_size && ` · Helmet ${p.rental_data.helmet_size}`}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Booking ID */}
          <p className="text-xs text-gray-300 mt-3 font-mono text-center">
            {booking.id}
          </p>

          {/* Action */}
          {next && booking.status !== 'cancelled' && (
            <button
              onClick={advance}
              disabled={busy}
              className={`w-full mt-3 py-3 rounded-xl text-sm font-semibold transition-opacity ${next.color} disabled:opacity-50`}
            >
              {busy ? 'Updating…' : next.label}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

type StatusFilter = BookingStatus | 'all'

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Pending' },
  { id: 'arrived', label: 'Arrived' },
  { id: 'completed', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
]

export default function OperatorBookings() {
  const { user } = useAuth()
  const [operator, setOperator] = useState<Operator | null>(null)
  const [enriched, setEnriched] = useState<EnrichedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const op = await getOperatorByProfileId(user!.id)
        if (!op) { setLoading(false); return }
        setOperator(op)

        const bookings = await getBookingsByOperator(op.id) as BookingWithParticipants[]

        const uniqueServiceIds = [...new Set(bookings.map((b) => b.service_id))]
        const uniqueSlotIds = [...new Set(bookings.map((b) => b.availability_slot_id))]

        const [services, slots] = await Promise.all([
          Promise.all(uniqueServiceIds.map((id) => getServiceById(id))),
          Promise.all(uniqueSlotIds.map((id) => getSlotById(id))),
        ])

        const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]))
        const slotMap = Object.fromEntries(slots.map((s) => [s.id, s]))

        setEnriched(
          bookings
            .filter((b) => serviceMap[b.service_id] && slotMap[b.availability_slot_id])
            .map((b) => ({
              booking: b,
              service: serviceMap[b.service_id],
              slot: slotMap[b.availability_slot_id],
            })),
        )
      } catch (err) {
        toast.error('Could not load bookings')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  function handleStatusChange(bookingId: string, status: BookingStatus) {
    setEnriched((prev) =>
      prev.map((e) =>
        e.booking.id === bookingId
          ? { ...e, booking: { ...e.booking, status } }
          : e,
      ),
    )
  }

  const filtered = useMemo(() => {
    let list = enriched
    if (statusFilter !== 'all') {
      list = list.filter((e) => e.booking.status === statusFilter)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((e) => {
        const participantMatch = e.booking.booking_participants?.some(
          (p) =>
            p.first_name.toLowerCase().includes(q) ||
            p.last_name.toLowerCase().includes(q),
        )
        const idMatch = e.booking.id.toLowerCase().includes(q)
        const serviceMatch = e.service.name.toLowerCase().includes(q)
        return participantMatch || idMatch || serviceMatch
      })
    }
    return list
  }, [enriched, statusFilter, query])

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Bookings</h1>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, booking ID, service…"
            className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {query && (
            <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>

        {/* Status tabs */}
        <div className="flex gap-0 overflow-x-auto pb-0 -mx-4 px-4 scrollbar-hide">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`
                py-2.5 px-1 mr-4 text-sm font-medium border-b-2 flex-shrink-0 transition-colors
                ${statusFilter === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'}
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
          </div>
        ) : !operator ? (
          <div className="text-center py-16 text-gray-400 text-sm">No operator profile linked</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <BadgeCheck className="w-10 h-10 mb-3" />
            <p className="font-medium text-gray-600">No bookings</p>
            <p className="text-sm mt-1">
              {query ? 'Try a different search' : 'No bookings match this filter'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-1">
              {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'}
            </p>
            {filtered.map((e) => (
              <BookingCard
                key={e.booking.id}
                enriched={e}
                onStatusChange={handleStatusChange}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
