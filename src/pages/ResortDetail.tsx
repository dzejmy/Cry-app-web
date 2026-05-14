import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Mountain, Bike, Globe, ArrowLeft, Star } from 'lucide-react'
import { getResortById } from '../lib/supabase/resorts'
import { getOperatorsByResort } from '../lib/supabase/operators'
import { getServicesByOperator } from '../lib/supabase/services'
import { useSeasonStore } from '../store/seasonStore'
import type { Resort, Operator, Service, SeasonMode } from '../types'
import Skeleton, { SkeletonListItem } from '../components/ui/Skeleton'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'

const COUNTRY_FLAG: Record<string, string> = {
  SK: '🇸🇰',
  AT: '🇦🇹',
  FR: '🇫🇷',
  CH: '🇨🇭',
  IT: '🇮🇹',
  DE: '🇩🇪',
  SI: '🇸🇮',
  CZ: '🇨🇿',
}

const HERO_GRADIENTS: Record<SeasonMode, string> = {
  winter: 'from-slate-800 via-blue-900 to-blue-700',
  summer: 'from-emerald-900 via-green-800 to-emerald-600',
}

interface OperatorWithServices {
  operator: Operator
  services: Service[]
}

export default function ResortDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const globalSeason = useSeasonStore((s) => s.season)

  const [resort, setResort] = useState<Resort | null>(null)
  const [operatorsData, setOperatorsData] = useState<OperatorWithServices[]>([])
  const [loadingResort, setLoadingResort] = useState(true)
  const [loadingOperators, setLoadingOperators] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Active tab defaults to current global season, but only if the resort supports it
  const [activeTab, setActiveTab] = useState<SeasonMode>(globalSeason)

  useEffect(() => {
    if (!id) return
    setLoadingResort(true)
    getResortById(id)
      .then((data) => {
        setResort(data)
        // If the resort doesn't support the global season, switch to the other
        if (!data.season_modes.includes(globalSeason)) {
          const fallback = data.season_modes[0] ?? globalSeason
          setActiveTab(fallback)
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingResort(false))
  }, [id, globalSeason])

  useEffect(() => {
    if (!id) return
    setLoadingOperators(true)
    getOperatorsByResort(id)
      .then((operators) =>
        Promise.all(
          operators.map(async (op) => ({
            operator: op,
            services: await getServicesByOperator(op.id, id),
          })),
        ),
      )
      .then(setOperatorsData)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingOperators(false))
  }, [id])

  const filteredOperators = operatorsData.filter((od) =>
    od.services.some((s) => s.season_mode === activeTab),
  )

  if (error) {
    return (
      <div className="pt-16 pb-24 px-4 max-w-screen-lg mx-auto">
        <div className="mt-8 rounded-xl bg-red-50 border border-red-200 p-6 text-center">
          <p className="text-red-700 font-medium">{error}</p>
          <Button variant="ghost" size="sm" className="mt-4" onClick={() => navigate(-1)}>
            Go back
          </Button>
        </div>
      </div>
    )
  }

  const heroBg = HERO_GRADIENTS[activeTab]

  return (
    <div className="pb-24 lg:pb-8">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className={`relative bg-gradient-to-br ${heroBg} text-white transition-all duration-700`}>
        {/* Back button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-20 left-4 z-10 flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="pt-28 pb-10 px-4 max-w-screen-lg mx-auto">
          {loadingResort ? (
            <div className="space-y-3 max-w-sm">
              <Skeleton width="w-48" height="h-8" />
              <Skeleton width="w-64" height="h-4" />
            </div>
          ) : resort ? (
            <>
              <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>{resort.region}</span>
                <span>·</span>
                <span>{COUNTRY_FLAG[resort.country] ?? ''} {resort.country}</span>
                {resort.elevation_m && (
                  <>
                    <span>·</span>
                    <Mountain className="w-3.5 h-3.5" />
                    <span>{resort.elevation_m.toLocaleString()} m</span>
                  </>
                )}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold">{resort.name}</h1>
              <p className="text-white/70 mt-3 max-w-xl text-sm leading-relaxed">
                {resort.description}
              </p>

              {/* Badges row */}
              <div className="flex flex-wrap gap-2 mt-4">
                {resort.season_modes.map((m) => (
                  <span
                    key={m}
                    className={[
                      'flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full',
                      m === 'winter' ? 'bg-sky-500/30 text-sky-200' : 'bg-emerald-500/30 text-emerald-200',
                    ].join(' ')}
                  >
                    {m === 'winter' ? <Mountain className="w-3 h-3" /> : <Bike className="w-3 h-3" />}
                    {m === 'winter' ? 'Ski' : 'Bike'}
                  </span>
                ))}
                {resort.website_url && (
                  <a
                    href={resort.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-white/70 hover:text-white transition-colors"
                  >
                    <Globe className="w-3 h-3" />
                    Website
                  </a>
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Season tabs */}
        {resort && resort.season_modes.length > 1 && (
          <div className="px-4 max-w-screen-lg mx-auto border-t border-white/10">
            <div className="flex gap-1 -mb-px">
              {resort.season_modes.map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveTab(m)}
                  className={[
                    'flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors',
                    activeTab === m
                      ? 'border-white text-white'
                      : 'border-transparent text-white/50 hover:text-white/80',
                  ].join(' ')}
                >
                  {m === 'winter' ? <Mountain className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
                  {m === 'winter' ? 'Ski Schools & Rentals' : 'Bike Guides & Rentals'}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Operators ────────────────────────────────────────────────────── */}
      <div className="px-4 py-8 max-w-screen-lg mx-auto">
        {loadingOperators ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonListItem key={i} />
            ))}
          </div>
        ) : filteredOperators.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            {activeTab === 'winter' ? (
              <Mountain className="w-10 h-10 mx-auto mb-3 opacity-30" />
            ) : (
              <Bike className="w-10 h-10 mx-auto mb-3 opacity-30" />
            )}
            <p className="text-sm font-medium">No operators offering {activeTab} services here yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {activeTab === 'winter' ? 'Ski Schools & Rentals' : 'Bike Guides & Rentals'}
              <span className="ml-2 text-sm font-normal text-gray-400">
                ({filteredOperators.length})
              </span>
            </h2>

            {filteredOperators.map(({ operator, services }) => {
              const seasonServices = services.filter((s) => s.season_mode === activeTab)
              const minPrice = Math.min(...seasonServices.map((s) => s.price_per_person))

              return (
                <div
                  key={operator.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{operator.name}</h3>
                        {/* Placeholder star rating — no reviews data loaded on this page */}
                        <div className="flex items-center gap-0.5 text-amber-400">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current opacity-30" />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">{operator.description}</p>

                      {/* Service badges */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {seasonServices.map((s) => (
                          <Badge key={s.id} variant={s.type} />
                        ))}
                      </div>
                    </div>

                    {/* Price + CTA */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      {isFinite(minPrice) && (
                        <div className="text-right">
                          <p className="text-xs text-gray-400">from</p>
                          <p className="text-lg font-bold text-gray-900">
                            €{minPrice.toFixed(0)}
                          </p>
                          <p className="text-xs text-gray-400">/ person</p>
                        </div>
                      )}
                      <Button
                        size="sm"
                        onClick={() =>
                          navigate(`/resorts/${id}/operators/${operator.id}`)
                        }
                      >
                        View offer
                      </Button>
                    </div>
                  </div>

                  {/* Contact info */}
                  {(operator.phone || operator.email) && (
                    <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-50 text-xs text-gray-400">
                      {operator.phone && <span>{operator.phone}</span>}
                      {operator.email && <span>{operator.email}</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
