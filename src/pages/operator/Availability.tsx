import { useState, useEffect, useCallback } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths, isToday,
  isBefore, startOfDay,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, EyeOff, Clock,
  Users, CalendarDays, AlertCircle, Loader2,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getAllServicesByOperator } from '../../lib/supabase/services'
import {
  getAllSlotsByService, createSlot, deleteSlot, blockSlot,
} from '../../lib/supabase/availability'
import type { SlotInsert } from '../../lib/supabase/availability'
import type { Operator, Service, AvailabilitySlot } from '../../types'
import Skeleton from '../../components/ui/Skeleton'
import Button from '../../components/ui/Button'

// ─── Service type label helpers ───────────────────────────────────────────────

const SERVICE_LABELS: Record<string, { label: string; icon: string }> = {
  ski_school:   { label: 'Ski School',   icon: '🎿' },
  ski_rental:   { label: 'Ski Rental',   icon: '⛷' },
  bike_rental:  { label: 'Bike Rental',  icon: '🚵' },
  bike_guiding: { label: 'Bike Guiding', icon: '🏔️' },
}

function serviceLabel(type: string) {
  return SERVICE_LABELS[type] ?? { label: type, icon: '📋' }
}

// ─── Slot row ─────────────────────────────────────────────────────────────────

function SlotRow({
  slot,
  onDelete,
  onBlock,
}: {
  slot: AvailabilitySlot
  onDelete: (id: string) => void
  onBlock: (id: string) => void
}) {
  const [acting, setActing] = useState(false)
  const remaining = slot.capacity_total - slot.capacity_booked
  const full = remaining === 0

  async function handleDelete() {
    if (slot.capacity_booked > 0) {
      toast.error('Cannot delete a slot that already has bookings. Use "Block" instead.')
      return
    }
    setActing(true)
    try {
      await deleteSlot(slot.id)
      onDelete(slot.id)
      toast.success('Slot deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setActing(false)
    }
  }

  async function handleBlock() {
    setActing(true)
    try {
      await blockSlot(slot.id)
      onBlock(slot.id)
      toast.success('Slot blocked — no new bookings will be accepted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Block failed')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className={[
      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
      !slot.active ? 'bg-gray-50 border-gray-100 opacity-60' : full ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100',
    ].join(' ')}>
      {/* Time */}
      <div className="shrink-0 text-center">
        <p className="text-sm font-bold text-gray-900">
          {slot.start_time.slice(0, 5)}
        </p>
        <p className="text-[10px] text-gray-400">
          – {slot.end_time.slice(0, 5)}
        </p>
      </div>

      {/* Capacity bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-3 h-3 text-gray-400 shrink-0" />
          <span className="text-xs text-gray-600">
            {slot.capacity_booked} / {slot.capacity_total} booked
          </span>
          {!slot.active && (
            <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-medium">Blocked</span>
          )}
          {full && slot.active && (
            <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full font-medium">Full</span>
          )}
          {slot.price_override !== null && (
            <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-medium">
              €{slot.price_override}
            </span>
          )}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={['h-full rounded-full transition-all', full ? 'bg-orange-400' : 'bg-blue-500'].join(' ')}
            style={{ width: `${Math.min(100, (slot.capacity_booked / slot.capacity_total) * 100)}%` }}
          />
        </div>
        {slot.notes && <p className="text-[10px] text-gray-400 mt-1 truncate">{slot.notes}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {slot.active && (
          <button
            onClick={handleBlock}
            disabled={acting}
            title="Block slot"
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
          >
            {acting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={handleDelete}
          disabled={acting || slot.capacity_booked > 0}
          title={slot.capacity_booked > 0 ? 'Has bookings — use Block instead' : 'Delete slot'}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Add slot sheet ───────────────────────────────────────────────────────────

interface AddSlotForm {
  date: string
  start_time: string
  end_time: string
  capacity_total: string
  price_override: string
  notes: string
}

function AddSlotSheet({
  service,
  operator,
  prefillDate,
  onClose,
  onCreated,
}: {
  service: Service
  operator: Operator
  prefillDate: string | null
  onClose: () => void
  onCreated: (slot: AvailabilitySlot) => void
}) {
  const [form, setForm] = useState<AddSlotForm>({
    date: prefillDate ?? format(new Date(), 'yyyy-MM-dd'),
    start_time: '09:00',
    end_time: '11:00',
    capacity_total: '10',
    price_override: '',
    notes: '',
  })
  const [errors, setErrors] = useState<Partial<AddSlotForm>>({})
  const [saving, setSaving] = useState(false)

  function set(key: keyof AddSlotForm) {
    return (val: string) => setForm((f) => ({ ...f, [key]: val }))
  }

  function validate(): boolean {
    const e: Partial<AddSlotForm> = {}
    if (!form.date) e.date = 'Required'
    if (!form.start_time) e.start_time = 'Required'
    if (!form.end_time) e.end_time = 'Required'
    if (form.start_time && form.end_time && form.start_time >= form.end_time) {
      e.end_time = 'Must be after start time'
    }
    const cap = parseInt(form.capacity_total)
    if (isNaN(cap) || cap < 1) e.capacity_total = 'Must be at least 1'
    const override = form.price_override !== '' ? parseFloat(form.price_override) : null
    if (override !== null && (isNaN(override) || override < 0)) e.price_override = 'Must be a positive number'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    try {
      const insert: SlotInsert = {
        service_id: service.id,
        operator_id: operator.id,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        capacity_total: parseInt(form.capacity_total),
        price_override: form.price_override !== '' ? parseFloat(form.price_override) : null,
        notes: form.notes.trim() || null,
      }
      const created = await createSlot(insert)
      onCreated(created)
      toast.success('Slot added')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create slot')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div
        className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        <h3 className="text-lg font-bold text-gray-900 mb-1">Add Time Slot</h3>
        <p className="text-sm text-gray-500 mb-5">
          {serviceLabel(service.type).icon} {service.name}
        </p>

        <div className="space-y-4">
          {/* Date */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              min={format(new Date(), 'yyyy-MM-dd')}
              onChange={(e) => set('date')(e.target.value)}
              className={['w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500', errors.date ? 'border-red-400' : 'border-gray-200'].join(' ')}
            />
            {errors.date && <p className="text-xs text-red-600 mt-0.5">{errors.date}</p>}
          </div>

          {/* Time range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Start time</label>
              <input
                type="time"
                value={form.start_time}
                onChange={(e) => set('start_time')(e.target.value)}
                className={['w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500', errors.start_time ? 'border-red-400' : 'border-gray-200'].join(' ')}
              />
              {errors.start_time && <p className="text-xs text-red-600 mt-0.5">{errors.start_time}</p>}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">End time</label>
              <input
                type="time"
                value={form.end_time}
                onChange={(e) => set('end_time')(e.target.value)}
                className={['w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500', errors.end_time ? 'border-red-400' : 'border-gray-200'].join(' ')}
              />
              {errors.end_time && <p className="text-xs text-red-600 mt-0.5">{errors.end_time}</p>}
            </div>
          </div>

          {/* Capacity */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Capacity (total spots)</label>
            <input
              type="number"
              min={1}
              max={200}
              value={form.capacity_total}
              onChange={(e) => set('capacity_total')(e.target.value)}
              className={['w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500', errors.capacity_total ? 'border-red-400' : 'border-gray-200'].join(' ')}
            />
            {errors.capacity_total && <p className="text-xs text-red-600 mt-0.5">{errors.capacity_total}</p>}
          </div>

          {/* Price override (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Price override <span className="text-gray-400 font-normal">(optional — leave blank to use service price)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.price_override}
                onChange={(e) => set('price_override')(e.target.value)}
                placeholder={`Default: €${service.price_per_person}`}
                className={['w-full rounded-xl border pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500', errors.price_override ? 'border-red-400' : 'border-gray-200'].join(' ')}
              />
            </div>
            {errors.price_override && <p className="text-xs text-red-600 mt-0.5">{errors.price_override}</p>}
          </div>

          {/* Notes (optional) */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              placeholder="e.g. Advanced group only, language: English"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
          <Button size="lg" className="flex-1 bg-violet-600 hover:bg-violet-700" isLoading={saving} onClick={handleSave}>
            Add Slot
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function MonthCalendar({
  displayMonth,
  slotsByDate,
  selectedDate,
  onMonthChange,
  onDaySelect,
}: {
  displayMonth: Date
  slotsByDate: Record<string, AvailabilitySlot[]>
  selectedDate: string | null
  onMonthChange: (m: Date) => void
  onDaySelect: (date: string) => void
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: startOfMonth(displayMonth), end: endOfMonth(displayMonth) })
  const startPad = (getDay(startOfMonth(displayMonth)) + 6) % 7

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => onMonthChange(subMonths(displayMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-gray-800">{format(displayMonth, 'MMMM yyyy')}</span>
        <button
          onClick={() => onMonthChange(addMonths(displayMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: startPad }).map((_, i) => <span key={`p${i}`} />)}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const past = isBefore(startOfDay(day), startOfDay(new Date()))
          const daySlots = slotsByDate[dateStr] ?? []
          const count = daySlots.length
          const activeCount = daySlots.filter((s) => s.active).length
          const sel = dateStr === selectedDate
          const today = isToday(day)

          return (
            <button
              key={dateStr}
              onClick={() => onDaySelect(dateStr)}
              className={[
                'flex flex-col items-center py-1.5 rounded-xl transition-colors text-center group relative',
                sel ? 'bg-violet-600' : today ? 'ring-1 ring-violet-400 hover:bg-violet-50' : 'hover:bg-gray-100',
                past ? 'opacity-40' : '',
              ].join(' ')}
            >
              <span className={[
                'text-xs font-semibold leading-5',
                sel ? 'text-white' : 'text-gray-800',
              ].join(' ')}>
                {format(day, 'd')}
              </span>
              {/* Slot count indicator */}
              {count > 0 ? (
                <span className={[
                  'text-[9px] font-bold px-1 rounded-full leading-4 min-w-[18px] text-center',
                  sel ? 'bg-white/20 text-white' : activeCount > 0 ? 'bg-violet-100 text-violet-700' : 'bg-gray-200 text-gray-500',
                ].join(' ')}>
                  {count}
                </span>
              ) : (
                <span className="h-4" />
              )}
            </button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 text-xs text-gray-500 justify-center">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex items-center justify-center">3</span>
          Slots
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded-full ring-1 ring-violet-400" />
          Today
        </span>
      </div>
    </div>
  )
}

// ─── Day panel ────────────────────────────────────────────────────────────────

function DayPanel({
  date,
  slots,
  onAddSlot,
  onSlotDeleted,
  onSlotBlocked,
}: {
  date: string
  slots: AvailabilitySlot[]
  onAddSlot: () => void
  onSlotDeleted: (id: string) => void
  onSlotBlocked: (id: string) => void
}) {
  const sorted = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const past = isBefore(startOfDay(parseISO(date)), startOfDay(new Date()))

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/60">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-800">
            {format(parseISO(date), 'EEEE, d MMMM')}
          </span>
          {past && (
            <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">Past</span>
          )}
        </div>
        {!past && (
          <button
            onClick={onAddSlot}
            className="flex items-center gap-1 text-xs font-semibold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add slot
          </button>
        )}
      </div>

      {/* Slot list */}
      <div className="p-3 space-y-2">
        {sorted.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No slots for this day.</p>
            {!past && (
              <button
                onClick={onAddSlot}
                className="text-xs text-violet-600 hover:text-violet-700 font-medium mt-1"
              >
                + Add the first slot
              </button>
            )}
          </div>
        ) : (
          sorted.map((slot) => (
            <SlotRow
              key={slot.id}
              slot={slot}
              onDelete={onSlotDeleted}
              onBlock={onSlotBlocked}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function OperatorAvailability() {
  const { user } = useAuth()

  const [operator, setOperator] = useState<Operator | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)

  const [initLoading, setInitLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  // Load operator + services once
  useEffect(() => {
    if (!user) return
    setInitLoading(true)
    getOperatorByProfileId(user.id)
      .then((op) => {
        if (!op) { setInitError('No operator profile found for your account.'); return }
        setOperator(op)
        return getAllServicesByOperator(op.id)
      })
      .then((svcs) => {
        if (!svcs) return
        setServices(svcs)
        if (svcs.length > 0) setSelectedServiceId(svcs[0].id)
      })
      .catch((err) => setInitError(err.message))
      .finally(() => setInitLoading(false))
  }, [user])

  // Reload slots when service or month changes
  const loadSlots = useCallback(async (serviceId: string, month: Date) => {
    setSlotsLoading(true)
    try {
      const from = startOfMonth(month)
      const to = endOfMonth(month)
      const data = await getAllSlotsByService(serviceId, { from, to })
      setSlots(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load slots')
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!selectedServiceId) return
    loadSlots(selectedServiceId, displayMonth)
  }, [selectedServiceId, displayMonth, loadSlots])

  // Group slots by date for the calendar
  const slotsByDate: Record<string, AvailabilitySlot[]> = {}
  for (const slot of slots) {
    if (!slotsByDate[slot.date]) slotsByDate[slot.date] = []
    slotsByDate[slot.date].push(slot)
  }

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null
  const daySlots = selectedDate ? (slotsByDate[selectedDate] ?? []) : []

  function handleSlotCreated(slot: AvailabilitySlot) {
    setSlots((prev) => [...prev, slot])
    setSelectedDate(slot.date)
  }

  function handleSlotDeleted(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id))
  }

  function handleSlotBlocked(id: string) {
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, active: false } : s))
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (initLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-4 px-4 space-y-4 max-w-2xl mx-auto">
        <Skeleton width="w-48" height="h-7" />
        <Skeleton height="h-12" />
        <Skeleton height="h-64" />
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-red-100 p-6 text-center max-w-sm w-full">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-700 font-medium">{initError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Page header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-lg font-bold text-gray-900">Manage Availability</h1>
          <p className="text-xs text-gray-500 mt-0.5">Set time slots for your services</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Service selector */}
        {services.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1 mb-2">Service</p>
            <div className="flex flex-wrap gap-2">
              {services.map((svc) => {
                const meta = serviceLabel(svc.type)
                const active = svc.id === selectedServiceId
                return (
                  <button
                    key={svc.id}
                    onClick={() => { setSelectedServiceId(svc.id); setSelectedDate(null) }}
                    className={[
                      'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all border',
                      active ? 'bg-violet-600 text-white border-violet-600' : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100',
                    ].join(' ')}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {services.length === 0 && (
          <div className="bg-white rounded-2xl border border-amber-100 p-6 text-center">
            <p className="text-sm text-amber-700">No active services found. Add services first to manage availability.</p>
          </div>
        )}

        {selectedService && (
          <>
            {/* Calendar */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 relative">
              {slotsLoading && (
                <div className="absolute inset-0 bg-white/70 rounded-2xl flex items-center justify-center z-10">
                  <Loader2 className="w-5 h-5 animate-spin text-violet-500" />
                </div>
              )}
              <MonthCalendar
                displayMonth={displayMonth}
                slotsByDate={slotsByDate}
                selectedDate={selectedDate}
                onMonthChange={(m) => { setDisplayMonth(m); setSelectedDate(null) }}
                onDaySelect={(date) => setSelectedDate((prev) => prev === date ? null : date)}
              />
            </div>

            {/* Bulk add tip */}
            <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-400" />
              <span>
                Tip: Click any day on the calendar to manage its slots.
                Slots with bookings can be <strong>blocked</strong> (no new bookings) but not deleted.
              </span>
            </div>

            {/* Day panel */}
            {selectedDate && (
              <DayPanel
                date={selectedDate}
                slots={daySlots}
                onAddSlot={() => setShowAddSheet(true)}
                onSlotDeleted={handleSlotDeleted}
                onSlotBlocked={handleSlotBlocked}
              />
            )}

            {/* Floating add button when no day selected */}
            {!selectedDate && (
              <button
                onClick={() => setShowAddSheet(true)}
                className="fixed bottom-24 right-5 w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-lg flex items-center justify-center transition-colors z-20"
                aria-label="Add slot"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Add slot sheet */}
      {showAddSheet && selectedService && operator && (
        <AddSlotSheet
          service={selectedService}
          operator={operator}
          prefillDate={selectedDate}
          onClose={() => setShowAddSheet(false)}
          onCreated={handleSlotCreated}
        />
      )}
    </div>
  )
}
