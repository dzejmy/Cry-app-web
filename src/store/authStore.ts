import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase/client'
import type { Profile } from '../types'

interface AuthState {
  user: Profile | null
  session: Session | null
  isLoading: boolean

  // Actions
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (
    email: string,
    password: string,
    metadata: { first_name: string; last_name: string; role?: string },
  ) => Promise<void>
  signOut: () => Promise<void>
  setUser: (user: Profile | null) => void
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data ?? null
}

async function createProfile(userId: string): Promise<Profile | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = user.user_metadata ?? {}
  const { data } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      email: user.email ?? '',
      first_name: meta.first_name ?? '',
      last_name: meta.last_name ?? '',
      role: meta.role ?? 'customer',
    })
    .select()
    .single()
  return data ?? null
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()

    if (session) {
      let user = await fetchProfile(session.user.id)
      if (!user) user = await createProfile(session.user.id)
      set({ session, user, isLoading: false })
    } else {
      set({ isLoading: false })
    }

    // Keep store in sync with Supabase auth events
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        let user = await fetchProfile(session.user.id)
        if (!user) user = await createProfile(session.user.id)
        set({ session, user })
      } else {
        set({ session: null, user: null })
      }
    })
  },

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    // onAuthStateChange will update user + session
  },

  signInWithMagicLink: async (email) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    })
    if (error) throw new Error(error.message)
  },

  signUp: async (email, password, metadata) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    })
    if (error) throw new Error(error.message)
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(error.message)
    set({ user: null, session: null })
  },

  setUser: (user) => set({ user }),
}))

// Self-initialize on module load so session is restored before any component mounts
useAuthStore.getState().initialize()
