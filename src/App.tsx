import type { ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

import { useAuth } from './hooks/useAuth'
import type { UserRole } from './types'

// Layout
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import OperatorRegister from './pages/auth/OperatorRegister'

// ── Placeholder for pages not yet built ─────────────────────────────────────
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-2">
      <span className="text-4xl">🚧</span>
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs">Coming soon</p>
    </div>
  )
}

// ── Loading screen (shown while auth initialises) ────────────────────────────
function AuthLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )
}

// ── Protected route guard ────────────────────────────────────────────────────
interface ProtectedRouteProps {
  children: ReactNode
  /** If set, only this role (plus admin) can access the route */
  requiredRole?: UserRole
  redirectTo?: string
}

function ProtectedRoute({
  children,
  requiredRole,
  redirectTo = '/login',
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) return <AuthLoader />
  if (!isAuthenticated) return <Navigate to={redirectTo} replace />

  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

// ── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <Header />

      <Routes>
        {/* ── Public ──────────────────────────────────────────── */}
        <Route path="/" element={<Placeholder name="Home" />} />
        <Route path="/search" element={<Placeholder name="Resort Search" />} />
        <Route path="/resorts/:slug" element={<Placeholder name="Resort Detail" />} />
        <Route
          path="/resorts/:slug/operators/:operatorId"
          element={<Placeholder name="Operator Offer Page" />}
        />

        {/* ── Auth ────────────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/register/operator" element={<OperatorRegister />} />

        {/* ── Any authenticated user ───────────────────────────── */}
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Placeholder name="My Profile" />
            </ProtectedRoute>
          }
        />

        {/* ── Customer ────────────────────────────────────────── */}
        <Route
          path="/my-trips"
          element={
            <ProtectedRoute requiredRole="customer">
              <Placeholder name="My Trips" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-trips/:id"
          element={
            <ProtectedRoute requiredRole="customer">
              <Placeholder name="Trip Detail" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/book/:resortSlug/:operatorId/:serviceId"
          element={
            <ProtectedRoute requiredRole="customer">
              <Placeholder name="Booking Flow" />
            </ProtectedRoute>
          }
        />

        {/* ── Operator ────────────────────────────────────────── */}
        <Route
          path="/operator"
          element={
            <ProtectedRoute requiredRole="operator">
              <Placeholder name="Operator Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/services"
          element={
            <ProtectedRoute requiredRole="operator">
              <Placeholder name="Manage Services" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/availability"
          element={
            <ProtectedRoute requiredRole="operator">
              <Placeholder name="Manage Availability" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/bookings"
          element={
            <ProtectedRoute requiredRole="operator">
              <Placeholder name="Operator Bookings" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/check-in"
          element={
            <ProtectedRoute requiredRole="operator">
              <Placeholder name="QR Check-In" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/operator/inventory"
          element={
            <ProtectedRoute requiredRole="operator">
              <Placeholder name="Equipment Inventory" />
            </ProtectedRoute>
          }
        />

        {/* ── Admin ───────────────────────────────────────────── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute requiredRole="admin">
              <Placeholder name="Admin Dashboard" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/operators"
          element={
            <ProtectedRoute requiredRole="admin">
              <Placeholder name="Manage Operators" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/resorts"
          element={
            <ProtectedRoute requiredRole="admin">
              <Placeholder name="Manage Resorts" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/bookings"
          element={
            <ProtectedRoute requiredRole="admin">
              <Placeholder name="All Bookings" />
            </ProtectedRoute>
          }
        />

        {/* ── 404 ─────────────────────────────────────────────── */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <BottomNav />
    </>
  )
}
