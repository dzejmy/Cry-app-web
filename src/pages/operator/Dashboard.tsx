import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  format, parseISO, isToday,
  startOfWeek, endOfWeek,
} from 'date-fns'
import {
  CalendarCheck, ScanLine, Users, TrendingUp,
  ClipboardList, Loader2, AlertCircle, ChevronRight,
  Star, Wrench, CalendarDays, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getBookingsByOperator } from '../../lib/supabase/bookings'
import { getSlotById } from '../../lib/supabase/availability'
import { getInventoryByOperator } from '../../lib/supabase/inventory'
import { getServiceById } from '../../lib/supabase/services'
import type {
  Booking, BookingParticipant, BookingStatus, Operator, AvailabilitySlot, Service,
} from '../../types'

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

interface EnrichedBooking {
  booking: BookingWithParticipants
  slot: AvailabilitySlot
  service: Service
}

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  arrived:   'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  arrived:   'Arrived',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function StatCard({
  label, value, sub, icon: Icon, color, to,
}: {
  label: string; value: string | number; sub?: string
  icon: React.ElementType; color: string; to?: string
}) {
  const inner = (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col gap-2">
      <div className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
  return to ? <Link to={to}>{inner}</Link> : inner
}

function QuickAction({
  to, icon: Icon, label, desc, color,
}: {
  to: string; icon: React.ElementType; label: string; desc: string; color: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow active:scale-[0.98]"
    >
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 text-sm">{label}</p>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
    </Link>
  )
}

export default function Dashboard() {
  const { user } = useAuth()
  const [operator, setOperator] = useState<Operator | null>(null)
  const [enriched, setEnriched] = useState<EnrichedBooking[]>([])
  const [equipmentOut, setEquipmentOut] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const op = await getOperatorByProfileId(user!.id)
        if (!op) { setLoading(false); return }
        setOperator(op)

        const [bookings, inventory] = await Promise.all([
          getBookingsByOperator(op.id) as Promise<BookingWithParticipants[]>,
          getInventoryByOperator(op.id).catch(() => []),
        ])

        setEquipmentOut(
          inventory.reduce((sum, item) => sum + Math.max(0, item.quantity_total - item.quantity_available), 0),
        )

        const uniqueSlotIds    = [...new Set(bookings.map((b) => b.availability_slot_id))]
        const uniqueServiceIds = [...new Set(bookings.map((b) => b.service_id))]

        const [slots, services] = await Promise.all([
          Promise.all(uniqueSlotIds.map((id) => getSlotById(id))),
          Promise.all(uniqueServiceIds.map((id) => getServiceById(id))),
        ])

        const slotMap    = Object.fromEntries(slots.map((s) => [s.id, s]))
        const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]))

        setEnriched(
          bookings
            .filter((b) => slotMap[b.availability_slot_id] && serviceMap[b.service_id])
            .map((b) => ({
              booking: b,
              slot:    slotMap[b.availability_slot_id],
              service: serviceMap[b.service_id],
            })),
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
        <Loader2 className="w-7 h-7 animate-spin text-violet-500" />
      </div>
    )
  }

  if (!operator) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-3 px-8 text-center">
        <AlertCircle className="w-10 h-10" />
        <p className="font-medium text-gray-600">No operator profile found</p>
        <p className="text-sm">Your account hasn't been linked to an operator. Contact support.</p>
      </div>
    )
  }

  const now = new Date()
  const weekStart = startOfWeek(now, { weekStartsOn: 1 })
  const weekEnd   = endOfWeek(now, { weekStartsOn: 1 })

  const active   = enriched.filter((e) => e.booking.status !== 'cancelled')
  const todayAll = active.filter((e) => isToday(parseISO(e.slot.date)))
  const weekRevenue = active
    .filter((e) => {
      const d = parseISO(e.slot.date)
      return d >= weekStart && d <= weekEnd
    })
    .reduce((sum, e) => sum + e.booking.total_price, 0)

  const todayConfirmed  = todayAll.filter((e) => e.booking.status === 'confirmed' || e.booking.status === 'pending')
  const todaySorted     = [...todayAll].sort((a, b) => a.slot.start_time.localeCompare(b.slot.start_time))

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 pt-6 pb-5">
        <p className="text-sm text-gray-400">{greeting}</p>
        <h1 className="text-2xl font-bold text-gray-900">{operator.name}</h1>
        {operator.verified && (
          <div className="flex items-center gap-1 mt-1 text-xs text-blue-600">
            <Star className="w-3.5 h-3.5 fill-blue-600" />
            Verified operator
          </div>
        )}
      </div>

      <div className="px-4 py-5 space-y-6 max-w-2xl mx-auto">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard
            label="Today's bookings"
            value={todayAll.length}
            icon={CalendarCheck}
            color="bg-blue-50 text-blue-600"
            to="/operator/bookings"
          />
          <StatCard
            label="This week"
            value={`€${weekRevenue.toFixed(0)}`}
            sub="revenue"
            icon={TrendingUp}
            color="bg-emerald-50 text-emerald-600"
          />
          <StatCard
            label="Equipment out"
            value={equipmentOut}
            sub="items"
            icon={Wrench}
            color={equipmentOut > 0 ? 'bg-amber-50 text-amber-600' : 'bg-gray-50 text-gray-400'}
            to="/operator/equipment"
          />
        </div>

        {/* Today's schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              Today's schedule
              {todayAll.length > 0 && (
                <span className="text-xs font-semibold px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                  {todayAll.length}
                </span>
              )}
            </h2>
            <Link to="/operator/bookings" className="text-xs text-violet-600 font-medium">
              View all →
            </Link>
          </div>

          {todaySorted.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
              <CalendarDays className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No bookings scheduled for today</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todaySorted.map((e) => {
                const lead = e.booking.booking_participants?.[0]
                const paxCount = e.booking.booking_participants?.length ?? 1
                return (
                  <Link
                    key={e.booking.id}
                    to="/operator/bookings"
                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 hover:border-violet-100 transition-colors"
                  >
                    <div className="shrink-0 text-center w-12">
                      <p className="text-xs font-bold text-gray-800">
                        {e.slot.start_time.slice(0, 5)}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {e.slot.end_time ? `– ${e.slot.end_time.slice(0, 5)}` : ''}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {lead ? `${lead.first_name} ${lead.last_name}` : `#${e.booking.id.slice(0, 6).toUpperCase()}`}
                        {paxCount > 1 && <span className="text-gray-400 font-normal ml-1">+{paxCount - 1}</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{e.service.name}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[e.booking.status]}`}>
                      {STATUS_LABELS[e.booking.status]}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-2">Quick actions</h2>
          <div className="space-y-2">
            <QuickAction
              to="/operator/scan"
              icon={ScanLine}
              label="Scan QR Code"
              desc="Check guests in at arrival"
              color="bg-blue-50 text-blue-600"
            />
            <QuickAction
              to="/operator/availability"
              icon={CalendarDays}
              label="View Calendar"
              desc="See and edit your availability"
              color="bg-violet-50 text-violet-600"
            />
            <QuickAction
              to="/operator/availability"
              icon={Plus}
              label="Add Availability"
              desc="Create new time slots"
              color="bg-emerald-50 text-emerald-600"
            />
            <QuickAction
              to="/operator/equipment"
              icon={Wrench}
              label="Equipment Tracker"
              desc={`${equipmentOut} items currently out`}
              color="bg-amber-50 text-amber-600"
            />
            <QuickAction
              to="/operator/bookings"
              icon={ClipboardList}
              label="All Bookings"
              desc={`${todayConfirmed.length} pending check-in today`}
              color="bg-slate-50 text-slate-600"
            />
            <QuickAction
              to="/operator/profile"
              icon={Users}
              label="Operator Profile"
              desc="Edit company info and resort links"
              color="bg-rose-50 text-rose-600"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
