interface SkeletonProps {
  /** Tailwind width class, e.g. "w-32" or "w-full" */
  width?: string
  /** Tailwind height class, e.g. "h-4" */
  height?: string
  /** Fully rounded (for avatars) */
  circle?: boolean
  className?: string
}

/** Single-line skeleton shimmer */
export default function Skeleton({
  width = 'w-full',
  height = 'h-4',
  circle = false,
  className = '',
}: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={[
        'animate-pulse bg-gray-200',
        width,
        height,
        circle ? 'rounded-full' : 'rounded-md',
        className,
      ].join(' ')}
    />
  )
}

// ── Preset composites ────────────────────────────────────────────────────────

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3">
      <Skeleton width="w-2/3" height="h-5" />
      <Skeleton height="h-3" />
      <Skeleton width="w-4/5" height="h-3" />
      <div className="flex gap-2 pt-1">
        <Skeleton width="w-16" height="h-6" />
        <Skeleton width="w-20" height="h-6" />
      </div>
    </div>
  )
}

export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton width="w-10" height="h-10" circle />
      <div className="flex-1 space-y-1.5">
        <Skeleton width="w-1/3" height="h-4" />
        <Skeleton width="w-1/2" height="h-3" />
      </div>
    </div>
  )
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? 'w-3/4' : 'w-full'}
          height="h-3"
        />
      ))}
    </div>
  )
}
