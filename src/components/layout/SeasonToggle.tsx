import { AnimatePresence, motion } from 'framer-motion'
import { Snowflake, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSeasonStore } from '../../store/seasonStore'

export default function SeasonToggle() {
  const { t }                   = useTranslation()
  const { season, setSeason }   = useSeasonStore()
  const isWinter                = season === 'winter'

  return (
    <div
      role="group"
      aria-label="Season selector"
      className="relative flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm select-none"
    >
      {/* Sliding pill — driven by Framer Motion layout animation */}
      <motion.span
        aria-hidden
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 36 }}
        className={[
          'absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full',
          isWinter ? 'left-1 bg-sky-100' : 'left-[calc(50%+1px)] bg-amber-100',
        ].join(' ')}
      />

      {/* Winter button */}
      <button
        type="button"
        onClick={() => setSeason('winter')}
        aria-label={t('season.winter')}
        aria-pressed={isWinter}
        className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isWinter ? 'snowflake-active' : 'snowflake-inactive'}
            initial={{ scale: 0.6, opacity: 0, rotate: -30 }}
            animate={{ scale: 1,   opacity: 1, rotate: 0 }}
            exit={{   scale: 0.6, opacity: 0, rotate: 30 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center"
          >
            <Snowflake
              className={[
                'w-3.5 h-3.5',
                isWinter ? 'text-sky-600' : 'text-gray-400',
              ].join(' ')}
            />
          </motion.span>
        </AnimatePresence>
        <span
          className={[
            'text-xs font-semibold transition-colors duration-200',
            isWinter ? 'text-sky-700' : 'text-gray-400',
          ].join(' ')}
        >
          {t('season.winter')}
        </span>
      </button>

      {/* Summer button */}
      <button
        type="button"
        onClick={() => setSeason('summer')}
        aria-label={t('season.summer')}
        aria-pressed={!isWinter}
        className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={isWinter ? 'sun-inactive' : 'sun-active'}
            initial={{ scale: 0.6, opacity: 0, rotate: -30 }}
            animate={{ scale: 1,   opacity: 1, rotate: 0 }}
            exit={{   scale: 0.6, opacity: 0, rotate: 30 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex items-center"
          >
            <Sun
              className={[
                'w-3.5 h-3.5',
                !isWinter ? 'text-amber-500' : 'text-gray-400',
              ].join(' ')}
            />
          </motion.span>
        </AnimatePresence>
        <span
          className={[
            'text-xs font-semibold transition-colors duration-200',
            !isWinter ? 'text-amber-600' : 'text-gray-400',
          ].join(' ')}
        >
          {t('season.summer')}
        </span>
      </button>
    </div>
  )
}
