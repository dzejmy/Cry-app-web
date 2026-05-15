import { NavLink, useLocation } from 'react-router-dom'
import { Mountain, Search, Ticket, User, LayoutDashboard, ClipboardList, ScanLine } from 'lucide-react'
import { useSeasonStore } from '../../store/seasonStore'
import { useAuth } from '../../hooks/useAuth'

interface Tab {
  label: string
  to: string
  icon: React.ElementType
  match: (pathname: string) => boolean
}

const CUSTOMER_TABS: Tab[] = [
  {
    label: 'Home',
    to: '/',
    icon: Mountain,
    match: (p) => p === '/',
  },
  {
    label: 'Search',
    to: '/resorts',
    icon: Search,
    match: (p) => p.startsWith('/search') || p.startsWith('/resorts'),
  },
  {
    label: 'My Trips',
    to: '/my-trips',
    icon: Ticket,
    match: (p) => p.startsWith('/my-trips') || p.startsWith('/book'),
  },
  {
    label: 'Profile',
    to: '/profile',
    icon: User,
    match: (p) => p.startsWith('/profile'),
  },
]

const OPERATOR_TABS: Tab[] = [
  {
    label: 'Dashboard',
    to: '/operator',
    icon: LayoutDashboard,
    match: (p) => p === '/operator',
  },
  {
    label: 'Bookings',
    to: '/operator/bookings',
    icon: ClipboardList,
    match: (p) => p.startsWith('/operator/bookings'),
  },
  {
    label: 'Check-In',
    to: '/operator/check-in',
    icon: ScanLine,
    match: (p) => p.startsWith('/operator/check-in'),
  },
  {
    label: 'Profile',
    to: '/profile',
    icon: User,
    match: (p) => p.startsWith('/profile'),
  },
]

export default function BottomNav() {
  const { pathname } = useLocation()
  const { season } = useSeasonStore()
  const { role } = useAuth()
  const isWinter = season === 'winter'

  const tabs = role === 'operator' ? OPERATOR_TABS : CUSTOMER_TABS
  const activeColor = role === 'operator'
    ? 'text-violet-600'
    : isWinter
    ? 'text-sky-600'
    : 'text-amber-500'
  const activeBg = role === 'operator'
    ? 'bg-violet-50'
    : isWinter
    ? 'bg-sky-50'
    : 'bg-amber-50'

  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white border-t border-gray-200"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {tabs.map(({ label, to, icon: Icon, match }) => {
          const active = match(pathname)
          return (
            <NavLink
              key={to}
              to={to}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                active ? `${activeColor} ${activeBg}` : 'text-gray-500 hover:text-gray-700',
              ].join(' ')}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {label}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
