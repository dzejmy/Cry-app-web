import { Snowflake, Sun } from 'lucide-react'
import { useSeasonStore } from '../../store/seasonStore'

export default function SeasonToggle() {
  const { season, setSeason } = useSeasonStore()
  const isWinter = season === 'winter'

  return (
    <div className="relative flex items-center rounded-full border border-gray-200 bg-white p-1 shadow-sm select-none">
      {/* Sliding pill */}
      <span
        aria-hidden
        className={[
          'absolute top-1 bottom-1 w-[calc(50%-2px)] rounded-full transition-all duration-300 ease-in-out',
          isWinter ? 'left-1 bg-sky-100' : 'left-[calc(50%+1px)] bg-amber-100',
        ].join(' ')}
      />

      {/* Winter button */}
      <button
        type="button"
        onClick={() => setSeason('winter')}
        aria-label="Switch to winter"
        aria-pressed={isWinter}
        className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
      >
        <Snowflake
          className={[
            'w-3.5 h-3.5 transition-colors duration-200',
            isWinter ? 'text-sky-600' : 'text-gray-400',
          ].join(' ')}
        />
        <span
          className={[
            'text-xs font-semibold transition-colors duration-200',
            isWinter ? 'text-sky-700' : 'text-gray-400',
          ].join(' ')}
        >
          Winter
        </span>
      </button>

      {/* Summer button */}
      <button
        type="button"
        onClick={() => setSeason('summer')}
        aria-label="Switch to summer"
        aria-pressed={!isWinter}
        className="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
      >
        <Sun
          className={[
            'w-3.5 h-3.5 transition-colors duration-200',
            !isWinter ? 'text-amber-500' : 'text-gray-400',
          ].join(' ')}
        />
        <span
          className={[
            'text-xs font-semibold transition-colors duration-200',
            !isWinter ? 'text-amber-600' : 'text-gray-400',
          ].join(' ')}
        >
          Summer
        </span>
      </button>
    </div>
  )
}
