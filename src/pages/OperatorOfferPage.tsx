import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Star, GraduationCap, Package, Bike, Compass,
  Globe, Phone, Mail, ChevronLeft, ChevronRight, X, Mountain,
  Clock, Users, CalendarDays, ImageOff, CheckCircle2,
} from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, formatDistanceToNow,
} from 'date-fns'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

import { getResortById } from '../lib/supabase/resorts'
import { getOperatorById } from '../lib/supabase/operators'
import { getOfferPage } from '../lib/supabase/operators'
import { getServicesByOperator } from '../lib/supabase/services'
import { getAvailableSlots } from '../lib/supabase/availability'
import { getReviewsByOperator } from '../lib/supabase/reviews'

import type { Resort, Operator, OfferPageContent, Service, Review, ServiceType } from '../types'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import StarRating from '../components/ui/StarRating'
import Skeleton, { SkeletonCard, SkeletonListItem } from '../components/ui/Skeleton'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined

const SERVICE_ICON: Record<ServiceType, React.ReactNode> = {
  ski_school:  <GraduationCap className="w-5 h-5" />,
  ski_rental:  <Package className="w-5 h-5" />,
  bike_rental: <Bike className="w-5 h-5" />,
  bike_guiding:<Compass className="w-5 h-5" />,
}

const SERVICE_LABEL: Record<ServiceType, string> = {
  ski_school:  'Ski School',
  ski_rental:  'Ski Rental',
  bike_rental: 'Bike Rental',
  bike_guiding:'Bike Guiding',
}

const SERVICE_COLOR: Record<ServiceType, string> = {
  ski_school:  'bg-sky-50 text-sky-700 border-sky-200',
  ski_rental:  'bg-cyan-50 text-cyan-700 border-cyan-200',
  bike_rental: 'bg-orange-50 text-orange-700 border-orange-200',
  bike_guiding:'bg-lime-50 text-lime-700 border-lime-200',
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────

function MiniCalendar({
  month,
  availableDates,
  loading,
  onPrev,
  onNext,
}: {
  month: Date
  availableDates: Set<string>
  loading: boolean
  onPrev: () => void
  onNext: () => void
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) })
  const startPad = (getDay(startOfMonth(month)) + 6) % 7 // Monday-first

  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={onPrev}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {format(month, 'MMMM yyyy')}
        </span>
        <button
          onClick={onNext}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
          <span key={d} className="text-[10px] font-medium text-gray-400 py-1">
            {d}
          </span>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: startPad }).map((_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const isToday = dateStr === todayStr
          const isAvail = availableDates.has(dateStr)
          const isPast = dateStr < todayStr

          return (
            <div
              key={dateStr}
              className={[
                'flex flex-col items-center py-1 rounded-lg',
                isToday ? 'bg-blue-50 ring-1 ring-blue-300' : '',
                isPast ? 'opacity-40' : '',
              ].join(' ')}
            >
              <span
                className={[
                  'text-xs leading-4',
                  isToday ? 'font-bold text-blue-700' : 'text-gray-600',
                ].join(' ')}
              >
                {format(day, 'd')}
              </span>
              {loading ? (
                <span className="w-1.5 h-1.5 rounded-full bg-gray-200 mt-0.5 animate-pulse" />
              ) : (
                <span
                  className={[
                    'w-1.5 h-1.5 rounded-full mt-0.5',
                    isPast ? 'bg-gray-200' : isAvail ? 'bg-green-500' : 'bg-gray-200',
                  ].join(' ')}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Available
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-200" />
          Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-50 ring-1 ring-blue-300 inline-block" />
          Today
        </span>
      </div>
    </div>
  )
}

// ─── Service Selection Sheet ──────────────────────────────────────────────────

function ServiceSheet({
  open,
  onClose,
  services,
  resort,
  operatorId,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  services: Service[]
  resort: Resort | null
  operatorId: string
  onSelect: (service: Service) => void
}) {
  // Group by service type
  const byType = services.reduce<Partial<Record<ServiceType, Service[]>>>((acc, s) => {
    ;(acc[s.type] ??= []).push(s)
    return acc
  }, {})
  const types = Object.keys(byType) as ServiceType[]

  const hasSchool = !!byType['ski_school']?.length
  const hasRental = !!byType['ski_rental']?.length || !!byType['bike_rental']?.length

  return (
    <div
      className={[
        'fixed inset-0 z-50 flex flex-col justify-end transition-opacity duration-300',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      ].join(' ')}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <div
        className={[
          'relative bg-white rounded-t-2xl shadow-xl px-5 pt-5 pb-10 transition-transform duration-300 max-h-[85vh] overflow-y-auto',
          open ? 'translate-y-0' : 'translate-y-full',
        ].join(' ')}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5" />

        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">What do you need?</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rental add-on hint */}
        {hasSchool && hasRental && (
          <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4 text-sm text-blue-700">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
            <span>Equipment rental can be added during the booking flow.</span>
          </div>
        )}

        <div className="space-y-3">
          {types.map((type) => {
            const group = byType[type]!
            const minPrice = Math.min(...group.map((s) => s.price_per_person))
            const firstService = group[0]

            return (
              <button
                key={type}
                onClick={() => onSelect(firstService)}
                className={[
                  'w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all hover:shadow-sm active:scale-[0.98]',
                  SERVICE_COLOR[type],
                ].join(' ')}
              >
                <div className="shrink-0">{SERVICE_ICON[type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{SERVICE_LABEL[type]}</p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {group.length} option{group.length > 1 ? 's' : ''} · from €{minPrice.toFixed(0)} / person
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 opacity-40 shrink-0" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OperatorOfferPage() {
  const { resortId, operatorId } = useParams<{ resortId: string; operatorId: string }>()
  const navigate = useNavigate()

  // Data
  const [resort, setResort] = useState<Resort | null>(null)
  const [operator, setOperator] = useState<Operator | null>(null)
  const [offerPage, setOfferPage] = useState<OfferPageContent | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [reviews, setReviews] = useState<Review[]>([])

  // Loading states
  const [loadingCore, setLoadingCore] = useState(true)
  const [loadingReviews, setLoadingReviews] = useState(true)

  // Availability calendar
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [availableDates, setAvailableDates] = useState<Set<string>>(new Set())
  const [loadingAvail, setLoadingAvail] = useState(false)

  // UI state
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null)
  const [bookingSheetOpen, setBookingSheetOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Map
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<mapboxgl.Map | null>(null)

  // ── Data fetching ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!resortId || !operatorId) return
    setLoadingCore(true)

    Promise.all([
      getResortById(resortId),
      getOperatorById(operatorId),
      getOfferPage(operatorId, resortId),
      getServicesByOperator(operatorId, resortId),
    ])
      .then(([r, op, page, svcs]) => {
        setResort(r)
        setOperator(op)
        setOfferPage(page)
        setServices(svcs)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingCore(false))
  }, [resortId, operatorId])

  useEffect(() => {
    if (!operatorId) return
    setLoadingReviews(true)
    getReviewsByOperator(operatorId)
      .then(setReviews)
      .catch(console.error)
      .finally(() => setLoadingReviews(false))
  }, [operatorId])

  // Availability for calendar month
  useEffect(() => {
    if (services.length === 0) return
    setLoadingAvail(true)

    const range = {
      from: startOfMonth(calendarMonth),
      to: endOfMonth(calendarMonth),
    }

    Promise.all(services.map((s) => getAvailableSlots(s.id, range)))
      .then((allSlots) => {
        const dates = new Set<string>()
        allSlots.flat().forEach((slot) => dates.add(slot.date))
        setAvailableDates(dates)
      })
      .catch(console.error)
      .finally(() => setLoadingAvail(false))
  }, [services, calendarMonth])

  // Mapbox
  useEffect(() => {
    if (!resort || !mapContainerRef.current || !MAPBOX_TOKEN) return
    if (mapInstanceRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [resort.longitude, resort.latitude],
      zoom: 11,
      interactive: false,
    })
    new mapboxgl.Marker({ color: '#3b82f6' })
      .setLngLat([resort.longitude, resort.latitude])
      .addTo(map)
    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [resort])

  // ── Derived data ───────────────────────────────────────────────────────────

  const allImages = [
    ...(offerPage?.hero_image_url ? [offerPage.hero_image_url] : []),
    ...services.flatMap((s) => s.image_urls),
  ].filter(Boolean)

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0

  const serviceTypes = [...new Set(services.map((s) => s.type))]

  // ── Booking navigation ─────────────────────────────────────────────────────

  const navigateToBooking = useCallback(
    (service: Service) => {
      if (!resort) return
      if (service.type === 'ski_rental') {
        navigate(`/book/ski-rental/${operatorId}/${resortId}`)
      } else if (service.type === 'ski_school') {
        navigate(`/book/ski-school/${operatorId}/${resortId}`)
      } else if (service.type === 'bike_rental') {
        navigate(`/book/bike-rental/${operatorId}/${resortId}`)
      } else if (service.type === 'bike_guiding') {
        navigate(`/book/bike-guiding/${operatorId}/${resortId}`)
      } else {
        navigate(`/book/${resort.slug}/${operatorId}/${service.id}`)
      }
    },
    [resort, resortId, operatorId, navigate],
  )

  const handleBookNow = useCallback(() => {
    if (services.length === 0) return
    if (serviceTypes.length === 1) {
      navigateToBooking(services[0])
    } else {
      setBookingSheetOpen(true)
    }
  }, [services, serviceTypes, navigateToBooking])

  // ── Error / hero background ────────────────────────────────────────────────

  const heroImage = offerPage?.hero_image_url ?? null
  const heroBg = heroImage
    ? `url(${heroImage})`
    : undefined
  const heroBgClass = heroImage
    ? ''
    : resort?.season_modes.includes('winter')
      ? 'bg-gradient-to-br from-slate-800 via-blue-900 to-blue-700'
      : 'bg-gradient-to-br from-emerald-900 via-green-800 to-emerald-600'

  // ── Render ────────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="pt-20 px-4 max-w-screen-lg mx-auto">
        <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-center mt-8">
          <p className="text-red-700 font-medium">{error}</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-28">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div
        className={['relative h-72 sm:h-96 text-white overflow-hidden', heroBgClass].join(' ')}
        style={heroBg ? { backgroundImage: heroBg, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/30" />

        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-20 left-4 z-10 flex items-center gap-1.5 text-white/80 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        {/* Hero content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 max-w-screen-lg mx-auto">
          {loadingCore ? (
            <div className="space-y-2">
              <Skeleton width="w-12" height="h-12" circle />
              <Skeleton width="w-48" height="h-7" className="bg-white/20" />
              <Skeleton width="w-32" height="h-4" className="bg-white/20" />
            </div>
          ) : operator ? (
            <div className="flex items-end gap-4">
              {/* Logo */}
              {operator.logo_url ? (
                <img
                  src={operator.logo_url}
                  alt={operator.name}
                  className="w-14 h-14 rounded-xl object-cover ring-2 ring-white/30 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shrink-0">
                  {operator.name[0]}
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h1 className="text-2xl sm:text-3xl font-bold leading-tight">{operator.name}</h1>

                {/* Location + rating row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  {resort && (
                    <span className="flex items-center gap-1 text-sm text-white/80">
                      <MapPin className="w-3.5 h-3.5" />
                      {resort.name}
                    </span>
                  )}
                  {reviews.length > 0 && (
                    <span className="flex items-center gap-1.5 text-sm text-white/80">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {avgRating.toFixed(1)}
                      <span className="text-white/50">({reviews.length})</span>
                    </span>
                  )}
                </div>

                {/* Service type badges */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {serviceTypes.map((t) => (
                    <span key={t} className="text-[10px] font-semibold bg-white/15 backdrop-blur-sm px-2 py-0.5 rounded-full">
                      {SERVICE_LABEL[t]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Page body ─────────────────────────────────────────────────────── */}
      <div className="max-w-screen-lg mx-auto px-4">

        {/* ── Photo gallery ──────────────────────────────────────────────── */}
        {!loadingCore && (
          <section className="py-8">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Photos</h2>
            {allImages.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 snap-x snap-mandatory">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIndex(i)}
                    className="shrink-0 w-52 h-36 rounded-xl overflow-hidden snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <img
                      src={url}
                      alt={`Photo ${i + 1}`}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-28 rounded-xl bg-gray-50 border border-dashed border-gray-200 text-gray-400 gap-2">
                <ImageOff className="w-6 h-6 opacity-40" />
                <p className="text-xs">No photos available</p>
              </div>
            )}
          </section>
        )}

        {/* ── About ──────────────────────────────────────────────────────── */}
        <section className="py-8 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3">About</h2>
          {loadingCore ? (
            <div className="space-y-2">
              <Skeleton height="h-4" />
              <Skeleton height="h-4" />
              <Skeleton width="w-3/4" height="h-4" />
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-600 leading-relaxed">{operator?.description}</p>

              {/* Offer page headline + highlights */}
              {offerPage && (
                <div className="mt-4">
                  {offerPage.subheadline && (
                    <p className="text-sm font-medium text-gray-700 mb-2">{offerPage.subheadline}</p>
                  )}
                  {offerPage.highlights.length > 0 && (
                    <ul className="space-y-2">
                      {offerPage.highlights.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Contact row */}
              {operator && (operator.phone || operator.email || operator.website_url) && (
                <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-gray-100">
                  {operator.phone && (
                    <a
                      href={`tel:${operator.phone}`}
                      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {operator.phone}
                    </a>
                  )}
                  {operator.email && (
                    <a
                      href={`mailto:${operator.email}`}
                      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      {operator.email}
                    </a>
                  )}
                  {operator.website_url && (
                    <a
                      href={operator.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      Website
                    </a>
                  )}
                </div>
              )}
            </>
          )}
        </section>

        {/* ── Services ───────────────────────────────────────────────────── */}
        <section className="py-8 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Services</h2>
          {loadingCore ? (
            <div className="grid sm:grid-cols-2 gap-4">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : services.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Mountain className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No services listed yet.</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4"
                >
                  {/* Type + badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className={['flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-medium', SERVICE_COLOR[service.type]].join(' ')}>
                      {SERVICE_ICON[service.type]}
                      {SERVICE_LABEL[service.type]}
                    </div>
                    <Badge variant={service.type} />
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900">{service.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 line-clamp-2">{service.description}</p>
                  </div>

                  {/* Meta row */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {service.duration_minutes >= 60
                        ? `${service.duration_minutes / 60}h`
                        : `${service.duration_minutes}min`}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      Max {service.max_participants}
                    </span>
                    {service.min_age && (
                      <span>Age {service.min_age}+</span>
                    )}
                  </div>

                  {/* Price + CTA */}
                  <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-50">
                    <div>
                      <span className="text-xl font-bold text-gray-900">
                        €{service.price_per_person.toFixed(0)}
                      </span>
                      <span className="text-xs text-gray-400 ml-1">/ person</span>
                    </div>
                    <Button size="sm" onClick={() => navigateToBooking(service)}>
                      Book Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Instructor / Guide profiles ─────────────────────────────────── */}
        <section className="py-8 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Instructors & Guides</h2>
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-4 text-sm text-gray-500">
            <GraduationCap className="w-5 h-5 text-gray-400 shrink-0" />
            <span>Instructor profiles will be available once the operator adds them.</span>
          </div>
        </section>

        {/* ── Availability calendar ───────────────────────────────────────── */}
        <section className="py-8 border-t border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-bold text-gray-900">Availability</h2>
          </div>
          <div className="bg-gray-50 rounded-2xl p-5 max-w-sm">
            <MiniCalendar
              month={calendarMonth}
              availableDates={availableDates}
              loading={loadingAvail}
              onPrev={() => setCalendarMonth((m) => subMonths(m, 1))}
              onNext={() => setCalendarMonth((m) => addMonths(m, 1))}
            />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Select a date during booking to see exact time slots.
          </p>
        </section>

        {/* ── Mapbox location ─────────────────────────────────────────────── */}
        {resort && (
          <section className="py-8 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <MapPin className="w-5 h-5 text-gray-400" />
              <h2 className="text-lg font-bold text-gray-900">Location</h2>
            </div>
            {MAPBOX_TOKEN ? (
              <div
                ref={mapContainerRef}
                className="h-56 sm:h-72 rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
              />
            ) : (
              <div className="h-40 rounded-2xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 gap-2">
                <MapPin className="w-6 h-6 opacity-30" />
                <p className="text-xs text-center">
                  {resort.name} · {resort.region}<br />
                  <span className="text-[10px]">Add VITE_MAPBOX_TOKEN to enable the map</span>
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── Reviews ────────────────────────────────────────────────────── */}
        <section className="py-8 border-t border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Reviews</h2>

          {loadingReviews ? (
            <div className="space-y-4">
              <SkeletonListItem />
              <SkeletonListItem />
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No reviews yet — be the first!</p>
            </div>
          ) : (
            <>
              {/* Rating summary */}
              <div className="flex items-center gap-4 bg-gray-50 rounded-2xl p-5 mb-6">
                <div className="text-center">
                  <p className="text-4xl font-bold text-gray-900">{avgRating.toFixed(1)}</p>
                  <StarRating value={Math.round(avgRating)} size="sm" className="mt-1 justify-center" />
                  <p className="text-xs text-gray-400 mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Rating breakdown */}
                <div className="flex-1 space-y-1">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.rating === star).length
                    const pct = reviews.length > 0 ? (count / reviews.length) * 100 : 0
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-3">{star}</span>
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-5 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Individual reviews */}
              <div className="space-y-4">
                {reviews.map((review) => (
                  <div key={review.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                    <div className="flex items-start justify-between gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        G
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-gray-800">Verified Guest</span>
                          <span className="text-xs text-gray-400">
                            {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <StarRating value={review.rating} size="sm" className="mt-0.5" />
                      </div>
                    </div>

                    {review.title && (
                      <p className="font-medium text-sm text-gray-800 mt-3">{review.title}</p>
                    )}
                    <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{review.body}</p>

                    {/* Operator reply */}
                    {review.operator_reply && (
                      <div className="mt-3 pt-3 border-t border-gray-50 bg-gray-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Reply from operator</p>
                        <p className="text-xs text-gray-600 leading-relaxed">{review.operator_reply}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>

      </div>

      {/* ── Sticky Book Now bar ────────────────────────────────────────────── */}
      {!loadingCore && services.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-gray-100 px-4 py-3"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-screen-lg mx-auto flex items-center gap-4">
            {reviews.length > 0 && (
              <div className="flex items-center gap-1.5 shrink-0">
                <StarRating value={Math.round(avgRating)} size="sm" />
                <span className="text-xs text-gray-500">{avgRating.toFixed(1)}</span>
              </div>
            )}
            <Button size="lg" className="flex-1" onClick={handleBookNow}>
              Book Now
            </Button>
          </div>
        </div>
      )}

      {/* ── Service selection sheet ────────────────────────────────────────── */}
      <ServiceSheet
        open={bookingSheetOpen}
        onClose={() => setBookingSheetOpen(false)}
        services={services}
        resort={resort}
        operatorId={operatorId ?? ''}
        onSelect={(service) => {
          setBookingSheetOpen(false)
          navigateToBooking(service)
        }}
      />

      {/* ── Gallery lightbox ───────────────────────────────────────────────── */}
      {galleryIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setGalleryIndex(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            onClick={() => setGalleryIndex(null)}
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Prev */}
          {galleryIndex > 0 && (
            <button
              className="absolute left-4 p-2 text-white/70 hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setGalleryIndex((i) => (i ?? 1) - 1) }}
              aria-label="Previous"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          <img
            src={allImages[galleryIndex]}
            alt={`Photo ${galleryIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Next */}
          {galleryIndex < allImages.length - 1 && (
            <button
              className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setGalleryIndex((i) => (i ?? 0) + 1) }}
              aria-label="Next"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Counter */}
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm">
            {galleryIndex + 1} / {allImages.length}
          </span>
        </div>
      )}

    </div>
  )
}
