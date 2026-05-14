import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Mountain, Bike, ChevronDown } from 'lucide-react'
import { getResorts } from '../lib/supabase/resorts'
import { useSeasonStore } from '../store/seasonStore'
import type { Resort } from '../types'
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

const HEADLINE_WORDS = ['Find,', 'book,', 'arrive', 'ready.']

export default function Home() {
  const navigate = useNavigate()
  const season = useSeasonStore((s) => s.season)

  const [query, setQuery] = useState('')
  const [resorts, setResorts] = useState<Resort[]>([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  const featuredRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setLoading(true)
    getResorts(season)
      .then((data) => setResorts(data.slice(0, 4)))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [season])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate(`/resorts${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`)
  }

  function scrollToFeatured() {
    featuredRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const isWinter = season === 'winter'

  const heroBg = isWinter
    ? 'from-slate-900 via-blue-950 to-blue-800'
    : 'from-emerald-950 via-green-900 to-emerald-700'

  const accentColor = isWinter ? 'text-sky-300' : 'text-emerald-300'
  const ringColor = isWinter ? 'focus:ring-sky-400' : 'focus:ring-emerald-400'
  const buttonBg = isWinter
    ? 'bg-sky-500 hover:bg-sky-400'
    : 'bg-emerald-500 hover:bg-emerald-400'

  return (
    <div className="min-h-screen">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section
        className={`relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br ${heroBg} text-white px-4 transition-all duration-700`}
      >
        {/* Season icon */}
        <div className="mb-6 flex items-center gap-2 text-white/60 text-sm font-medium tracking-wider uppercase">
          {isWinter ? (
            <Mountain className="w-4 h-4" />
          ) : (
            <Bike className="w-4 h-4" />
          )}
          <span>{isWinter ? 'Winter season' : 'Summer season'}</span>
        </div>

        {/* Animated headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center leading-tight mb-8">
          {HEADLINE_WORDS.map((word, i) => (
            <span
              key={word}
              className={[
                'inline-block mr-3 transition-all duration-500',
                mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
                i === HEADLINE_WORDS.length - 1 ? accentColor : '',
              ].join(' ')}
              style={{ transitionDelay: `${i * 120}ms` }}
            >
              {word}
            </span>
          ))}
        </h1>

        <p className="text-white/70 text-base sm:text-lg text-center max-w-md mb-10">
          {isWinter
            ? 'Ski lessons, rental gear, and expert instructors — all in one place.'
            : 'Guided bike tours and rental gear for every trail level.'}
        </p>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="w-full max-w-md flex gap-2"
          aria-label="Resort search"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search resorts…"
              className={[
                'w-full pl-9 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40',
                'focus:outline-none focus:ring-2 focus:border-transparent backdrop-blur-sm transition-all',
                ringColor,
              ].join(' ')}
            />
          </div>
          <button
            type="submit"
            className={`px-5 py-3 rounded-xl font-semibold text-white transition-colors ${buttonBg}`}
          >
            Search
          </button>
        </form>

        {/* Scroll cue */}
        <button
          onClick={scrollToFeatured}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Scroll to featured resorts"
        >
          <span className="text-xs">Featured resorts</span>
          <ChevronDown className="w-5 h-5 animate-bounce" />
        </button>
      </section>

      {/* ── Featured resorts ─────────────────────────────────────────────── */}
      <section
        ref={featuredRef}
        className="px-4 py-14 max-w-screen-lg mx-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Featured resorts</h2>
            <p className="text-sm text-gray-500 mt-1">
              {isWinter ? 'Top ski destinations this winter' : 'Best bike spots this summer'}
            </p>
          </div>
          <button
            onClick={() => navigate('/resorts')}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View all →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : resorts.map((resort) => (
                <button
                  key={resort.id}
                  onClick={() => navigate(`/resorts/${resort.id}`)}
                  className="group text-left rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  {/* Gradient card */}
                  <div
                    className={`h-36 bg-gradient-to-br ${resortGradient(resort.id)} relative flex items-end p-4`}
                  >
                    <span className="text-2xl absolute top-3 right-3">
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
                    <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {resort.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{resort.region}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {resort.season_modes.map((m) => (
                        <span
                          key={m}
                          className={[
                            'text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                            m === 'winter'
                              ? 'bg-sky-100 text-sky-700'
                              : 'bg-emerald-100 text-emerald-700',
                          ].join(' ')}
                        >
                          {m === 'winter' ? '⛷ Ski' : '🚴 Bike'}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
              ))}
        </div>

        {!loading && resorts.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Mountain className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No resorts found for this season.</p>
          </div>
        )}
      </section>
    </div>
  )
}
