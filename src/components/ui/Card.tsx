import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Remove default padding */
  noPadding?: boolean
  /** Add a hover lift effect — useful for clickable cards */
  hoverable?: boolean
}

export default function Card({
  children,
  noPadding = false,
  hoverable = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      {...props}
      className={[
        'bg-white rounded-2xl border border-gray-200 shadow-sm',
        noPadding ? '' : 'p-5',
        hoverable
          ? 'transition-shadow hover:shadow-md cursor-pointer'
          : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </div>
  )
}
