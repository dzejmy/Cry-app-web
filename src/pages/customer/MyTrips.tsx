import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, isPast } from 'date-fns'
import {
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  Package,
  GraduationCap,
  Bike,
  Mountain,
  Ticket,
  Sparkles,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getBookingsByCustomer } from '../../lib/supabase/bookings'
import { getOperatorById } from '../../lib/supabase/operators'
import { getResortById } from '../../lib/supabase/resorts'
import { getServiceById } from '../../lib/supabase/services'
import { getSlotById } from '../../lib/supabase/availability'
import { SkeletonCard } from '../../components/ui/Skeleton'
import type {
  Booking,
  BookingParticipant,
  BookingStatus,
  Operator,
  Resort,
  Service,
  AvailabilitySlot,
} from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

interface EnrichedTrip {
  booking: BookingWithParticipants
  operator: Operator
  resort: Resort
  service: Service
  slot: AvailabilitySlot
}

type TripTab = 'upcoming' | 'past' | 'cancelled'

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  arrived:   'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
}

const SERVICE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  ski_school:   { icon: GraduationCap, label: 'Ski School',   color: 'bg-sky-50 text-sky-600' },
  ski_rental:   { icon: Package,       label: 'Ski Rental',   color: 'bg-blue-50 text-blue-600' },
  bike_guiding: { icon: Mountain,      label: 'Bike Guiding', color: 'bg-lime-50 text-lime-700' },
  bike_rental:  { icon: Bike,          label: 'Bike Rental',  color: 'bg-amber-50 text-amber-600' },
}

function tabForBooking(booking: BookingWithParticipants, slot: AvailabilitySlot): TripTab {
  if (booking.status === 'cancelled') return 'cancelled'
  if (booking.status === 'completed' || isPast(parseISO(slot.date))) return 'past'
  return 'upcoming'
}

// ── Skeleton trip card ────────────────────────────────────────────────────────

function TripCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-200 animate-pulse shrink-0" />
        <div className="flex-1 space-y-1.5">
          <div className="h-4 bg-gray-200 rounded-md animate-pulse w-2/3" />
          <div className="h-3 bg-gray-100 rounded-md animate-pulse w-1/3" />
        </div>
        <div className="h-6 w-20 bg-gray-100 rounded-full animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded animate-pulse w-4/5" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-3/5" />
        <div className="h-3 bg-gray-100 rounded animate-pulse w-1/2" />
      </div>
      <div className="pt-2 border-t border-gray-50 flex justify-between">
        <div className="h-5 w-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-28 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    </div>
  )
}

// ── Trip card ─────────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: EnrichedTrip }) {
  const { booking, operator, resort, service, slot } = trip
  const meta = SERVICE_META[service.type] ?? { icon: Ticket, label: service.type, color: 'bg-gray-100 text-gray-600' }
  const Icon = meta.icon
  const participantCount = booking.booking_participants?.length ?? 1
  const isBundle = booking.type === 'bundle'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-gray-900 text-sm leading-tight">{meta.label}</p>
                {isBundle && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    <Sparkles className="w-2.5 h-2.5" /> Bundle
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{operator.name}</p>
            </div>
          </div>
          <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0 ${STATUS_COLORS[booking.status]}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span>{format(parseISO(slot.date), 'EEE, d MMM yyyy')}</span>
            {slot.start_time && (
              <span className="text-gray-400">· {slot.start_time.slice(0, 5)}{slot.end_time ? ` – ${slot.end_time.slice(0, 5)}` : ''}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>{resort.name}, {resort.country}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5 shrink-0" />
            <span>{participantCount} {participantCount === 1 ? 'participant' : 'participants'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">
            {booking.currency} {booking.total_price.toFixed(2)}
          </span>
          <Link
            to={`/trips/${booking.id}`}
            className="flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl transition-colors"
          >
            View Details
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── Empty states ──────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TripTab }) {
  const content: Record<TripTab, { emoji: string; title: string; body: string; cta?: { label: string; to: string } }> = {
    upcoming: {
      emoji: '🏔️',
      title: 'No upcoming adventures',
      body: 'Book a lesson, rental, or guided tour to fill this page with something exciting.',
      cta: { label: 'Browse resorts', to: '/resorts' },
    },
    past: {
      emoji: '📸',
      title: 'No trips yet',
      body: 'Your completed mountains and bike trails will live here after you explore them.',
    },
    cancelled: {
      emoji: '✋',
      title: 'No cancellations',
      body: "You're on a clean streak — no cancelled bookings.",
    },
  }
  const { emoji, title, body, cta } = content[tab]

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center px-8">
      <span className="text-6xl mb-5 leading-none">{emoji}</span>
      <p className="font-bold text-gray-800 text-lg mb-2">{title}</p>
      <p className="text-sm text-gray-400 leading-relaxed max-w-[280px]">{body}</p>
      {cta && (
        <Link
          to={cta.to}
          className="mt-6 px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
        >
          {cta.label}
        </Link>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MyTrips() {
  const { user } = useAuth()
  const [trips, setTrips] = useState<EnrichedTrip[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TripTab>('upcoming')

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const bookings = await getBookingsByCustomer(user!.id) as BookingWithParticipants[]

        const uniqueOperatorIds = [...new Set(bookings.map((b) => b.operator_id))]
        const uniqueResortIds   = [...new Set(bookings.map((b) => b.resort_id))]
        const uniqueServiceIds  = [...new Set(bookings.map((b) => b.service_id))]
        const uniqueSlotIds     = [...new Set(bookings.map((b) => b.availability_slot_id))]

        const [operators, resorts, services, slots] = await Promise.all([
          Promise.all(uniqueOperatorIds.map((id) => getOperatorById(id))),
          Promise.all(uniqueResortIds.map((id) => getResortById(id))),
          Promise.all(uniqueServiceIds.map((id) => getServiceById(id))),
          Promise.all(uniqueSlotIds.map((id) => getSlotById(id))),
        ])

        const operatorMap = Object.fromEntries(operators.map((o) => [o.id, o]))
        const resortMap   = Object.fromEntries(resorts.map((r) => [r.id, r]))
        const serviceMap  = Object.fromEntries(services.map((s) => [s.id, s]))
        const slotMap     = Object.fromEntries(slots.map((s) => [s.id, s]))

        const enriched: EnrichedTrip[] = bookings
          .filter(
            (b) =>
              operatorMap[b.operator_id] &&
              resortMap[b.resort_id] &&
              serviceMap[b.service_id] &&
              slotMap[b.availability_slot_id],
          )
          .map((b) => ({
            booking:  b,
            operator: operatorMap[b.operator_id],
            resort:   resortMap[b.resort_id],
            service:  serviceMap[b.service_id],
            slot:     slotMap[b.availability_slot_id],
          }))

        setTrips(enriched)
      } catch (err) {
        toast.error('Could not load your trips')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  const grouped = useMemo(() => {
    const result: Record<TripTab, EnrichedTrip[]> = { upcoming: [], past: [], cancelled: [] }
    for (const trip of trips) {
      result[tabForBooking(trip.booking, trip.slot)].push(trip)
    }
    result.upcoming.sort((a, b) => parseISO(a.slot.date).getTime() - parseISO(b.slot.date).getTime())
    result.past.sort((a, b) => parseISO(b.slot.date).getTime() - parseISO(a.slot.date).getTime())
    result.cancelled.sort(
      (a, b) => new Date(b.booking.created_at).getTime() - new Date(a.booking.created_at).getTime(),
    )
    return result
  }, [trips])

  const TABS: { id: TripTab; label: string }[] = [
    {
      id: 'upcoming',
      label: !loading && grouped.upcoming.length ? `Upcoming (${grouped.upcoming.length})` : 'Upcoming',
    },
    {
      id: 'past',
      label: !loading && grouped.past.length ? `Past (${grouped.past.length})` : 'Past',
    },
    { id: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-0 sticky top-16 z-10">
        <div className="max-w-screen-md mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">My Trips</h1>

          <div className="flex -mx-4 px-4 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={[
                  'py-2.5 px-1 mr-6 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 pt-5 max-w-screen-md mx-auto">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <TripCardSkeleton key={i} />)}
          </div>
        ) : grouped[activeTab].length === 0 ? (
          <EmptyState tab={activeTab} />
        ) : (
          <div className="space-y-3">
            {grouped[activeTab].map((trip) => (
              <TripCard key={trip.booking.id} trip={trip} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
