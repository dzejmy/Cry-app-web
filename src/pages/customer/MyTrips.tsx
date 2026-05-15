import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, isFuture, isPast } from 'date-fns'
import {
  MapPin,
  Calendar,
  Users,
  ChevronRight,
  Package,
  GraduationCap,
  Bike,
  Mountain,
  Loader2,
  Ticket,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getBookingsByCustomer } from '../../lib/supabase/bookings'
import { getOperatorById } from '../../lib/supabase/operators'
import { getResortById } from '../../lib/supabase/resorts'
import { getServiceById } from '../../lib/supabase/services'
import { getSlotById } from '../../lib/supabase/availability'
import type {
  Booking,
  BookingParticipant,
  BookingStatus,
  Operator,
  Resort,
  Service,
  AvailabilitySlot,
} from '../../types'

// ── Types ────────────────────────────────────────────────────────────────────

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

interface EnrichedTrip {
  booking: BookingWithParticipants
  operator: Operator
  resort: Resort
  service: Service
  slot: AvailabilitySlot
}

type TripTab = 'upcoming' | 'past' | 'cancelled'

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

const SERVICE_ICONS: Record<string, React.ElementType> = {
  ski_school: GraduationCap,
  ski_rental: Package,
  bike_guiding: Mountain,
  bike_rental: Bike,
}

function serviceIcon(type: string) {
  const Icon = SERVICE_ICONS[type] ?? Ticket
  return Icon
}

function tabForBooking(booking: BookingWithParticipants, slot: AvailabilitySlot): TripTab {
  if (booking.status === 'cancelled') return 'cancelled'
  const slotDate = parseISO(slot.date)
  if (booking.status === 'completed' || isPast(slotDate)) return 'past'
  return 'upcoming'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: EnrichedTrip }) {
  const { booking, operator, resort, service, slot } = trip
  const Icon = serviceIcon(service.type)
  const participantCount = booking.booking_participants?.length ?? 1

  return (
    <Link
      to={`/my-trips/${booking.id}`}
      className="block bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all duration-200"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">{service.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{operator.name}</p>
            </div>
          </div>
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[booking.status]}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>

        {/* Details */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(parseISO(slot.date), 'EEE, d MMM yyyy')}</span>
            {slot.start_time && (
              <span className="text-gray-400">· {slot.start_time.slice(0, 5)}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="w-3.5 h-3.5" />
            <span>{resort.name}, {resort.country}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>{participantCount} {participantCount === 1 ? 'participant' : 'participants'}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between">
          <span className="text-sm font-bold text-gray-900">
            {booking.currency} {booking.total_price.toFixed(2)}
          </span>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    </Link>
  )
}

function EmptyState({ tab }: { tab: TripTab }) {
  const messages: Record<TripTab, { emoji: string; title: string; body: string }> = {
    upcoming: {
      emoji: '🏔️',
      title: 'No upcoming trips',
      body: 'Book a ski lesson, rental, or bike experience to get started.',
    },
    past: {
      emoji: '📸',
      title: 'No past trips yet',
      body: 'Your completed adventures will appear here.',
    },
    cancelled: {
      emoji: '✋',
      title: 'No cancellations',
      body: "You haven't cancelled any bookings.",
    },
  }
  const { emoji, title, body } = messages[tab]

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="text-5xl mb-4">{emoji}</span>
      <p className="font-semibold text-gray-700 mb-1">{title}</p>
      <p className="text-sm text-gray-400 max-w-xs">{body}</p>
      {tab === 'upcoming' && (
        <Link
          to="/resorts"
          className="mt-5 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          Explore resorts
        </Link>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

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

        // Batch-fetch unique related entities
        const uniqueOperatorIds = [...new Set(bookings.map((b) => b.operator_id))]
        const uniqueResortIds = [...new Set(bookings.map((b) => b.resort_id))]
        const uniqueServiceIds = [...new Set(bookings.map((b) => b.service_id))]
        const uniqueSlotIds = [...new Set(bookings.map((b) => b.availability_slot_id))]

        const [operators, resorts, services, slots] = await Promise.all([
          Promise.all(uniqueOperatorIds.map((id) => getOperatorById(id))),
          Promise.all(uniqueResortIds.map((id) => getResortById(id))),
          Promise.all(uniqueServiceIds.map((id) => getServiceById(id))),
          Promise.all(uniqueSlotIds.map((id) => getSlotById(id))),
        ])

        const operatorMap = Object.fromEntries(operators.map((o) => [o.id, o]))
        const resortMap = Object.fromEntries(resorts.map((r) => [r.id, r]))
        const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]))
        const slotMap = Object.fromEntries(slots.map((s) => [s.id, s]))

        const enriched: EnrichedTrip[] = bookings
          .filter(
            (b) =>
              operatorMap[b.operator_id] &&
              resortMap[b.resort_id] &&
              serviceMap[b.service_id] &&
              slotMap[b.availability_slot_id],
          )
          .map((b) => ({
            booking: b,
            operator: operatorMap[b.operator_id],
            resort: resortMap[b.resort_id],
            service: serviceMap[b.service_id],
            slot: slotMap[b.availability_slot_id],
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
    // Upcoming: soonest first; past/cancelled: newest first
    result.upcoming.sort(
      (a, b) => parseISO(a.slot.date).getTime() - parseISO(b.slot.date).getTime(),
    )
    result.past.sort(
      (a, b) => parseISO(b.slot.date).getTime() - parseISO(a.slot.date).getTime(),
    )
    result.cancelled.sort(
      (a, b) => new Date(b.booking.created_at).getTime() - new Date(a.booking.created_at).getTime(),
    )
    return result
  }, [trips])

  const TABS: { id: TripTab; label: string }[] = [
    { id: 'upcoming', label: `Upcoming${grouped.upcoming.length ? ` (${grouped.upcoming.length})` : ''}` },
    { id: 'past', label: `Past${grouped.past.length ? ` (${grouped.past.length})` : ''}` },
    { id: 'cancelled', label: 'Cancelled' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-0">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My Trips</h1>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-gray-100 -mx-4 px-4">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                py-2.5 px-1 mr-5 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
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
      <div className="px-4 pt-5">
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
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
