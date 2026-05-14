import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Mountain, Bike, SlidersHorizontal } from 'lucide-react'
import { getResorts } from '../lib/supabase/resorts'
import { useSeasonStore } from '../store/seasonStore'
import type { Resort, SeasonMode } from '../types'
import { SkeletonCard } from '../components/ui/Skeleton'

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

const CARD_GRADIENTS = [
  'from-blue-600 to-indigo-700',
  'from-emerald-600 to-teal-700',
  'from-violet-600 to-purple-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-cyan-600 to-sky-700',
]

function resortGradient(id: string): string {
  const code = id.charCodeAt(0) + id.charCodeAt(id.length - 1)
  return CARD_GRADIENTS[code % CARD_GRADIENTS.length]
}

export default function ResortList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const globalSeason = useSeasonStore((s) => s.season)

  const [resorts, setResorts] = useState<Resort[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters — initialise query from URL param set by Home search
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [countryFilter, setCountryFilter] = useState<string>('')
  const [seasonFilter, setSeasonFilter] = useState<SeasonMode | ''>('')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getResorts()
      .then(setResorts)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Sync query to URL so the param persists on back-navigation from ResortDetail
  useEffect(() => {
    if (query) {
      setSearchParams({ q: query }, { replace: true })
    } else {
      setSearchParams({}, { replace: true })
    }
  }, [query, setSearchParams])

  const countries = useMemo(
    () => [...new Set(resorts.map((r) => r.country))].sort(),
    [resorts],
  )

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return resorts.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q) && !r.region.toLowerCase().includes(q)) return false
      if (countryFilter && r.country !== countryFilter) return false
      if (seasonFilter && !r.season_modes.includes(seasonFilter)) return false
      return true
    })
  }, [resorts, query, countryFilter, seasonFilter])

  const activeSeason = seasonFilter || globalSeason

  return (
    <div className="pt-16 pb-24 lg:pb-8 px-4 max-w-screen-lg mx-auto">
      {/* Header */}
      <div className="py-6">
        <h1 className="text-2xl font-bold text-gray-900">Resorts</h1>
        <p className="text-sm text-gray-500 mt-1">
          {loading ? 'Loading…' : `${filtered.length} resort${filtered.length !== 1 ? 's' : ''} found`}
        </p>
      </div>

      {/* Search + filter row */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or region…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={[
            'flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border text-sm font-medium transition-colors',
            showFilters || countryFilter || seasonFilter
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50',
          ].join(' ')}
          aria-expanded={showFilters}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {(countryFilter || seasonFilter) && (
            <span className="ml-1 w-2 h-2 rounded-full bg-blue-500" aria-hidden />
          )}
        </button>
      </div>

      {/* Expandable filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100">
          {/* Country */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <label className="text-xs font-medium text-gray-500">Country</label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="rounded-lg border border-gray-200 text-sm px-2.5 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All countries</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_FLAG[c] ?? ''} {c}
                </option>
              ))}
            </select>
          </div>

          {/* Season */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-gray-500">Season</label>
            <div className="flex gap-2">
              {(['winter', 'summer'] as SeasonMode[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSeasonFilter((prev) => (prev === s ? '' : s))}
                  className={[
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors',
                    seasonFilter === s
                      ? s === 'winter'
                        ? 'bg-sky-100 border-sky-400 text-sky-700'
                        : 'bg-emerald-100 border-emerald-400 text-emerald-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50',
                  ].join(' ')}
                >
                  {s === 'winter' ? <Mountain className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {(countryFilter || seasonFilter) && (
            <button
              onClick={() => { setCountryFilter(''); setSeasonFilter('') }}
              className="self-end text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700 mb-6">
          {error}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.map((resort) => (
              <button
                key={resort.id}
                onClick={() => navigate(`/resorts/${resort.id}`)}
                className="group text-left rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {/* Gradient */}
                <div
                  className={`h-40 bg-gradient-to-br ${resortGradient(resort.id)} relative flex items-end p-4`}
                >
                  <span className="text-3xl absolute top-3 right-4">
                    {COUNTRY_FLAG[resort.country] ?? '🏔️'}
                  </span>
                  {resort.elevation_m && (
                    <span className="text-white/80 text-xs font-medium bg-black/20 px-2 py-0.5 rounded-full">
                      {resort.elevation_m.toLocaleString()} m
                    </span>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 bg-white border border-t-0 border-gray-100 rounded-b-2xl">
                  <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {resort.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{resort.region}</p>

                  <div className="flex gap-1 mt-3 flex-wrap">
                    {resort.season_modes.map((m) => (
                      <span
                        key={m}
                        className={[
                          'text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
                          m === 'winter'
                            ? activeSeason === 'winter'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-gray-100 text-gray-500'
                            : activeSeason === 'summer'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-gray-100 text-gray-500',
                        ].join(' ')}
                      >
                        {m === 'winter' ? '⛷' : '🚴'} {m}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
      </div>

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No resorts match your filters.</p>
          <button
            onClick={() => { setQuery(''); setCountryFilter(''); setSeasonFilter('') }}
            className="mt-3 text-sm text-blue-500 hover:text-blue-700 underline"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  )
}
