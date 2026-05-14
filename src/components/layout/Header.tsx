import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, UserCircle } from 'lucide-react'
import SeasonToggle from './SeasonToggle'
import { useAuth } from '../../hooks/useAuth'

export default function Header() {
  const { isAuthenticated, user } = useAuth()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm'
          : 'bg-transparent',
      ].join(' ')}
    >
      <div className="max-w-screen-xl mx-auto px-4 h-16 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 font-bold text-lg text-gray-900"
        >
          <span className="text-xl">⛰️</span>
          <span className={scrolled ? 'text-gray-900' : 'text-white drop-shadow'}>PeakPass</span>
        </Link>

        {/* Season toggle — center */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <SeasonToggle />
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          {isAuthenticated ? (
            <>
              {/* Notification bell */}
              <button
                type="button"
                aria-label="Notifications"
                className={[
                  'relative p-2 rounded-full transition-colors',
                  scrolled
                    ? 'text-gray-600 hover:bg-gray-100'
                    : 'text-white hover:bg-white/20',
                ].join(' ')}
              >
                <Bell className="w-5 h-5" />
                {/* Unread dot — wire up to real data later */}
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-1 ring-white" />
              </button>

              {/* Avatar */}
              <Link
                to="/profile"
                aria-label="Go to profile"
                className={[
                  'flex items-center justify-center w-8 h-8 rounded-full font-semibold text-sm transition-colors',
                  scrolled
                    ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    : 'bg-white/20 text-white hover:bg-white/30',
                ].join(' ')}
              >
                {user?.first_name?.[0]?.toUpperCase() ?? <UserCircle className="w-5 h-5" />}
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className={[
                'text-sm font-medium px-4 py-1.5 rounded-full border transition-colors',
                scrolled
                  ? 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  : 'border-white/50 text-white hover:bg-white/10',
              ].join(' ')}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
