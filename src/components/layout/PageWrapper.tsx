import type { ReactNode } from 'react'

interface PageWrapperProps {
  children: ReactNode
  /** Remove default horizontal padding (e.g. full-bleed hero sections) */
  noPadding?: boolean
  /** Override max-width constraint */
  wide?: boolean
  className?: string
}

/**
 * Standard page container.
 * - pt-16: clears the fixed 64px header
 * - pb-24 on mobile: clears the 64px bottom nav + extra breathing room
 * - pb-8 on desktop: no bottom nav, just breathing room
 */
export default function PageWrapper({
  children,
  noPadding = false,
  wide = false,
  className = '',
}: PageWrapperProps) {
  return (
    <main
      className={[
        'min-h-screen pt-16 pb-24 lg:pb-8',
        wide ? 'max-w-screen-2xl' : 'max-w-screen-lg',
        'mx-auto',
        noPadding ? '' : 'px-4',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </main>
  )
}
