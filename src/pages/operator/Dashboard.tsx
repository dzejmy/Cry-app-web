import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, parseISO, isToday, startOfMonth, endOfMonth } from 'date-fns'
import {
  CalendarCheck,
  ScanLine,
  Users,
  TrendingUp,
  ClipboardList,
  Loader2,
  AlertCircle,
  ChevronRight,
  Star,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getBookingsByOperator } from '../../lib/supabase/bookings'
import { getSlotById } from '../../lib/supabase/availability'
import type { Booking, BookingParticipant, BookingStatus, Operator, AvailabilitySlot } from '../../types'

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

interface EnrichedBooking {
  booking: BookingWithParticipants
  slot: AvailabilitySlot
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  arrived: 'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  arrived: 'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ElementType
  color: string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function QuickAction({
  to,
  icon: Icon,
  label,
  desc,
  color,
}: {
  to: string
  icon: React.ElementType
  label: string
  desc: string
  color: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
    >
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [operator, setOperator] = useState<Operator | null>(null)
  const [enriched, setEnriched] = useState<EnrichedBooking[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const op = await getOperatorByProfileId(user!.id)
        if (!op) { setLoading(false); return }
        setOperator(op)

        const bookings = await getBookingsByOperator(op.id) as BookingWithParticipants[]

        const uniqueSlotIds = [...new Set(bookings.map((b) => b.availability_slot_id))]
        const slots = await Promise.all(uniqueSlotIds.map((id) => getSlotById(id)))
        const slotMap = Object.fromEntries(slots.map((s) => [s.id, s]))

        setEnriched(
          bookings
            .filter((b) => slotMap[b.availability_slot_id])
            .map((b) => ({ booking: b, slot: slotMap[b.availability_slot_id] })),
        )
      } catch (err) {
        toast.error('Could not load dashboard data')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-7 h-7 animate-spin text-blue-500" />
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-3 px-8 text-center">
        <AlertCircle className="w-10 h-10" />
        <p className="font-medium text-gray-600">No operator profile found</p>
        <p className="text-sm">Your account hasn't been linked to an operator yet. Contact support.</p>
      </div>
    )
  }

  const today = new Date()
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const activeBookings = enriched.filter(
    (e) => e.booking.status !== 'cancelled',
  )
  const todayBookings = activeBookings.filter((e) => isToday(parseISO(e.slot.date)))
  const monthBookings = activeBookings.filter((e) => {
    const d = parseISO(e.slot.date)
    return d >= monthStart && d <= monthEnd
  })
  const monthRevenue = monthBookings.reduce((sum, e) => sum + e.booking.total_price, 0)
  const pendingCount = enriched.filter((e) => e.booking.status === 'pending').length

  // Recent bookings (last 5, non-cancelled)
  const recentBookings = activeBookings.slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
        <p className="text-sm text-gray-400">Good {today.getHours() < 12 ? 'morning' : today.getHours() < 17 ? 'afternoon' : 'evening'}</p>
        <h1 className="text-2xl font-bold text-gray-900">{operator.name}</h1>
        {operator.verified && (
          <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
            <Star className="w-3.5 h-3.5 fill-blue-600" />
            <span>Verified operator</span>
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-5">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Today's bookings"
            value={todayBookings.length}
            icon={CalendarCheck}
            color="bg-blue-50 text-blue-600"
          />
          <StatCard
            label="Pending payment"
            value={pendingCount}
            icon={ClipboardList}
            color={pendingCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}
          />
          <StatCard
            label="This month"
            value={monthBookings.length}
            sub="bookings"
            icon={Users}
            color="bg-violet-50 text-violet-600"
          />
          <StatCard
            label="Monthly revenue"
            value={`€${monthRevenue.toFixed(0)}`}
            icon={TrendingUp}
            color="bg-emerald-50 text-emerald-600"
          />
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Quick actions</h2>
          <div className="space-y-2">
            <QuickAction
              to="/operator/check-in"
              icon={ScanLine}
              label="QR Check-In"
              desc="Scan customer QR codes at arrival"
              color="bg-blue-50 text-blue-600"
            />
            <QuickAction
              to="/operator/bookings"
              icon={ClipboardList}
              label="All Bookings"
              desc="View and manage reservations"
              color="bg-violet-50 text-violet-600"
            />
          </div>
        </div>

        {/* Today's schedule */}
        <div>
          <h2 className="text-sm font-semibold text-gray-700 mb-2">
            Today's schedule
            {todayBookings.length > 0 && (
              <span className="ml-2 text-xs font-medium px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                {todayBookings.length}
              </span>
            )}
          </h2>

          {todayBookings.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <p className="text-sm text-gray-400">No bookings for today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayBookings.map((e) => (
                <Link
                  key={e.booking.id}
                  to={`/operator/bookings`}
                  className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {e.booking.booking_participants?.[0]
                        ? `${e.booking.booking_participants[0].first_name} ${e.booking.booking_participants[0].last_name}`
                        : `Booking #${e.booking.id.slice(0, 6).toUpperCase()}`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {e.booking.booking_participants?.length ?? 1} pax ·{' '}
                      {e.slot.start_time?.slice(0, 5) ?? 'All day'} ·{' '}
                      {e.booking.currency} {e.booking.total_price.toFixed(2)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[e.booking.status]}`}>
                    {STATUS_LABELS[e.booking.status]}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent bookings */}
        {recentBookings.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-gray-700">Recent bookings</h2>
              <Link to="/operator/bookings" className="text-xs text-blue-600 font-medium">
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {recentBookings.map((e) => (
                <div
                  key={e.booking.id}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {e.booking.booking_participants?.[0]
                        ? `${e.booking.booking_participants[0].first_name} ${e.booking.booking_participants[0].last_name}`
                        : `#${e.booking.id.slice(0, 6).toUpperCase()}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {format(parseISO(e.slot.date), 'd MMM')} ·{' '}
                      {e.booking.currency} {e.booking.total_price.toFixed(2)}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[e.booking.status]}`}>
                    {STATUS_LABELS[e.booking.status]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
