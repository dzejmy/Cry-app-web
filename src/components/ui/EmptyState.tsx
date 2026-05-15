import { useTranslation } from 'react-i18next'

// ── Illustrated SVGs ──────────────────────────────────────────────────────────

function NoResortsSvg() {
  return (
    <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28" aria-hidden="true">
      {/* Sky */}
      <rect width="120" height="100" rx="12" fill="#f0f9ff" />
      {/* Mountain */}
      <polygon points="60,18 96,72 24,72" fill="#bae6fd" />
      <polygon points="60,18 76,44 44,44" fill="#e0f2fe" />
      {/* Snow cap */}
      <polygon points="60,18 69,33 51,33" fill="white" />
      {/* Ground */}
      <rect x="12" y="72" width="96" height="16" rx="6" fill="#dbeafe" />
      {/* X mark overlay */}
      <circle cx="90" cy="28" r="16" fill="#fee2e2" />
      <line x1="83" y1="21" x2="97" y2="35" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
      <line x1="97" y1="21" x2="83" y2="35" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function NoBookingsSvg() {
  return (
    <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28" aria-hidden="true">
      <rect width="120" height="100" rx="12" fill="#faf5ff" />
      {/* Ticket body */}
      <rect x="16" y="28" width="88" height="48" rx="8" fill="#ede9fe" />
      {/* Perforated left edge */}
      <circle cx="16" cy="52" r="7" fill="#faf5ff" />
      {/* Perforated right edge */}
      <circle cx="104" cy="52" r="7" fill="#faf5ff" />
      {/* Ticket stripe */}
      <line x1="40" y1="28" x2="40" y2="76" stroke="#ddd6fe" strokeWidth="1.5" strokeDasharray="4 3" />
      {/* ? mark */}
      <text x="68" y="58" textAnchor="middle" fontSize="22" fontWeight="700" fill="#7c3aed">?</text>
      {/* Stars */}
      <circle cx="30" cy="18" r="2" fill="#c4b5fd" />
      <circle cx="92" cy="15" r="1.5" fill="#a78bfa" />
      <circle cx="105" cy="30" r="1.5" fill="#c4b5fd" />
    </svg>
  )
}

function NoUpcomingSvg() {
  return (
    <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28" aria-hidden="true">
      <rect width="120" height="100" rx="12" fill="#f0fdf4" />
      {/* Calendar */}
      <rect x="18" y="24" width="84" height="60" rx="8" fill="#dcfce7" />
      {/* Header bar */}
      <rect x="18" y="24" width="84" height="20" rx="8" fill="#86efac" />
      <rect x="18" y="34" width="84" height="10" fill="#86efac" />
      {/* Rings */}
      <rect x="36" y="18" width="6" height="14" rx="3" fill="#4ade80" />
      <rect x="78" y="18" width="6" height="14" rx="3" fill="#4ade80" />
      {/* Grid lines */}
      {[0,1,2].map((row) =>
        [0,1,2,3].map((col) => (
          <rect key={`${row}-${col}`} x={26 + col * 18} y={52 + row * 10} width="10" height="6" rx="2" fill={row === 0 && col === 1 ? '#22c55e' : 'white'} opacity={0.8} />
        ))
      )}
      {/* Check on highlighted cell */}
      <path d="M33 55.5 L36 58.5 L41 53" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FullyBookedSvg() {
  return (
    <svg viewBox="0 0 120 100" fill="none" className="w-32 h-28" aria-hidden="true">
      <rect width="120" height="100" rx="12" fill="#fff7ed" />
      {/* Calendar */}
      <rect x="18" y="24" width="84" height="60" rx="8" fill="#fed7aa" />
      <rect x="18" y="24" width="84" height="20" rx="8" fill="#fb923c" />
      <rect x="18" y="34" width="84" height="10" fill="#fb923c" />
      {/* Rings */}
      <rect x="36" y="18" width="6" height="14" rx="3" fill="#ea580c" />
      <rect x="78" y="18" width="6" height="14" rx="3" fill="#ea580c" />
      {/* Grid — all filled red */}
      {[0,1,2].map((row) =>
        [0,1,2,3].map((col) => (
          <rect key={`${row}-${col}`} x={26 + col * 18} y={52 + row * 10} width="10" height="6" rx="2" fill="#fca5a5" />
        ))
      )}
      {/* X overlay */}
      <circle cx="88" cy="78" r="16" fill="#fee2e2" />
      <line x1="81" y1="71" x2="95" y2="85" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
      <line x1="95" y1="71" x2="81" y2="85" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

// ── Variant map ───────────────────────────────────────────────────────────────

type Variant = 'noResorts' | 'noBookings' | 'noUpcoming' | 'fullyBooked'

const ILLUSTRATIONS: Record<Variant, React.ComponentType> = {
  noResorts:   NoResortsSvg,
  noBookings:  NoBookingsSvg,
  noUpcoming:  NoUpcomingSvg,
  fullyBooked: FullyBookedSvg,
}

// ── Component ─────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  variant: Variant
  /** Override title */
  title?: string
  /** Override subtitle */
  subtitle?: string
  /** Optional CTA button */
  action?: { label: string; onClick: () => void }
  /** Replace title interpolation vars, e.g. { season: 'winter' } */
  vars?: Record<string, string>
  className?: string
}

export default function EmptyState({
  variant,
  title,
  subtitle,
  action,
  className = '',
}: EmptyStateProps) {
  const { t } = useTranslation()
  const Illustration = ILLUSTRATIONS[variant]

  const resolvedTitle    = title    ?? t(`emptyState.${variant}.title`)
  const resolvedSubtitle = subtitle ?? t(`emptyState.${variant}.subtitle`)

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-8 text-center ${className}`}>
      <div className="animate-scale-in mb-5">
        <Illustration />
      </div>
      <h3 className="text-base font-bold text-gray-800 mb-1.5">{resolvedTitle}</h3>
      <p className="text-sm text-gray-400 max-w-[240px] leading-relaxed">{resolvedSubtitle}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 text-sm font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-5 py-2.5 rounded-xl transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
