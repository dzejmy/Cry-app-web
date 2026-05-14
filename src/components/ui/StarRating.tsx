import { useState } from 'react'
import { Star } from 'lucide-react'

interface BaseProps {
  value: number       // 0–5
  max?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

interface DisplayProps extends BaseProps {
  interactive?: false
  onChange?: never
}

interface InteractiveProps extends BaseProps {
  interactive: true
  onChange: (rating: number) => void
}

type StarRatingProps = DisplayProps | InteractiveProps

const sizeClasses = { sm: 'w-3.5 h-3.5', md: 'w-5 h-5', lg: 'w-6 h-6' }
const gapClasses  = { sm: 'gap-0.5',     md: 'gap-1',    lg: 'gap-1.5' }

export default function StarRating({
  value,
  max = 5,
  size = 'md',
  interactive,
  onChange,
  className = '',
}: StarRatingProps) {
  const [hovered, setHovered] = useState<number | null>(null)

  const displayed = hovered ?? value

  return (
    <div
      className={[
        'inline-flex items-center',
        gapClasses[size],
        interactive ? 'cursor-pointer' : 'cursor-default',
        className,
      ].join(' ')}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={`Rating: ${value} out of ${max}`}
    >
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1
        const filled = starValue <= displayed

        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(starValue)}
            onMouseEnter={() => interactive && setHovered(starValue)}
            onMouseLeave={() => interactive && setHovered(null)}
            aria-label={`${starValue} star${starValue > 1 ? 's' : ''}`}
            className={[
              'transition-colors focus:outline-none',
              interactive ? 'focus-visible:ring-2 focus-visible:ring-amber-400 rounded-sm' : 'pointer-events-none',
            ].join(' ')}
          >
            <Star
              className={[
                sizeClasses[size],
                'transition-colors',
                filled ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-gray-300',
              ].join(' ')}
            />
          </button>
        )
      })}
    </div>
  )
}
