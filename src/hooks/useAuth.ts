import { useAuthStore } from '../store/authStore'

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const session = useAuthStore((s) => s.session)
  const isLoading = useAuthStore((s) => s.isLoading)
  const signIn = useAuthStore((s) => s.signIn)
  const signInWithMagicLink = useAuthStore((s) => s.signInWithMagicLink)
  const signUp = useAuthStore((s) => s.signUp)
  const signOut = useAuthStore((s) => s.signOut)

  return {
    user,
    session,
    isLoading,
    role: user?.role ?? null,
    isAuthenticated: session !== null,
    isCustomer: user?.role === 'customer',
    isOperator: user?.role === 'operator',
    isAdmin: user?.role === 'admin',
    signIn,
    signInWithMagicLink,
    signUp,
    signOut,
  }
}
