import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  User,
  Mail,
  Phone,
  Globe,
  LogOut,
  ChevronRight,
  Star,
  Sun,
  Snowflake,
  Check,
  Loader2,
  AlertCircle,
  UserCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { useAuth } from '../../hooks/useAuth'
import { useSeasonStore } from '../../store/seasonStore'
import { updateProfile } from '../../lib/supabase/profiles'
import { useAuthStore } from '../../store/authStore'
import type { SeasonMode } from '../../types'

// ── Language config ───────────────────────────────────────────────────────────

const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: 'en', label: 'English',   flag: '🇬🇧' },
  { code: 'sk', label: 'Slovenčina', flag: '🇸🇰' },
]

// ── Avatar ────────────────────────────────────────────────────────────────────

function Avatar({ firstName, lastName, avatarUrl }: { firstName: string; lastName: string; avatarUrl?: string | null }) {
  const initials = [firstName[0], lastName[0]].filter(Boolean).join('').toUpperCase()

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${firstName} ${lastName}`}
        className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md"
      />
    )
  }

  return (
    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center border-4 border-white shadow-md">
      <span className="text-2xl font-bold text-white">{initials}</span>
    </div>
  )
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-2">{title}</h2>
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {children}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Profile() {
  const { user, signOut } = useAuth()
  const setUser = useAuthStore((s) => s.setUser)
  const { season, setSeason } = useSeasonStore()
  const navigate = useNavigate()

  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName]   = useState(user?.last_name ?? '')
  const [phone, setPhone]         = useState(user?.phone ?? '')
  const [language, setLanguage]   = useState(user?.preferred_language ?? 'en')

  const [saving, setSaving]         = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const isDirty =
    firstName !== (user?.first_name ?? '') ||
    lastName  !== (user?.last_name ?? '')  ||
    phone     !== (user?.phone ?? '')      ||
    language  !== (user?.preferred_language ?? 'en')

  async function handleSave() {
    if (!user) return
    if (!firstName.trim() || !lastName.trim()) {
      setProfileError('First and last name are required.')
      return
    }
    setProfileError(null)
    setSaving(true)
    try {
      const updated = await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name:  lastName.trim(),
        phone:      phone.trim() || null,
        preferred_language: language,
      })
      setUser(updated)
      toast.success('Profile saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await signOut()
      navigate('/')
    } catch {
      toast.error('Sign-out failed')
      setSigningOut(false)
    }
  }

  if (!user) return (
    <div className="min-h-screen bg-gray-50 pt-16 flex flex-col items-center justify-center gap-3 text-gray-400 px-6 text-center">
      <UserCircle className="w-12 h-12" />
      <p className="text-sm font-medium text-gray-600">Could not load profile</p>
      <p className="text-xs">Try refreshing the page</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 pt-16 pb-28">
      {/* Header / avatar */}
      <div className="bg-white border-b border-gray-100 px-4 pt-8 pb-6 flex flex-col items-center gap-3">
        <Avatar
          firstName={user.first_name}
          lastName={user.last_name}
          avatarUrl={user.avatar_url}
        />
        <div className="text-center">
          <p className="text-xl font-bold text-gray-900">
            {user.first_name} {user.last_name}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">{user.email}</p>
          <span className="inline-block mt-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 capitalize">
            {user.role}
          </span>
        </div>
      </div>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto">

        {/* Edit profile */}
        <Section title="Personal info">
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">First name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Jan"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Last name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Novák"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-400 cursor-not-allowed"
                />
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Email cannot be changed here</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone <span className="font-normal text-gray-400">(optional)</span></label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+421 900 000 000"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {profileError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {profileError}
              </div>
            )}

            {isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="w-4 h-4" /> Save changes</>
                )}
              </button>
            )}
          </div>
        </Section>

        {/* Language */}
        <Section title="Language">
          <div className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">App language</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
                  className={[
                    'flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all',
                    language === lang.code
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-100 text-gray-600 hover:border-gray-200',
                  ].join(' ')}
                >
                  <span className="text-lg">{lang.flag}</span>
                  {lang.label}
                  {language === lang.code && (
                    <Check className="w-3.5 h-3.5 ml-auto text-blue-600" />
                  )}
                </button>
              ))}
            </div>
            {language !== (user.preferred_language ?? 'en') && !isDirty && (
              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full mt-3 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Save language preference
              </button>
            )}
          </div>
        </Section>

        {/* Season preference */}
        <Section title="Season preference">
          <div className="p-4">
            <p className="text-xs text-gray-500 mb-3">
              Controls which services are shown throughout the app
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['winter', 'summer'] as SeasonMode[]).map((s) => {
                const active = season === s
                return (
                  <button
                    key={s}
                    onClick={() => setSeason(s)}
                    className={[
                      'flex flex-col items-center gap-1.5 py-4 rounded-xl border-2 transition-all',
                      active && s === 'winter' ? 'border-sky-500 bg-sky-50' :
                      active && s === 'summer' ? 'border-amber-500 bg-amber-50' :
                      'border-gray-100 hover:border-gray-200',
                    ].join(' ')}
                  >
                    {s === 'winter' ? (
                      <Snowflake className={`w-6 h-6 ${active ? 'text-sky-500' : 'text-gray-400'}`} />
                    ) : (
                      <Sun className={`w-6 h-6 ${active ? 'text-amber-500' : 'text-gray-400'}`} />
                    )}
                    <span className={`text-sm font-semibold capitalize ${active && s === 'winter' ? 'text-sky-700' : active && s === 'summer' ? 'text-amber-700' : 'text-gray-600'}`}>
                      {s}
                    </span>
                    {active && (
                      <span className="text-[10px] text-gray-400">Active</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </Section>

        {/* Activity links */}
        <Section title="Activity">
          <Link
            to="/trips"
            className="flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <Star className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">My Trips</p>
                <p className="text-xs text-gray-400">View all bookings</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>

          <div className="border-t border-gray-50" />

          <button
            className="w-full flex items-center justify-between px-4 py-4 hover:bg-gray-50 transition-colors text-left"
            onClick={() => toast('Reviews feature coming soon', { icon: '⭐' })}
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <Star className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">My Reviews</p>
                <p className="text-xs text-gray-400">Rate your past experiences</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </button>
        </Section>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 transition-colors disabled:opacity-60"
        >
          {signingOut ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogOut className="w-4 h-4" />
          )}
          {signingOut ? 'Signing out…' : 'Sign out'}
        </button>

        <p className="text-center text-xs text-gray-300">Member since {new Date(user.created_at).getFullYear()}</p>
      </div>
    </div>
  )
}
