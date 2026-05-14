import type { BookingStatus, ServiceType } from '../../types'

type BadgeVariant =
  | BookingStatus   // pending | confirmed | arrived | completed | cancelled
  | ServiceType     // ski_school | ski_rental | bike_rental | bike_guiding
  | 'bundle'
  | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const styles: Record<BadgeVariant, string> = {
  // Booking statuses
  pending:   'bg-amber-50   text-amber-700   border-amber-200',
  confirmed: 'bg-blue-50    text-blue-700    border-blue-200',
  arrived:   'bg-violet-50  text-violet-700  border-violet-200',
  completed: 'bg-green-50   text-green-700   border-green-200',
  cancelled: 'bg-red-50     text-red-600     border-red-200',

  // Service types
  ski_school:  'bg-sky-50     text-sky-700     border-sky-200',
  ski_rental:  'bg-cyan-50    text-cyan-700    border-cyan-200',
  bike_rental: 'bg-orange-50  text-orange-700  border-orange-200',
  bike_guiding:'bg-lime-50    text-lime-700    border-lime-200',

  // Special
  bundle:  'bg-gradient-to-r from-blue-500 to-violet-500 text-white border-transparent',
  default: 'bg-gray-100 text-gray-700 border-gray-200',
}

const labels: Partial<Record<BadgeVariant, string>> = {
  pending:     'Pending',
  confirmed:   'Confirmed',
  arrived:     'Arrived',
  completed:   'Completed',
  cancelled:   'Cancelled',
  ski_school:  'Ski School',
  ski_rental:  'Ski Rental',
  bike_rental: 'Bike Rental',
  bike_guiding:'Bike Guiding',
  bundle:      'Bundle',
}

export default function Badge({ variant = 'default', children, className = '' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
        styles[variant] ?? styles.default,
        className,
      ].join(' ')}
    >
      {children ?? labels[variant] ?? variant}
    </span>
  )
}
