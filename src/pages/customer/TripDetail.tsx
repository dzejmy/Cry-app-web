import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { format, parseISO, differenceInHours } from 'date-fns'
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
  Download,
  Sparkles,
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

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingWithParticipants = Booking & { booking_participants: BookingParticipant[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending:   'Payment pending',
  confirmed: 'Confirmed',
  arrived:   'Checked in',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<BookingStatus, { bar: string; badge: string; text: string }> = {
  pending:   { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
  confirmed: { bar: 'bg-green-500', badge: 'bg-green-100 text-green-700', text: 'text-green-700' },
  arrived:   { bar: 'bg-blue-500',  badge: 'bg-blue-100 text-blue-700',   text: 'text-blue-700'  },
  completed: { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', text: 'text-slate-600' },
  cancelled: { bar: 'bg-red-500',   badge: 'bg-red-100 text-red-600',     text: 'text-red-600'   },
}

const TYPE_LABELS: Record<string, string> = {
  school_only:  'Ski School',
  rental_only:  'Equipment Rental',
  guiding_only: 'Guided Tour',
  bundle:       'School + Rental Bundle',
}

const SKILL_LABELS: Record<SkillLevel, string> = {
  beginner:     'Beginner',
  intermediate: 'Intermediate',
  advanced:     'Advanced',
}

const SERVICE_META: Record<string, { icon: React.ElementType; color: string }> = {
  ski_school:   { icon: GraduationCap, color: 'bg-sky-50 text-sky-600' },
  ski_rental:   { icon: Package,       color: 'bg-blue-50 text-blue-600' },
  bike_guiding: { icon: Mountain,      color: 'bg-lime-50 text-lime-700' },
  bike_rental:  { icon: Bike,          color: 'bg-amber-50 text-amber-600' },
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="text-gray-900 font-medium text-right">{value}</span>
    </div>
  )
}

// ── QR lightbox ───────────────────────────────────────────────────────────────

function QRPanel({ bookingId }: { bookingId: string }) {
  const smallRef = useRef<HTMLCanvasElement>(null)
  const largeRef = useRef<HTMLCanvasElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (smallRef.current) {
      QRCode.toCanvas(smallRef.current, bookingId, { width: 180, margin: 2 })
    }
  }, [bookingId])

  useEffect(() => {
    if (open && largeRef.current) {
      QRCode.toCanvas(largeRef.current, bookingId, { width: 300, margin: 3 })
    }
  }, [open, bookingId])

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="relative rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow active:scale-95 transition-transform"
          aria-label="Tap to expand QR code"
        >
          <canvas ref={smallRef} className="block" />
          <div className="absolute inset-0 flex items-end justify-center pb-2 pointer-events-none">
            <div className="flex items-center gap-1 bg-black/40 text-white text-[10px] rounded-full px-2 py-0.5">
              <Maximize2 className="w-2.5 h-2.5" />
              Tap to expand
            </div>
          </div>
        </button>
        <div className="text-center">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 justify-center">
            <BadgeCheck className="w-4 h-4 text-green-500" />
            Show this at the meeting point
          </div>
          <p className="text-xs text-gray-400 mt-0.5">Operator will scan on arrival</p>
        </div>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl max-w-xs w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Check-in QR</p>
            <canvas ref={largeRef} className="rounded-2xl block" />
            <p className="text-xs text-gray-400 mt-4 text-center">
              Present this code to the operator on arrival
            </p>
            <button
              onClick={() => setOpen(false)}
              className="mt-5 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
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

function ParticipantCard({ p, index }: { p: BookingParticipant; index: number }) {
  const hasSchool = !!p.school_data
  const hasRental = !!p.rental_data

  return (
    <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
      {/* Name bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50/70">
        <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>
        <span className="font-semibold text-sm text-gray-900">
          {p.first_name} {p.last_name}
          {p.age != null && <span className="text-gray-400 font-normal ml-1.5">· {p.age} yrs</span>}
        </span>
        {hasRental && (
          <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">+ gear</span>
        )}
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-2">
        {hasSchool && (
          <>
            <Row label="Skill level" value={SKILL_LABELS[p.school_data!.skill_level]} />
            {p.school_data!.special_requirements && (
              <Row label="Notes" value={p.school_data!.special_requirements} />
            )}
          </>
        )}
        {hasRental && (
          <div className={hasSchool ? 'pt-2 mt-2 border-t border-gray-50 space-y-2' : 'space-y-2'}>
            <Row
              label="Equipment"
              value={
                p.rental_data!.equipment_type === 'ski'
                  ? '⛷ Skis'
                  : p.rental_data!.equipment_type === 'snowboard'
                  ? '🏂 Snowboard'
                  : p.rental_data!.equipment_type === 'bike'
                  ? '🚵 Bike'
                  : '⚡ E-Bike'
              }
            />
            {p.rental_data!.height_cm > 0 && (
              <Row label="Height" value={`${p.rental_data!.height_cm} cm`} />
            )}
            {p.rental_data!.weight_kg > 0 && (
              <Row label="Weight" value={`${p.rental_data!.weight_kg} kg`} />
            )}
            {p.rental_data!.boot_size > 0 && (
              <Row label="Boot / shoe" value={`EU ${p.rental_data!.boot_size}`} />
            )}
            {p.rental_data!.helmet_size && (
              <Row label="Helmet" value={p.rental_data!.helmet_size} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Cancel confirmation ───────────────────────────────────────────────────────

function CancelSheet({
  hoursUntil,
  onConfirm,
  onClose,
  busy,
}: {
  hoursUntil: number
  onConfirm: () => void
  onClose: () => void
  busy: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-3xl p-6 shadow-2xl max-w-lg mx-auto">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-3">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h2 className="font-bold text-gray-900 text-lg mb-1">Cancel this booking?</h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            {hoursUntil > 72
              ? 'Your activity is more than 72 hours away — a full refund may be available.'
              : `Your activity is in ${Math.round(hoursUntil)} hours. Check the operator's cancellation policy for refund eligibility.`}
          </p>
        </div>
        <button
          onClick={onConfirm}
          disabled={busy}
          className="w-full py-3.5 bg-red-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-50 mb-3 transition-opacity"
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TripDetail() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const navigate = useNavigate()

  const [booking, setBooking]   = useState<BookingWithParticipants | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [resort, setResort]     = useState<Resort | null>(null)
  const [service, setService]   = useState<Service | null>(null)
  const [slot, setSlot]         = useState<AvailabilitySlot | null>(null)
  const [loading, setLoading]   = useState(true)
  const [showCancel, setShowCancel]   = useState(false)
  const [cancelling, setCancelling]   = useState(false)

  useEffect(() => {
    if (!bookingId) return

    async function load() {
      try {
        const b = await getBookingById(bookingId!) as BookingWithParticipants
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
  }, [bookingId])

  async function handleCancel() {
    if (!booking) return
    setCancelling(true)
    try {
      const updated = await updateBookingStatus(booking.id, 'cancelled') as BookingWithParticipants
      setBooking(updated)
      setShowCancel(false)
      toast.success('Booking cancelled')
    } catch {
      toast.error('Could not cancel booking. Please contact the operator.')
    } finally {
      setCancelling(false)
    }
  }

  function handleDownloadPDF() {
    console.log('Download PDF for booking:', bookingId)
    toast('PDF download coming soon', { icon: '📄' })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="h-1.5 w-full bg-gray-200 animate-pulse" />
        <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100">
          <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="px-4 py-5 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-32 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!booking || !operator || !resort || !service || !slot) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-3">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm font-medium">Booking not found</p>
        <Link to="/trips" className="text-sm text-blue-600 hover:underline">← Back to My Trips</Link>
      </div>
    )
  }

  const colors = STATUS_COLORS[booking.status]
  const meta = SERVICE_META[service.type] ?? { icon: Ticket, color: 'bg-gray-100 text-gray-600' }
  const Icon = meta.icon
  const participants = booking.booking_participants ?? []
  const slotDate = parseISO(slot.date)
  const hoursUntilSlot = differenceInHours(slotDate, new Date())
  const canCancel =
    (booking.status === 'pending' || booking.status === 'confirmed') && hoursUntilSlot > 48

  return (
    <>
      <div className="min-h-screen bg-gray-50 pb-28">
        {/* Status colour bar */}
        <div className={`h-1.5 w-full ${colors.bar}`} />

        {/* Top nav */}
        <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-16 z-10">
          <button
            onClick={() => navigate('/trips')}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">Booking</p>
            <p className="text-sm font-mono font-semibold text-gray-700 truncate">
              #{booking.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full ${colors.badge}`}>
            {STATUS_LABELS[booking.status]}
          </span>
        </div>

        <div className="px-4 py-5 space-y-4 max-w-lg mx-auto">

          {/* Service hero */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${meta.color}`}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-base">{service.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">{operator.name}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <span className="inline-block text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 font-medium">
                    {TYPE_LABELS[booking.type] ?? booking.type}
                  </span>
                  {booking.type === 'bundle' && (
                    <span className="inline-flex items-center gap-0.5 text-xs px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 font-semibold">
                      <Sparkles className="w-3 h-3" /> Bundle
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 space-y-2.5">
              <div className="flex items-center gap-2.5 text-sm text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <span className="font-medium">{format(slotDate, 'EEEE, d MMMM yyyy')}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-700">
                <Clock className="w-4 h-4 text-gray-400 shrink-0" />
                <span>
                  {slot.start_time.slice(0, 5)}
                  {slot.end_time ? ` – ${slot.end_time.slice(0, 5)}` : ''}
                </span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-700">
                <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{resort.name}, {resort.country}</span>
              </div>
              <div className="flex items-center gap-2.5 text-sm text-gray-700">
                <Users className="w-4 h-4 text-gray-400 shrink-0" />
                <span>{participants.length} {participants.length === 1 ? 'participant' : 'participants'}</span>
              </div>
            </div>
          </div>

          {/* QR code */}
          {booking.status !== 'cancelled' && booking.status !== 'completed' && (
            <QRPanel bookingId={booking.id} />
          )}

          {/* Participants */}
          {participants.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-gray-700 mb-2.5 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-gray-400" />
                Participants
              </h2>
              <div className="space-y-2">
                {participants.map((p, i) => (
                  <ParticipantCard key={p.id} p={p} index={i} />
                ))}
              </div>
            </div>
          )}

          {/* Price breakdown */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-700 mb-3">Price</h2>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold text-gray-900">
                  {booking.currency} {booking.total_price.toFixed(2)}
                </p>
                {booking.customer_notes && (
                  <p className="text-xs text-gray-400 mt-1.5">{booking.customer_notes}</p>
                )}
              </div>
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-2 rounded-xl transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                PDF
              </button>
            </div>
          </div>

          {/* Operator link */}
          <Link
            to={`/resorts/${resort.id}/operators/${operator.id}`}
            className="flex items-center justify-between bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-100 transition-colors"
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
                <p className="text-xs text-gray-400">View operator page →</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-gray-400 shrink-0" />
          </Link>

          {/* Cancel button */}
          {canCancel && (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full py-3.5 border-2 border-red-200 text-red-600 rounded-2xl text-sm font-semibold hover:bg-red-50 transition-colors"
            >
              Cancel booking
            </button>
          )}

          {/* Non-cancellable notice */}
          {(booking.status === 'pending' || booking.status === 'confirmed') &&
            hoursUntilSlot > 0 && hoursUntilSlot <= 48 && (
            <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-100 rounded-xl p-4 text-xs text-amber-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
              <span>
                Cancellations are not available within 48 hours of the activity.
                Please contact the operator directly.
                {operator.phone && ` · ${operator.phone}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {showCancel && (
        <CancelSheet
          hoursUntil={hoursUntilSlot}
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
          busy={cancelling}
        />
      )}
    </>
  )
}
