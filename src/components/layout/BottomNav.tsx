import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mountain, Search, Ticket, User, LayoutDashboard, ClipboardList, ScanLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSeasonStore } from '../../store/seasonStore'
import { useAuth } from '../../hooks/useAuth'

interface Tab {
  label: string
  to: string
  icon: React.ElementType
  match: (pathname: string) => boolean
}

function useTabs(): Tab[] {
  const { t } = useTranslation()

  const CUSTOMER_TABS: Tab[] = [
    {
      label: t('nav.home'),
      to: '/',
      icon: Mountain,
      match: (p) => p === '/',
    },
    {
      label: t('nav.search'),
      to: '/resorts',
      icon: Search,
      match: (p) => p.startsWith('/search') || p.startsWith('/resorts'),
    },
    {
      label: t('nav.myTrips'),
      to: '/trips',
      icon: Ticket,
      match: (p) => p.startsWith('/trips') || p.startsWith('/my-trips') || p.startsWith('/book'),
    },
    {
      label: t('nav.profile'),
      to: '/profile',
      icon: User,
      match: (p) => p === '/profile',
    },
  ]

  const OPERATOR_TABS: Tab[] = [
    {
      label: t('nav.dashboard'),
      to: '/operator',
      icon: LayoutDashboard,
      match: (p) => p === '/operator',
    },
    {
      label: t('nav.bookings'),
      to: '/operator/bookings',
      icon: ClipboardList,
      match: (p) => p.startsWith('/operator/bookings'),
    },
    {
      label: t('nav.scan'),
      to: '/operator/scan',
      icon: ScanLine,
      match: (p) => p.startsWith('/operator/scan') || p.startsWith('/operator/check-in'),
    },
    {
      label: t('nav.operatorProfile'),
      to: '/operator/profile',
      icon: User,
      match: (p) => p.startsWith('/operator/profile'),
    },
  ]

  const { role } = useAuth()
  return role === 'operator' ? OPERATOR_TABS : CUSTOMER_TABS
}

export default function BottomNav() {
  const { pathname } = useLocation()
  const { season }   = useSeasonStore()
  const { role }     = useAuth()
  const tabs         = useTabs()
  const isWinter     = season === 'winter'

  const activeColor = role === 'operator'
    ? 'text-violet-600'
    : isWinter ? 'text-sky-600' : 'text-amber-500'

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
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors overflow-hidden"
            >
              {/* Spring-animated active background pill */}
              {active && (
                <motion.span
                  layoutId="nav-active-pill"
                  className={[
                    'absolute inset-x-2 inset-y-1 rounded-xl -z-10',
                    role === 'operator' ? 'bg-violet-50' : isWinter ? 'bg-sky-50' : 'bg-amber-50',
                  ].join(' ')}
                  transition={{ type: 'spring', stiffness: 500, damping: 38 }}
                />
              )}

              <motion.span
                animate={{ scale: active ? 1.15 : 1 }}
                transition={{ type: 'spring', stiffness: 600, damping: 30 }}
              >
                <Icon className={`w-5 h-5 shrink-0 ${active ? activeColor : 'text-gray-400'}`} />
              </motion.span>

              <span className={active ? activeColor : 'text-gray-500'}>{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
