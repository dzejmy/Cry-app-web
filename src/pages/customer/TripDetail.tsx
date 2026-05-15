import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format, parseISO, isFuture } from 'date-fns'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Clock,
  Users,
  Package,
  GraduationCap,
  Mountain,
  Bike,
  Ticket,
  BadgeCheck,
  AlertCircle,
  X,
  Maximize2,
  ExternalLink,
} from 'lucide-react'
import QRCode from 'qrcode'
import toast from 'react-hot-toast'

import { getBookingById, updateBookingStatus } from '../../lib/supabase/bookings'
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
  SkillLevel,
} from '../../types'

// ── Types ────────────────────────────────────────────────────────────────────

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Payment pending',
  confirmed: 'Confirmed',
  arrived: 'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<BookingStatus, { bar: string; icon: string; text: string }> = {
  pending: { bar: 'bg-amber-500', icon: 'text-amber-500', text: 'text-amber-700' },
  confirmed: { bar: 'bg-green-500', icon: 'text-green-500', text: 'text-green-700' },
  arrived: { bar: 'bg-blue-500', icon: 'text-blue-500', text: 'text-blue-700' },
  completed: { bar: 'bg-slate-400', icon: 'text-slate-400', text: 'text-slate-600' },
  cancelled: { bar: 'bg-red-500', icon: 'text-red-500', text: 'text-red-600' },
}

const TYPE_LABELS: Record<string, string> = {
  school_only: 'Ski School',
  rental_only: 'Ski Rental',
  guiding_only: 'Bike Guiding',
  bundle: 'School + Rental Bundle',
}

const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const HELMET_SIZE_LABELS: Record<string, string> = {
  XS: 'XS (< 52 cm)',
  S: 'S (52–55 cm)',
  M: 'M (56–58 cm)',
  L: 'L (59–61 cm)',
  XL: 'XL (≥ 62 cm)',
}

const SERVICE_ICONS: Record<string, React.ElementType> = {
  ski_school: GraduationCap,
  ski_rental: Package,
  bike_guiding: Mountain,
  bike_rental: Bike,
}

// ── QR lightbox ──────────────────────────────────────────────────────────────

function QRPanel({ bookingId }: { bookingId: string }) {
  const smallRef = useRef<HTMLCanvasElement>(null)
  const largeRef = useRef<HTMLCanvasElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (smallRef.current) QRCode.toCanvas(smallRef.current, bookingId, { width: 160 })
  }, [bookingId])

  useEffect(() => {
    if (open && largeRef.current) QRCode.toCanvas(largeRef.current, bookingId, { width: 280 })
  }, [open, bookingId])

  return (
    <>
      <div
        className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center cursor-pointer active:scale-95 transition-transform"
        onClick={() => setOpen(true)}
      >
        <canvas ref={smallRef} className="rounded-lg" />
        <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
          <Maximize2 className="w-3.5 h-3.5" />
          <span>Tap to enlarge for check-in</span>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <canvas ref={largeRef} className="rounded-xl" />
            <p className="text-xs text-gray-400 mt-4 text-center max-w-[240px]">
              Show this code at the meeting point
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-4 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

// ── Participant card ──────────────────────────────────────────────────────────

function ParticipantRow({ p, index }: { p: BookingParticipant; index: number }) {
  return (
    <div className="border border-gray-100 rounded-xl p-4">
      <p className="font-medium text-gray-900 text-sm mb-2">
        {index + 1}. {p.first_name} {p.last_name}
        {p.age != null && <span className="text-gray-400 font-normal ml-1">· {p.age} yrs</span>}
      </p>

      {p.school_data && (
        <div className="space-y-1">
          <Row label="Skill level" value={SKILL_LABELS[p.school_data.skill_level]} />
          {p.school_data.special_requirements && (
            <Row label="Notes" value={p.school_data.special_requirements} />
          )}
        </div>
      )}

      {p.rental_data && (
        <div className="space-y-1 mt-2 pt-2 border-t border-gray-50">
          <Row label="Equipment" value={p.rental_data.equipment_type === 'ski' ? 'Skis' : 'Snowboard'} />
          <Row label="Height" value={`${p.rental_data.height_cm} cm`} />
          <Row label="Weight" value={`${p.rental_data.weight_kg} kg`} />
          <Row label="Boot" value={`EU ${p.rental_data.boot_size}`} />
          {p.rental_data.helmet_size && (
            <Row label="Helmet" value={HELMET_SIZE_LABELS[p.rental_data.helmet_size] ?? p.rental_data.helmet_size} />
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 text-xs">
      <span className="text-gray-400">{label}</span>
      <span className="text-gray-700 font-medium text-right">{value}</span>
    </div>
  )
}

// ── Cancel confirmation ───────────────────────────────────────────────────────

function CancelSheet({
  onConfirm,
  onClose,
  busy,
}: {
  onConfirm: () => void
  onClose: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl p-6 shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-bold text-gray-900 text-lg mb-1">Cancel this booking?</h2>
          <p className="text-sm text-gray-500">
            This action cannot be undone. Refund eligibility depends on the operator's cancellation policy.
          </p>
        </div>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="w-full py-3.5 bg-red-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-50 mb-3"
        >
          {busy ? 'Cancelling…' : 'Yes, cancel booking'}
        </button>
        <button
          onClick={onClose}
          className="w-full py-3.5 bg-gray-100 text-gray-700 rounded-2xl font-semibold text-sm"
        >
          Keep booking
        </button>
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TripDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [booking, setBooking] = useState<BookingWithParticipants | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [resort, setResort] = useState<Resort | null>(null)
  const [service, setService] = useState<Service | null>(null)
  const [slot, setSlot] = useState<AvailabilitySlot | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCancel, setShowCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!id) return

    async function load() {
      try {
        const b = await getBookingById(id!) as BookingWithParticipants
        setBooking(b)

        const [op, res, svc, sl] = await Promise.all([
          getOperatorById(b.operator_id),
          getResortById(b.resort_id),
          getServiceById(b.service_id),
          getSlotById(b.availability_slot_id),
        ])
        setOperator(op)
        setResort(res)
        setService(svc)
        setSlot(sl)
      } catch (err) {
        toast.error('Could not load booking')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id])

  async function handleCancel() {
    if (!booking) return
    setCancelling(true)
    try {
      const updated = await updateBookingStatus(booking.id, 'cancelled') as BookingWithParticipants
      setBooking(updated)
      setShowCancel(false)
      toast.success('Booking cancelled')
    } catch {
      toast.error('Could not cancel booking')
    } finally {
      setCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!booking || !operator || !resort || !service || !slot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-2">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm">Booking not found</p>
        <Link to="/my-trips" className="text-sm text-blue-600 hover:underline">Back to my trips</Link>
      </div>
    )
  }

  const colors = STATUS_COLORS[booking.status]
  const Icon = SERVICE_ICONS[service.type] ?? Ticket
  const participants = booking.booking_participants ?? []
  const slotDate = parseISO(slot.date)
  const canCancel =
    (booking.status === 'pending' || booking.status === 'confirmed') && isFuture(slotDate)

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-24">
        {/* Status bar */}
        <div className={`h-1.5 w-full ${colors.bar}`} />

        {/* Top nav */}
        <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100">
          <button
            onClick={() => navigate('/my-trips')}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-gray-400">Booking</p>
            <p className="text-sm font-mono font-medium text-gray-700">
              #{booking.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full bg-gray-50 ${colors.text}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>

        <div className="px-4 py-5 space-y-4">
          {/* Service hero card */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900">{service.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{operator.name}</p>
                <span className="inline-block mt-2 text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-medium">
                  {TYPE_LABELS[booking.type] ?? booking.type}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span>{format(slotDate, 'EEEE, d MMMM yyyy')}</span>
              </div>
              {slot.start_time && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>
                    {slot.start_time.slice(0, 5)}
                    {slot.end_time && ` – ${slot.end_time.slice(0, 5)}`}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin className="w-4 h-4 text-gray-400" />
                <span>{resort.name}, {resort.country}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 text-gray-400" />
                <span>
                  {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
                </span>
              </div>
            </div>
          </div>

          {/* QR code (only for non-cancelled, non-completed) */}
          {booking.status !== 'cancelled' && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <BadgeCheck className="w-4 h-4 text-green-500" />
                Check-in QR
              </h2>
              <QRPanel bookingId={booking.id} />
            </div>
          )}

          {/* Participants */}
          {participants.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-2">Participants</h2>
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <ParticipantRow key={p.id} p={p} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Price */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Total paid</h2>
            <p className="text-3xl font-bold text-gray-900">
              {booking.currency} {booking.total_price.toFixed(2)}
            </p>
            {booking.customer_notes && (
              <p className="text-xs text-gray-400 mt-2">{booking.customer_notes}</p>
            )}
          </div>

          {/* Operator link */}
          <Link
            to={`/resorts/${resort.id}/operators/${operator.id}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4"
          >
            <div className="flex items-center gap-3">
              {operator.logo_url ? (
                <img src={operator.logo_url} alt={operator.name} className="w-10 h-10 rounded-xl object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400">
                  <Mountain className="w-5 h-5" />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-900">{operator.name}</p>
                <p className="text-xs text-gray-400">View operator page</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </Link>

          {/* Cancel */}
          {canCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full py-3.5 border border-red-200 text-red-600 rounded-2xl text-sm font-medium hover:bg-red-50 transition-colors"
            >
              Cancel booking
            </button>
          )}
        </div>
      </div>

      {showCancel && (
        <CancelSheet
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
          busy={cancelling}
        />
      )}
    </>
  )
}
