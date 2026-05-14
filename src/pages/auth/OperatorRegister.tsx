import { useState } from 'react'
import { Link } from 'react-router-dom'
import { User, Mail, Lock, Building2, Phone, FileText, CheckCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase/client'

interface FormState {
  // Personal account
  firstName: string
  lastName: string
  accountEmail: string
  password: string
  confirmPassword: string
  // Company
  companyName: string
  companyDescription: string
  companyPhone: string
  companyEmail: string
}

const empty: FormState = {
  firstName: '',
  lastName: '',
  accountEmail: '',
  password: '',
  confirmPassword: '',
  companyName: '',
  companyDescription: '',
  companyPhone: '',
  companyEmail: '',
}

export default function OperatorRegister() {
  const { signUp } = useAuth()

  const [form, setForm] = useState<FormState>(empty)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (form.companyDescription.trim().length < 20) {
      setError('Please write at least a short company description (20 characters)')
      return
    }

    setIsLoading(true)
    try {
      // 1. Create auth user + profile (role = operator, verified = false)
      await signUp(form.accountEmail, form.password, {
        first_name: form.firstName,
        last_name: form.lastName,
        role: 'operator',
      })

      // 2. Retrieve the newly created session to get the user ID
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session not available after sign-up')

      // 3. Create the operator record — verified = false until admin approves
      const { error: opError } = await supabase.from('operators').insert({
        profile_id: session.user.id,
        name: form.companyName,
        description: form.companyDescription,
        phone: form.companyPhone || null,
        email: form.companyEmail || null,
        verified: false,
        active: false,
      })

      if (opError) throw new Error(opError.message)

      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Pending approval screen ──────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">Application submitted!</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Thank you, <strong className="text-gray-700">{form.companyName}</strong>. Our team
              will review your application and get back to you at{' '}
              <strong className="text-gray-700">{form.accountEmail}</strong> within 1–2 business
              days.
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Your account is created but access to the operator dashboard is restricted until
              verification is complete.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Back to home
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Registration form ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">PeakPass</h1>
          <p className="text-gray-500 mt-1 text-sm">Apply for an operator account</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* ── Personal account ── */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                Your account
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      First name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="firstName"
                        type="text"
                        autoComplete="given-name"
                        required
                        value={form.firstName}
                        onChange={set('firstName')}
                        placeholder="Jan"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Last name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      autoComplete="family-name"
                      required
                      value={form.lastName}
                      onChange={set('lastName')}
                      placeholder="Novák"
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="accountEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="accountEmail"
                      type="email"
                      autoComplete="email"
                      required
                      value={form.accountEmail}
                      onChange={set('accountEmail')}
                      placeholder="you@company.com"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={form.password}
                        onChange={set('password')}
                        placeholder="Min. 8 chars"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Confirm
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="confirmPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        value={form.confirmPassword}
                        onChange={set('confirmPassword')}
                        placeholder="Repeat"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100" />

            {/* ── Company info ── */}
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
                Company information
              </h2>
              <div className="space-y-4">
                <div>
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Company name
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="companyName"
                      type="text"
                      required
                      value={form.companyName}
                      onChange={set('companyName')}
                      placeholder="Alpine Adventures s.r.o."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="companyDescription" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Description
                    <span className="text-gray-400 font-normal ml-1">(what services do you offer?)</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                    <textarea
                      id="companyDescription"
                      required
                      rows={3}
                      value={form.companyDescription}
                      onChange={set('companyDescription')}
                      placeholder="We offer certified ski instruction and equipment rental at Jasná..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="companyPhone" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Phone
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="companyPhone"
                        type="tel"
                        value={form.companyPhone}
                        onChange={set('companyPhone')}
                        placeholder="+421 911 …"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="companyEmail" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Business email
                      <span className="text-gray-400 font-normal ml-1">(optional)</span>
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        id="companyEmail"
                        type="email"
                        value={form.companyEmail}
                        onChange={set('companyEmail')}
                        placeholder="info@company.com"
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Notice */}
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              By submitting, you agree to our terms of service. Your operator account will be
              reviewed before activation.
            </p>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Submit application'
              )}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
