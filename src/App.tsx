import type { ReactNode } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

import { useAuth } from './hooks/useAuth'
import type { UserRole } from './types'

// Layout
import Header from './components/layout/Header'
import BottomNav from './components/layout/BottomNav'
import ErrorBoundary from './components/layout/ErrorBoundary'
import OfflineBanner from './components/layout/OfflineBanner'

// Auth pages
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'
import OperatorRegister from './pages/auth/OperatorRegister'

// Public pages
import Home from './pages/Home'
import ResortList from './pages/ResortList'
import ResortDetail from './pages/ResortDetail'
import OperatorOfferPage from './pages/OperatorOfferPage'
import NotFound from './pages/NotFound'

// Booking pages
import SkiRentalBooking from './pages/booking/SkiRentalBooking'
import SkiSchoolBooking from './pages/booking/SkiSchoolBooking'
import BikeRentalBooking from './pages/booking/BikeRentalBooking'
import BikeGuidingBooking from './pages/booking/BikeGuidingBooking'

// Customer pages
import MyTrips from './pages/customer/MyTrips'
import TripDetail from './pages/customer/TripDetail'
import Profile from './pages/customer/Profile'

// Operator pages
import OperatorDashboard from './pages/operator/Dashboard'
import OperatorBookings from './pages/operator/BookingsList'
import OperatorScan from './pages/operator/QRScannerPage'
import OperatorAvailability from './pages/operator/AvailabilityManager'
import OperatorEquipment from './pages/operator/EquipmentTracker'
import OperatorProfile from './pages/operator/OperatorProfile'

// ── Placeholder ───────────────────────────────────────────────────────────────
function Placeholder({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 gap-2">
      <span className="text-4xl">🚧</span>
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs">Coming soon</p>
    </div>
  )
}

// ── Auth loader ───────────────────────────────────────────────────────────────
function AuthLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
    </div>
  )
}

// ── Protected route ───────────────────────────────────────────────────────────
interface ProtectedRouteProps {
  children: ReactNode
  requiredRole?: UserRole
  redirectTo?: string
}

function ProtectedRoute({ children, requiredRole, redirectTo = '/login' }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  if (isLoading) return <AuthLoader />
  if (!isAuthenticated) return <Navigate to={redirectTo} replace />
  if (requiredRole && user?.role !== requiredRole && user?.role !== 'admin')
    return <Navigate to="/" replace />
  return <>{children}</>
}

// ── Page transition wrapper ───────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeIn' } },
}

// ── Animated route container ──────────────────────────────────────────────────
function AnimatedRoutes() {
  const location = useLocation()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Routes location={location}>
          {/* ── Public ──────────────────────────────────────────────── */}
          <Route path="/" element={<Home />} />
          <Route path="/resorts" element={<ResortList />} />
          <Route path="/resorts/:id" element={<ResortDetail />} />
          <Route
            path="/resorts/:resortId/operators/:operatorId"
            element={<OperatorOfferPage />}
          />

          {/* ── Auth ──────────────────────────────────────────────── */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/register/operator" element={<OperatorRegister />} />

          {/* ── Any authenticated user ─────────────────────────────── */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />

          {/* ── Customer ──────────────────────────────────────────── */}
          <Route
            path="/trips"
            element={
              <ProtectedRoute requiredRole="customer">
                <MyTrips />
              </ProtectedRoute>
            }
          />
          <Route
            path="/trips/:bookingId"
            element={
              <ProtectedRoute requiredRole="customer">
                <TripDetail />
              </ProtectedRoute>
            }
          />
          <Route path="/my-trips" element={<Navigate to="/trips" replace />} />
          <Route path="/my-trips/:id" element={<Navigate to="/trips" replace />} />
          <Route
            path="/book/ski-rental/:operatorId/:resortId"
            element={
              <ProtectedRoute requiredRole="customer">
                <SkiRentalBooking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/ski-school/:operatorId/:resortId"
            element={
              <ProtectedRoute requiredRole="customer">
                <SkiSchoolBooking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/bike-rental/:operatorId/:resortId"
            element={
              <ProtectedRoute requiredRole="customer">
                <BikeRentalBooking />
              </ProtectedRoute>
            }
          />
          <Route
            path="/book/bike-guiding/:operatorId/:resortId"
            element={
              <ProtectedRoute requiredRole="customer">
                <BikeGuidingBooking />
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

          {/* ── Operator ──────────────────────────────────────────── */}
          <Route
            path="/operator"
            element={
              <ProtectedRoute requiredRole="operator">
                <OperatorDashboard />
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
                <OperatorAvailability />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/bookings"
            element={
              <ProtectedRoute requiredRole="operator">
                <OperatorBookings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/scan"
            element={
              <ProtectedRoute requiredRole="operator">
                <OperatorScan />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/equipment"
            element={
              <ProtectedRoute requiredRole="operator">
                <OperatorEquipment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/operator/profile"
            element={
              <ProtectedRoute requiredRole="operator">
                <OperatorProfile />
              </ProtectedRoute>
            }
          />
          <Route path="/operator/check-in" element={<Navigate to="/operator/scan" replace />} />
          <Route path="/operator/inventory" element={<Navigate to="/operator/equipment" replace />} />

          {/* ── Admin ─────────────────────────────────────────────── */}
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

          {/* ── 404 ───────────────────────────────────────────────── */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <Header />
      <OfflineBanner />
      <AnimatedRoutes />
      <BottomNav />
    </ErrorBoundary>
  )
}
