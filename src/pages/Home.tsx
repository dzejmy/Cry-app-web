import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, Mountain, Bike, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getResorts } from '../lib/supabase/resorts'
import { useSeasonStore } from '../store/seasonStore'
import type { Resort } from '../types'
import { SkeletonCard } from '../components/ui/Skeleton'
import EmptyState from '../components/ui/EmptyState'

const COUNTRY_FLAG: Record<string, string> = {
  SK: '🇸🇰', AT: '🇦🇹', FR: '🇫🇷', CH: '🇨🇭',
  IT: '🇮🇹', DE: '🇩🇪', SI: '🇸🇮', CZ: '🇨🇿',
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

// Parallax hook for hero background
function useParallax(factor = 0.4) {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    const onScroll = () => setOffset(window.scrollY * factor)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [factor])
  return offset
}

export default function Home() {
  const navigate    = useNavigate()
  const { t }       = useTranslation()
  const season      = useSeasonStore((s) => s.season)
  const parallax    = useParallax(0.35)

  const [query,   setQuery]   = useState('')
  const [resorts, setResorts] = useState<Resort[]>([])
  const [loading, setLoading] = useState(true)

  const featuredRef = useRef<HTMLDivElement>(null)
  const isWinter    = season === 'winter'

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

  const heroBg    = isWinter ? 'from-slate-900 via-blue-950 to-blue-800' : 'from-emerald-950 via-green-900 to-emerald-700'
  const ringColor = isWinter ? 'focus:ring-sky-400' : 'focus:ring-emerald-400'
  const buttonBg  = isWinter ? 'bg-sky-500 hover:bg-sky-400' : 'bg-emerald-500 hover:bg-emerald-400'
  const accentColor = isWinter ? 'text-sky-300' : 'text-emerald-300'

  return (
    <div className="min-h-screen">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className={`relative min-h-screen flex flex-col items-center justify-center bg-gradient-to-br ${heroBg} text-white px-4 overflow-hidden transition-colors duration-700`}>

        {/* Parallax background layer */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translateY(${parallax}px)` }}
        >
          <div className={`absolute inset-0 bg-gradient-to-b ${isWinter ? 'from-white/5 to-transparent' : 'from-emerald-300/10 to-transparent'}`} />
        </div>

        {/* Season badge */}
        <AnimatePresence mode="wait">
          <motion.div
            key={season}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{   opacity: 0, y: 8 }}
            transition={{ duration: 0.3 }}
            className="mb-6 flex items-center gap-2 text-white/60 text-sm font-medium tracking-wider uppercase"
          >
            {isWinter ? <Mountain className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
            <span>{isWinter ? t('season.winterSeason') : t('season.summerSeason')}</span>
          </motion.div>
        </AnimatePresence>

        {/* Headline — staggered word reveal */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-center leading-tight mb-8 relative z-10">
          {t('home.headline').split(' ').map((word, i, arr) => (
            <motion.span
              key={word + i}
              className={[
                'inline-block mr-3',
                i === arr.length - 1 ? accentColor : '',
              ].join(' ')}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1, duration: 0.4, ease: 'easeOut' }}
            >
              {word}
            </motion.span>
          ))}
        </h1>

        {/* Subtitle */}
        <AnimatePresence mode="wait">
          <motion.p
            key={season}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{   opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="text-white/70 text-base sm:text-lg text-center max-w-md mb-10 relative z-10"
          >
            {isWinter ? t('home.subtitleWinter') : t('home.subtitleSummer')}
          </motion.p>
        </AnimatePresence>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="w-full max-w-md flex gap-2 relative z-10"
          aria-label="Resort search"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('home.searchPlaceholder')}
              className={[
                'w-full pl-9 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder:text-white/40',
                'focus:outline-none focus:ring-2 focus:border-transparent backdrop-blur-sm transition-all',
                ringColor,
              ].join(' ')}
            />
          </div>
          <button type="submit" className={`px-5 py-3 rounded-xl font-semibold text-white transition-colors ${buttonBg}`}>
            {t('home.search')}
          </button>
        </form>

        {/* Scroll cue */}
        <motion.button
          onClick={() => featuredRef.current?.scrollIntoView({ behavior: 'smooth' })}
          animate={{ y: [0, 6, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/40 hover:text-white/70 transition-colors"
          aria-label="Scroll to featured resorts"
        >
          <span className="text-xs">{t('home.scrollCue')}</span>
          <ChevronDown className="w-5 h-5" />
        </motion.button>
      </section>

      {/* ── Featured resorts ───────────────────────────────────────────────── */}
      <section ref={featuredRef} className="px-4 py-14 max-w-screen-lg mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">{t('home.featuredResorts')}</h2>
            <AnimatePresence mode="wait">
              <motion.p
                key={season}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{   opacity: 0, x: 8 }}
                transition={{ duration: 0.25 }}
                className="text-sm text-gray-500 mt-1"
              >
                {isWinter ? t('home.featuredSubWinter') : t('home.featuredSubSummer')}
              </motion.p>
            </AnimatePresence>
          </div>
          <button
            onClick={() => navigate('/resorts')}
            className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            {t('home.viewAll')}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : resorts.map((resort, i) => (
                <motion.button
                  key={resort.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.07, duration: 0.35, ease: 'easeOut' }}
                  onClick={() => navigate(`/resorts/${resort.id}`)}
                  className="group text-left rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                >
                  <div className={`h-36 bg-gradient-to-br ${resortGradient(resort.id)} relative flex items-end p-4`}>
                    <span className="text-2xl absolute top-3 right-3">
                      {COUNTRY_FLAG[resort.country] ?? '🏔️'}
                    </span>
                    {resort.elevation_m && (
                      <span className="text-white/80 text-xs font-medium bg-black/20 px-2 py-0.5 rounded-full">
                        {t('home.elevation', { elevation: resort.elevation_m.toLocaleString() })}
                      </span>
                    )}
                  </div>
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
                            m === 'winter' ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700',
                          ].join(' ')}
                        >
                          {m === 'winter' ? '⛷ Ski' : '🚴 Bike'}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.button>
              ))}
        </div>

        {!loading && resorts.length === 0 && (
          <EmptyState
            variant="noResorts"
            action={{ label: t('common.viewAll'), onClick: () => navigate('/resorts') }}
          />
        )}
      </section>
    </div>
  )
}
