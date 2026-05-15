import { useEffect, useState, useMemo } from 'react'
import {
  format, parseISO, isToday, isTomorrow, startOfDay, endOfDay,
} from 'date-fns'
import {
  Search, ChevronDown, ChevronUp, Users, Calendar, Clock,
  Loader2, BadgeCheck, X, Package, Filter,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getBookingsByOperator, updateBookingStatus } from '../../lib/supabase/bookings'
import { getServiceById } from '../../lib/supabase/services'
import { getSlotById } from '../../lib/supabase/availability'
import type {
  Booking, BookingParticipant, BookingStatus,
  Operator, Service, AvailabilitySlot, ServiceType, SkillLevel,
} from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

interface EnrichedBooking {
  booking: BookingWithParticipants
  service: Service
  slot: AvailabilitySlot
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', arrived: 'Arrived',
  completed: 'Completed', cancelled: 'Cancelled',
}
const STATUS_COLORS: Record<BookingStatus, string> = {
  pending:   'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  arrived:   'bg-blue-100 text-blue-700',
  completed: 'bg-slate-100 text-slate-600',
  cancelled: 'bg-red-100 text-red-600',
}
const NEXT_STATUS: Partial<Record<BookingStatus, { status: BookingStatus; label: string; color: string }>> = {
  pending:   { status: 'confirmed', label: 'Confirm',      color: 'bg-green-600 text-white' },
  confirmed: { status: 'arrived',   label: 'Mark arrived', color: 'bg-blue-600 text-white' },
  arrived:   { status: 'completed', label: 'Complete',     color: 'bg-slate-700 text-white' },
}
const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced',
}
const SERVICE_LABELS: Record<ServiceType, string> = {
  ski_school: 'Ski School', ski_rental: 'Ski Rental',
  bike_rental: 'Bike Rental', bike_guiding: 'Bike Guiding',
}

function dateLabel(dateStr: string) {
  const d = parseISO(dateStr)
  if (isToday(d)) return 'Today'
  if (isTomorrow(d)) return 'Tomorrow'
  return format(d, 'EEE, d MMM')
}

// ── Expanded detail sheet ─────────────────────────────────────────────────────

function DetailSheet({
  enriched,
  onStatusChange,
  onClose,
}: {
  enriched: EnrichedBooking
  onStatusChange: (bookingId: string, status: BookingStatus) => void
  onClose: () => void
}) {
  const { booking, service, slot } = enriched
  const participants = booking.booking_participants ?? []
  const next = NEXT_STATUS[booking.status]
  const [busy, setBusy] = useState(false)

  async function advance() {
    if (!next) return
    setBusy(true)
    try {
      await updateBookingStatus(booking.id, next.status)
      onStatusChange(booking.id, next.status)
      toast.success(`Marked as ${STATUS_LABELS[next.status].toLowerCase()}`)
      onClose()
    } catch {
      toast.error('Failed to update status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div
        className="relative w-full bg-white rounded-t-3xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="sticky top-0 bg-white pt-4 px-5 pb-3 border-b border-gray-50 z-10">
          <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-gray-900 text-base">
                {participants[0]
                  ? `${participants[0].first_name} ${participants[0].last_name}`
                  : `#${booking.id.slice(0, 8).toUpperCase()}`}
                {participants.length > 1 && (
                  <span className="text-gray-400 font-normal ml-1.5">+{participants.length - 1}</span>
                )}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[booking.status]}`}>
                  {STATUS_LABELS[booking.status]}
                </span>
                {booking.type === 'bundle' && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                    📦 Bundle
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Service</span>
              <span className="font-medium text-gray-900">{service.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-medium text-gray-900">{format(parseISO(slot.date), 'EEE, d MMM yyyy')}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium text-gray-900">
                {slot.start_time.slice(0, 5)}{slot.end_time ? ` – ${slot.end_time.slice(0, 5)}` : ''}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Booking ID</span>
              <span className="font-mono text-xs text-gray-500">{booking.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex justify-between font-semibold pt-1 border-t border-gray-100">
              <span className="text-gray-700">Total</span>
              <span className="text-gray-900">{booking.currency} {booking.total_price.toFixed(2)}</span>
            </div>
          </div>

          {/* Participants */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-2">
              Participants ({participants.length})
            </h3>
            <div className="space-y-2">
              {participants.map((p, i) => (
                <div key={p.id} className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900 mb-2">
                    {i + 1}. {p.first_name} {p.last_name}
                    {p.age != null && <span className="text-gray-400 font-normal ml-1.5">· {p.age} yrs</span>}
                  </p>
                  {p.school_data && (
                    <div className="space-y-1 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Skill level</span>
                        <span className="font-medium">{SKILL_LABELS[p.school_data.skill_level]}</span>
                      </div>
                      {p.school_data.special_requirements && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Notes</span>
                          <span className="font-medium text-right max-w-[60%]">{p.school_data.special_requirements}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {p.rental_data && (
                    <div className={`space-y-1 text-xs text-gray-600 ${p.school_data ? 'mt-3 pt-3 border-t border-gray-50' : ''}`}>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Equipment</span>
                        <span className="font-medium capitalize">{p.rental_data.equipment_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Height / Weight</span>
                        <span className="font-medium">{p.rental_data.height_cm} cm · {p.rental_data.weight_kg} kg</span>
                      </div>
                      {p.rental_data.boot_size > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Boot / shoe</span>
                          <span className="font-medium">EU {p.rental_data.boot_size}</span>
                        </div>
                      )}
                      {p.rental_data.helmet_size && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Helmet</span>
                          <span className="font-medium">{p.rental_data.helmet_size}</span>
                        </div>
                      )}
                      {p.rental_data.preferred_brand && (
                        <div className="flex justify-between">
                          <span className="text-gray-400">Preferences</span>
                          <span className="font-medium text-right max-w-[60%]">{p.rental_data.preferred_brand}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action */}
          {next && booking.status !== 'cancelled' && (
            <button
              onClick={advance}
              disabled={busy}
              className={`w-full py-3.5 rounded-2xl text-sm font-bold transition-opacity disabled:opacity-50 ${next.color}`}
            >
              {busy ? 'Updating…' : next.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Booking row ───────────────────────────────────────────────────────────────

function BookingRow({
  enriched,
  onSelect,
}: {
  enriched: EnrichedBooking
  onSelect: () => void
}) {
  const { booking, service, slot } = enriched
  const participants = booking.booking_participants ?? []
  const lead = participants[0]

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 cursor-pointer hover:border-violet-100 hover:shadow-md transition-all active:scale-[0.99]"
      onClick={onSelect}
    >
      <div className="flex items-center gap-3">
        {/* Lead name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">
              {lead ? `${lead.first_name} ${lead.last_name}` : `#${booking.id.slice(0, 6).toUpperCase()}`}
            </span>
            {participants.length > 1 && (
              <span className="text-xs text-gray-400">+{participants.length - 1}</span>
            )}
            {booking.type === 'bundle' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-700">📦</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400 flex-wrap">
            <span>{service.name}</span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Calendar className="w-3 h-3" />
              {dateLabel(slot.date)} {slot.start_time.slice(0, 5)}
            </span>
            <span>·</span>
            <span className="flex items-center gap-0.5">
              <Users className="w-3 h-3" />
              {participants.length}
            </span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className="text-sm font-bold text-gray-900">
            {booking.currency} {booking.total_price.toFixed(0)}
          </span>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[booking.status]}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type StatusFilter = BookingStatus | 'all'

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending',   label: 'Pending' },
  { id: 'arrived',   label: 'Arrived' },
  { id: 'completed', label: 'Past' },
  { id: 'cancelled', label: 'Cancelled' },
]

const SERVICE_OPTIONS: { value: ServiceType | 'all'; label: string }[] = [
  { value: 'all',          label: 'All services' },
  { value: 'ski_school',   label: 'Ski School' },
  { value: 'ski_rental',   label: 'Ski Rental' },
  { value: 'bike_rental',  label: 'Bike Rental' },
  { value: 'bike_guiding', label: 'Bike Guiding' },
]

export default function BookingsList() {
  const { user } = useAuth()
  const [operator, setOperator] = useState<Operator | null>(null)
  const [enriched, setEnriched] = useState<EnrichedBooking[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<EnrichedBooking | null>(null)

  const [statusFilter, setStatusFilter]   = useState<StatusFilter>('all')
  const [serviceFilter, setServiceFilter] = useState<ServiceType | 'all'>('all')
  const [query, setQuery]                 = useState('')
  const [dateFrom, setDateFrom]           = useState('')
  const [dateTo, setDateTo]               = useState('')
  const [showFilters, setShowFilters]     = useState(false)

  useEffect(() => {
    if (!user) return

    async function load() {
      try {
        const op = await getOperatorByProfileId(user!.id)
        if (!op) { setLoading(false); return }
        setOperator(op)

        const bookings = await getBookingsByOperator(op.id) as BookingWithParticipants[]

        const uniqueServiceIds = [...new Set(bookings.map((b) => b.service_id))]
        const uniqueSlotIds    = [...new Set(bookings.map((b) => b.availability_slot_id))]

        const [services, slots] = await Promise.all([
          Promise.all(uniqueServiceIds.map((id) => getServiceById(id))),
          Promise.all(uniqueSlotIds.map((id) => getSlotById(id))),
        ])

        const serviceMap = Object.fromEntries(services.map((s) => [s.id, s]))
        const slotMap    = Object.fromEntries(slots.map((s) => [s.id, s]))

        setEnriched(
          bookings
            .filter((b) => serviceMap[b.service_id] && slotMap[b.availability_slot_id])
            .map((b) => ({
              booking: b,
              service: serviceMap[b.service_id],
              slot:    slotMap[b.availability_slot_id],
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
      prev.map((e) => e.booking.id === bookingId ? { ...e, booking: { ...e.booking, status } } : e),
    )
    if (selected?.booking.id === bookingId) {
      setSelected((prev) => prev ? { ...prev, booking: { ...prev.booking, status } } : prev)
    }
  }

  const filtered = useMemo(() => {
    let list = enriched
    if (statusFilter !== 'all')  list = list.filter((e) => e.booking.status === statusFilter)
    if (serviceFilter !== 'all') list = list.filter((e) => e.service.type === serviceFilter)
    if (dateFrom) {
      const from = startOfDay(parseISO(dateFrom))
      list = list.filter((e) => parseISO(e.slot.date) >= from)
    }
    if (dateTo) {
      const to = endOfDay(parseISO(dateTo))
      list = list.filter((e) => parseISO(e.slot.date) <= to)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter((e) =>
        e.booking.booking_participants?.some(
          (p) => p.first_name.toLowerCase().includes(q) || p.last_name.toLowerCase().includes(q),
        ) ||
        e.booking.id.toLowerCase().includes(q) ||
        e.service.name.toLowerCase().includes(q),
      )
    }
    return list
  }, [enriched, statusFilter, serviceFilter, dateFrom, dateTo, query])

  const hasFilters = serviceFilter !== 'all' || dateFrom || dateTo

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Sticky header */}
        <div className="bg-white border-b border-gray-100 px-4 pt-5 pb-0 sticky top-16 z-10">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-xl font-bold text-gray-900">Bookings</h1>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl transition-colors ${hasFilters ? 'bg-violet-100 text-violet-700' : 'bg-gray-100 text-gray-600'}`}
              >
                <Filter className="w-3.5 h-3.5" />
                Filters{hasFilters ? ' •' : ''}
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Name, booking ID, or service…"
                className="w-full pl-9 pr-4 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {/* Extended filters */}
            {showFilters && (
              <div className="pb-3 grid grid-cols-2 gap-2 border-b border-gray-50">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Service</label>
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value as ServiceType | 'all')}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  >
                    {SERVICE_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">From date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">To date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                {hasFilters && (
                  <button
                    onClick={() => { setServiceFilter('all'); setDateFrom(''); setDateTo('') }}
                    className="self-end text-sm text-violet-600 font-medium py-2"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}

            {/* Status tabs */}
            <div className="flex overflow-x-auto -mx-4 px-4 scrollbar-hide">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`py-2.5 px-1 mr-4 text-sm font-medium border-b-2 shrink-0 transition-colors ${
                    statusFilter === tab.id
                      ? 'border-violet-600 text-violet-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 pt-4 max-w-2xl mx-auto">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 h-20 animate-pulse" />
              ))}
            </div>
          ) : !operator ? (
            <div className="text-center py-16 text-gray-400 text-sm">No operator profile linked</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
              <BadgeCheck className="w-10 h-10 mb-3 opacity-40" />
              <p className="font-medium text-gray-600 mb-1">No bookings found</p>
              <p className="text-sm">{query ? 'Try a different search term' : 'Adjust your filters to see more'}</p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-400 mb-1">
                {filtered.length} {filtered.length === 1 ? 'booking' : 'bookings'}
              </p>
              {filtered.map((e) => (
                <BookingRow
                  key={e.booking.id}
                  enriched={e}
                  onSelect={() => setSelected(e)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <DetailSheet
          enriched={selected}
          onStatusChange={handleStatusChange}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  )
}
