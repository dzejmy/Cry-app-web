interface Level {
  value: number
  label: string
  description: string
  color: string
  barColor: string
}

const LEVELS: Level[] = [
  {
    value: 1,
    label: 'Beginner',
    description: 'First time on the slopes or trails',
    color: 'text-green-700',
    barColor: 'bg-green-500',
  },
  {
    value: 2,
    label: 'Novice',
    description: 'Can handle easy runs independently',
    color: 'text-lime-700',
    barColor: 'bg-lime-500',
  },
  {
    value: 3,
    label: 'Intermediate',
    description: 'Comfortable on most blue/red runs',
    color: 'text-yellow-700',
    barColor: 'bg-yellow-500',
  },
  {
    value: 4,
    label: 'Advanced',
    description: 'Confident on black runs and off-piste',
    color: 'text-orange-700',
    barColor: 'bg-orange-500',
  },
  {
    value: 5,
    label: 'Expert',
    description: 'Highly technical, competitive level',
    color: 'text-red-700',
    barColor: 'bg-red-500',
  },
]

interface SkillLevelPickerProps {
  value: number | null
  onChange: (level: number) => void
  className?: string
}

export default function SkillLevelPicker({
  value,
  onChange,
  className = '',
}: SkillLevelPickerProps) {
  const selected = LEVELS.find((l) => l.value === value) ?? null

  return (
    <div className={['space-y-2', className].join(' ')}>
      {/* Bar selector */}
      <div className="flex items-end gap-1.5" role="radiogroup" aria-label="Skill level">
        {LEVELS.map((level) => {
          const isSelected = value === level.value
          const barHeight = level.value * 8 + 16 // 24px → 56px progression

          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={level.label}
              onClick={() => onChange(level.value)}
              className={[
                'flex-1 rounded-t-md transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500',
                isSelected ? level.barColor : 'bg-gray-200 hover:bg-gray-300',
              ].join(' ')}
              style={{ height: `${barHeight}px` }}
            />
          )
        })}
      </div>

      {/* Labels row */}
      <div className="flex gap-1.5">
        {LEVELS.map((level) => (
          <span
            key={level.value}
            className={[
              'flex-1 text-center text-[10px] font-medium truncate transition-colors',
              value === level.value ? level.color : 'text-gray-400',
            ].join(' ')}
          >
            {level.label}
          </span>
        ))}
      </div>

      {/* Selected description */}
      {selected && (
        <p className={['text-xs text-center mt-1', selected.color].join(' ')}>
          {selected.label} — {selected.description}
        </p>
      )}
    </div>
  )
}
