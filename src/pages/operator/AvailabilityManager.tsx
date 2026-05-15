import { useState, useEffect, useCallback } from 'react'
import {
  format, parseISO, startOfMonth, endOfMonth,
  eachDayOfInterval, getDay, addMonths, subMonths, addDays, isToday, isBefore, startOfDay,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, Plus, Trash2, EyeOff, Clock,
  Users, CalendarDays, AlertCircle, Loader2, Edit2, ShieldOff,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { getOperatorByProfileId } from '../../lib/supabase/operators'
import { getAllServicesByOperator } from '../../lib/supabase/services'
import {
  getAllSlotsByService, createSlot, deleteSlot, blockSlot, updateSlot,
} from '../../lib/supabase/availability'
import type { SlotInsert, SlotUpdate } from '../../lib/supabase/availability'
import type { Operator, Service, AvailabilitySlot } from '../../types'
import Button from '../../components/ui/Button'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SERVICE_LABELS: Record<string, { label: string; icon: string }> = {
  ski_school:   { label: 'Ski School',   icon: '🎿' },
  ski_rental:   { label: 'Ski Rental',   icon: '⛷' },
  bike_rental:  { label: 'Bike Rental',  icon: '🚵' },
  bike_guiding: { label: 'Bike Guiding', icon: '🏔️' },
}

function svcMeta(type: string) {
  return SERVICE_LABELS[type] ?? { label: type, icon: '📋' }
}

// ─── Slot row ─────────────────────────────────────────────────────────────────

function SlotRow({
  slot, onDelete, onBlock, onEdit,
}: {
  slot: AvailabilitySlot
  onDelete: (id: string) => void
  onBlock:  (id: string) => void
  onEdit:   (slot: AvailabilitySlot) => void
}) {
  const [acting, setActing] = useState(false)
  const remaining = slot.capacity_total - slot.capacity_booked
  const full = remaining === 0

  async function handleDelete() {
    if (slot.capacity_booked > 0) {
      toast.error('Cannot delete — has bookings. Use Block instead.')
      return
    }
    setActing(true)
    try {
      await deleteSlot(slot.id)
      onDelete(slot.id)
      toast.success('Slot deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally { setActing(false) }
  }

  async function handleBlock() {
    setActing(true)
    try {
      await blockSlot(slot.id)
      onBlock(slot.id)
      toast.success('Slot blocked')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Block failed')
    } finally { setActing(false) }
  }

  return (
    <div className={[
      'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors',
      !slot.active ? 'bg-gray-50 border-gray-100 opacity-60' :
        full ? 'bg-orange-50 border-orange-100' : 'bg-white border-gray-100',
    ].join(' ')}>
      <div className="shrink-0 w-20 text-center">
        <p className="text-sm font-bold text-gray-900">{slot.start_time.slice(0, 5)}</p>
        <p className="text-[10px] text-gray-400">– {slot.end_time.slice(0, 5)}</p>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs text-gray-600">
            <Users className="w-3 h-3 inline mr-0.5 text-gray-400" />
            {slot.capacity_booked}/{slot.capacity_total}
          </span>
          {!slot.active && <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">Blocked</span>}
          {full && slot.active && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">Full</span>}
          {slot.price_override !== null && (
            <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">€{slot.price_override}</span>
          )}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${full ? 'bg-orange-400' : 'bg-violet-500'}`}
            style={{ width: `${Math.min(100, (slot.capacity_booked / slot.capacity_total) * 100)}%` }}
          />
        </div>
        {slot.notes && <p className="text-[10px] text-gray-400 mt-1 truncate">{slot.notes}</p>}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(slot)}
          title="Edit slot"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
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
          title={slot.capacity_booked > 0 ? 'Has bookings — use Block' : 'Delete slot'}
          className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}

// ─── Slot form (shared by add + edit) ────────────────────────────────────────

interface SlotFormData {
  date: string
  start_time: string
  end_time: string
  capacity_total: string
  price_override: string
  notes: string
}

function SlotFormSheet({
  service, operator, prefillDate, editSlot, onClose, onDone,
}: {
  service: Service
  operator: Operator
  prefillDate: string | null
  editSlot: AvailabilitySlot | null
  onClose: () => void
  onDone: (slot: AvailabilitySlot, isNew: boolean) => void
}) {
  const isEdit = !!editSlot
  const [form, setForm] = useState<SlotFormData>({
    date:           editSlot?.date            ?? prefillDate ?? format(new Date(), 'yyyy-MM-dd'),
    start_time:     editSlot?.start_time.slice(0, 5) ?? '09:00',
    end_time:       editSlot?.end_time.slice(0, 5)   ?? '11:00',
    capacity_total: String(editSlot?.capacity_total   ?? 10),
    price_override: editSlot?.price_override != null ? String(editSlot.price_override) : '',
    notes:          editSlot?.notes ?? '',
  })
  const [errors, setErrors] = useState<Partial<SlotFormData>>({})
  const [saving, setSaving] = useState(false)

  function set(key: keyof SlotFormData) {
    return (val: string) => setForm((f) => ({ ...f, [key]: val }))
  }

  function validate() {
    const e: Partial<SlotFormData> = {}
    if (!form.date) e.date = 'Required'
    if (!form.start_time) e.start_time = 'Required'
    if (!form.end_time) e.end_time = 'Required'
    if (form.start_time >= form.end_time) e.end_time = 'Must be after start'
    const cap = parseInt(form.capacity_total)
    if (isNaN(cap) || cap < 1) e.capacity_total = 'Min 1'
    const ov = form.price_override !== '' ? parseFloat(form.price_override) : null
    if (ov !== null && (isNaN(ov) || ov < 0)) e.price_override = 'Invalid price'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    const priceOverride = form.price_override !== '' ? parseFloat(form.price_override) : null
    const notes = form.notes.trim() || null
    try {
      if (isEdit) {
        const fields: SlotUpdate = {
          start_time:     form.start_time,
          end_time:       form.end_time,
          capacity_total: parseInt(form.capacity_total),
          price_override: priceOverride,
          notes,
        }
        const updated = await updateSlot(editSlot!.id, fields)
        onDone(updated, false)
        toast.success('Slot updated')
      } else {
        const insert: SlotInsert = {
          service_id:     service.id,
          operator_id:    operator.id,
          date:           form.date,
          start_time:     form.start_time,
          end_time:       form.end_time,
          capacity_total: parseInt(form.capacity_total),
          price_override: priceOverride,
          notes,
        }
        const created = await createSlot(insert)
        onDone(created, true)
        toast.success('Slot added')
      }
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
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
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <h3 className="text-lg font-bold text-gray-900 mb-0.5">
          {isEdit ? 'Edit Time Slot' : 'Add Time Slot'}
        </h3>
        <p className="text-sm text-gray-500 mb-5">{svcMeta(service.type).icon} {service.name}</p>

        <div className="space-y-4">
          {!isEdit && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                min={format(new Date(), 'yyyy-MM-dd')}
                onChange={(e) => set('date')(e.target.value)}
                className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errors.date ? 'border-red-400' : 'border-gray-200'}`}
              />
              {errors.date && <p className="text-xs text-red-600 mt-0.5">{errors.date}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {(['start_time', 'end_time'] as const).map((key) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {key === 'start_time' ? 'Start time' : 'End time'}
                </label>
                <input
                  type="time"
                  value={form[key]}
                  onChange={(e) => set(key)(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errors[key] ? 'border-red-400' : 'border-gray-200'}`}
                />
                {errors[key] && <p className="text-xs text-red-600 mt-0.5">{errors[key]}</p>}
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Capacity (spots)</label>
            <input
              type="number" min={1} max={500}
              value={form.capacity_total}
              onChange={(e) => set('capacity_total')(e.target.value)}
              className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errors.capacity_total ? 'border-red-400' : 'border-gray-200'}`}
            />
            {errors.capacity_total && <p className="text-xs text-red-600 mt-0.5">{errors.capacity_total}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Price override <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
              <input
                type="number" min={0} step={0.01}
                value={form.price_override}
                onChange={(e) => set('price_override')(e.target.value)}
                placeholder={`Default: €${service.price_per_person}`}
                className={`w-full rounded-xl border pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 ${errors.price_override ? 'border-red-400' : 'border-gray-200'}`}
              />
            </div>
            {errors.price_override && <p className="text-xs text-red-600 mt-0.5">{errors.price_override}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => set('notes')(e.target.value)}
              placeholder="e.g. Advanced group, English only"
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
          <Button
            size="lg"
            className="flex-1 bg-violet-600 hover:bg-violet-700"
            isLoading={saving}
            onClick={handleSave}
          >
            {isEdit ? 'Save changes' : 'Add slot'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Month calendar ───────────────────────────────────────────────────────────

function MonthCalendar({
  displayMonth, slotsByDate, selectedDate, onMonthChange, onDaySelect,
}: {
  displayMonth: Date
  slotsByDate: Record<string, AvailabilitySlot[]>
  selectedDate: string | null
  onMonthChange: (m: Date) => void
  onDaySelect: (d: string) => void
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: startOfMonth(displayMonth), end: endOfMonth(displayMonth) })
  const startPad = (getDay(startOfMonth(displayMonth)) + 6) % 7

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onMonthChange(subMonths(displayMonth, 1))} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold text-gray-800">{format(displayMonth, 'MMMM yyyy')}</span>
        <button onClick={() => onMonthChange(addMonths(displayMonth, 1))} className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-500">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="text-[10px] font-medium text-gray-400 py-1">{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: startPad }).map((_, i) => <span key={`p${i}`} />)}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const past   = isBefore(startOfDay(day), startOfDay(new Date()))
          const daySlots = slotsByDate[dateStr] ?? []
          const count  = daySlots.length
          const sel    = dateStr === selectedDate

          return (
            <button
              key={dateStr}
              onClick={() => onDaySelect(dateStr)}
              className={[
                'flex flex-col items-center py-1.5 rounded-xl transition-colors',
                sel ? 'bg-violet-600' : isToday(day) ? 'ring-1 ring-violet-400 hover:bg-violet-50' : 'hover:bg-gray-100',
                past ? 'opacity-40' : '',
              ].join(' ')}
            >
              <span className={`text-xs font-semibold leading-5 ${sel ? 'text-white' : 'text-gray-800'}`}>
                {format(day, 'd')}
              </span>
              {count > 0 ? (
                <span className={`text-[9px] font-bold px-1 rounded-full leading-4 min-w-[18px] text-center ${sel ? 'bg-white/20 text-white' : 'bg-violet-100 text-violet-700'}`}>
                  {count}
                </span>
              ) : <span className="h-4" />}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4 mt-4 text-xs text-gray-500 justify-center">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-4 rounded bg-violet-100 text-violet-700 text-[9px] font-bold flex items-center justify-center">3</span>
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

// ─── Bulk block dialog ────────────────────────────────────────────────────────

function BulkBlockSheet({
  service, operator, onClose, onDone,
}: {
  service: Service
  operator: Operator
  onClose: () => void
  onDone: (blockedIds: string[]) => void
}) {
  const [days, setDays] = useState(14)
  const [blocking, setBlocking] = useState(false)

  async function handleBlock() {
    setBlocking(true)
    try {
      const from = startOfDay(new Date())
      const to   = addDays(from, days)
      const slots = await getAllSlotsByService(service.id, { from, to })
      const active = slots.filter((s) => s.active)
      if (active.length === 0) {
        toast('No active slots found in this range', { icon: 'ℹ️' })
        onClose()
        return
      }
      await Promise.all(active.map((s) => blockSlot(s.id)))
      onDone(active.map((s) => s.id))
      toast.success(`${active.length} slot${active.length !== 1 ? 's' : ''} blocked`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Block failed')
    } finally {
      setBlocking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40" />
      <div className="relative bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex items-center gap-2 mb-2">
          <ShieldOff className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-bold text-gray-900">Bulk block slots</h3>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          Block all active slots for <strong>{service.name}</strong> in the next:
        </p>

        <div className="grid grid-cols-4 gap-2 mb-6">
          {[7, 14, 21, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`py-3 rounded-xl text-sm font-semibold border-2 transition-all ${
                days === d ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 text-gray-600 hover:border-gray-200'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-5">
          <strong>Note:</strong> This blocks new bookings but does not cancel existing ones. Slots with bookings remain blocked (not deleted).
        </div>

        <div className="flex gap-3">
          <Button variant="secondary" size="lg" onClick={onClose}>Cancel</Button>
          <button
            onClick={handleBlock}
            disabled={blocking}
            className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-bold text-sm disabled:opacity-50 transition-colors"
          >
            {blocking ? 'Blocking…' : `Block next ${days} days`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AvailabilityManager() {
  const { user } = useAuth()

  const [operator, setOperator] = useState<Operator | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [displayMonth, setDisplayMonth] = useState(new Date())
  const [slots, setSlots] = useState<AvailabilitySlot[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [editSlot, setEditSlot]   = useState<AvailabilitySlot | null>(null)
  const [showBulkBlock, setShowBulkBlock] = useState(false)

  const [initLoading, setInitLoading]  = useState(true)
  const [initError, setInitError]      = useState<string | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    setInitLoading(true)
    getOperatorByProfileId(user.id)
      .then((op) => {
        if (!op) { setInitError('No operator profile found.'); return }
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

  const loadSlots = useCallback(async (serviceId: string, month: Date) => {
    setSlotsLoading(true)
    try {
      const data = await getAllSlotsByService(serviceId, {
        from: startOfMonth(month),
        to:   endOfMonth(month),
      })
      setSlots(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load slots')
    } finally {
      setSlotsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (selectedServiceId) loadSlots(selectedServiceId, displayMonth)
  }, [selectedServiceId, displayMonth, loadSlots])

  const slotsByDate: Record<string, AvailabilitySlot[]> = {}
  for (const slot of slots) {
    if (!slotsByDate[slot.date]) slotsByDate[slot.date] = []
    slotsByDate[slot.date].push(slot)
  }

  const selectedService = services.find((s) => s.id === selectedServiceId) ?? null
  const daySlots = selectedDate ? (slotsByDate[selectedDate] ?? []).sort((a, b) => a.start_time.localeCompare(b.start_time)) : []

  function handleSlotDone(slot: AvailabilitySlot, isNew: boolean) {
    if (isNew) {
      setSlots((prev) => [...prev, slot])
      setSelectedDate(slot.date)
    } else {
      setSlots((prev) => prev.map((s) => s.id === slot.id ? slot : s))
    }
  }

  function handleSlotDeleted(id: string) {
    setSlots((prev) => prev.filter((s) => s.id !== id))
  }

  function handleSlotBlocked(id: string) {
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, active: false } : s))
  }

  function handleBulkBlocked(ids: string[]) {
    const idSet = new Set(ids)
    setSlots((prev) => prev.map((s) => idSet.has(s.id) ? { ...s, active: false } : s))
  }

  if (initLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-4 px-4 space-y-4 max-w-2xl mx-auto">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-white rounded-2xl border border-gray-100 animate-pulse" />)}
      </div>
    )
  }

  if (initError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-red-100 p-6 text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-sm text-red-700 font-medium">{initError}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-16 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Availability</h1>
            <p className="text-xs text-gray-500">Manage your time slots</p>
          </div>
          {selectedService && (
            <button
              onClick={() => setShowBulkBlock(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100 px-3 py-2 rounded-xl transition-colors"
            >
              <ShieldOff className="w-3.5 h-3.5" />
              Bulk block
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

        {/* Service selector */}
        {services.length > 1 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">Service</p>
            <div className="flex flex-wrap gap-2">
              {services.map((svc) => {
                const meta   = svcMeta(svc.type)
                const active = svc.id === selectedServiceId
                return (
                  <button
                    key={svc.id}
                    onClick={() => { setSelectedServiceId(svc.id); setSelectedDate(null) }}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                      active ? 'bg-violet-600 text-white border-violet-600' : 'bg-gray-50 text-gray-600 border-gray-100 hover:bg-gray-100'
                    }`}
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
            <p className="text-sm text-amber-700">No active services. Add services first.</p>
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
                onDaySelect={(d) => setSelectedDate((prev) => prev === d ? null : d)}
              />
            </div>

            <div className="flex items-start gap-2 bg-violet-50 border border-violet-100 rounded-xl px-4 py-3 text-xs text-violet-700">
              <Clock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-violet-400" />
              <span>Click a day to manage its slots. Use <strong>Bulk block</strong> to close all slots for a period.</span>
            </div>

            {/* Day panel */}
            {selectedDate && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50 bg-gray-50/60">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-bold text-gray-800">
                      {format(parseISO(selectedDate), 'EEEE, d MMMM')}
                    </span>
                    {isBefore(startOfDay(parseISO(selectedDate)), startOfDay(new Date())) && (
                      <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full">Past</span>
                    )}
                  </div>
                  {!isBefore(startOfDay(parseISO(selectedDate)), startOfDay(new Date())) && (
                    <button
                      onClick={() => setShowAddSheet(true)}
                      className="flex items-center gap-1 text-xs font-bold text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add slot
                    </button>
                  )}
                </div>

                <div className="p-3 space-y-2">
                  {daySlots.length === 0 ? (
                    <div className="text-center py-6 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No slots for this day.</p>
                      {!isBefore(startOfDay(parseISO(selectedDate)), startOfDay(new Date())) && (
                        <button onClick={() => setShowAddSheet(true)} className="text-xs text-violet-600 font-semibold mt-1">
                          + Add the first slot
                        </button>
                      )}
                    </div>
                  ) : (
                    daySlots.map((slot) => (
                      <SlotRow
                        key={slot.id}
                        slot={slot}
                        onDelete={handleSlotDeleted}
                        onBlock={handleSlotBlocked}
                        onEdit={(s) => setEditSlot(s)}
                      />
                    ))
                  )}
                </div>
              </div>
            )}

            {!selectedDate && (
              <button
                onClick={() => setShowAddSheet(true)}
                className="fixed bottom-24 right-5 w-14 h-14 bg-violet-600 hover:bg-violet-700 text-white rounded-full shadow-xl flex items-center justify-center transition-colors z-20"
                aria-label="Add slot"
              >
                <Plus className="w-6 h-6" />
              </button>
            )}
          </>
        )}
      </div>

      {(showAddSheet || editSlot) && selectedService && operator && (
        <SlotFormSheet
          service={selectedService}
          operator={operator}
          prefillDate={selectedDate}
          editSlot={editSlot}
          onClose={() => { setShowAddSheet(false); setEditSlot(null) }}
          onDone={handleSlotDone}
        />
      )}

      {showBulkBlock && selectedService && operator && (
        <BulkBlockSheet
          service={selectedService}
          operator={operator}
          onClose={() => setShowBulkBlock(false)}
          onDone={handleBulkBlocked}
        />
      )}
    </div>
  )
}
