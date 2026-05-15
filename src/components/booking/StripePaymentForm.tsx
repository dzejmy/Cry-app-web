import { useState } from 'react'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { Loader2, Lock, AlertCircle } from 'lucide-react'

import { stripePromise, confirmCardPayment } from '../../lib/stripe'

// ── Card element style ────────────────────────────────────────────────────────

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize:        '15px',
      color:           '#111827',
      fontFamily:      'system-ui, -apple-system, sans-serif',
      '::placeholder': { color: '#9ca3af' },
      iconColor:       '#7c3aed',
    },
    invalid: {
      color:     '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: true,
}

// ── Inner form (needs Stripe context from Elements) ───────────────────────────

interface CheckoutFormProps {
  amount: number
  currency?: string
  billingName?: string
  onSubmit: (paymentMethodId: string) => Promise<{ clientSecret: string }>
  onSuccess: (bookingId?: string) => void
  onError?: (message: string) => void
  submitLabel?: string
}

function CheckoutForm({
  amount,
  currency = 'EUR',
  billingName,
  onSubmit,
  onSuccess,
  onError,
  submitLabel = 'Pay & confirm booking',
}: CheckoutFormProps) {
  const stripe   = useStripe()
  const elements = useElements()

  const [loading,  setLoading]  = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [ready,    setReady]    = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!stripe || !elements) return

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) return

    setLoading(true)
    setErrorMsg(null)

    try {
      // 1. Create PaymentMethod from card details
      const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: billingName ? { name: billingName } : undefined,
      })

      if (pmError || !paymentMethod) {
        throw new Error(pmError?.message ?? 'Could not process card details')
      }

      // 2. Call create-booking with PaymentMethod ID → get clientSecret
      const { clientSecret } = await onSubmit(paymentMethod.id)

      // 3. Confirm the payment with Stripe
      const { error: confirmError } = await confirmCardPayment(clientSecret, paymentMethod.id)
      if (confirmError) throw new Error(confirmError)

      onSuccess()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Payment failed'
      setErrorMsg(message)
      onError?.(message)
    } finally {
      setLoading(false)
    }
  }

  const displayAmount = new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency,
  }).format(amount)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Card input */}
      <div>
        <label className="text-xs font-semibold text-gray-500 block mb-2">
          Card details
        </label>
        <div
          className={[
            'border rounded-xl px-4 py-3.5 bg-white transition-all',
            ready ? 'border-violet-300 ring-1 ring-violet-200' : 'border-gray-200',
          ].join(' ')}
        >
          <CardElement
            options={CARD_ELEMENT_OPTIONS}
            onReady={() => setReady(true)}
            onChange={(e) => {
              if (e.error) setErrorMsg(e.error.message)
              else setErrorMsg(null)
            }}
          />
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!stripe || !ready || loading}
        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors text-sm"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            {submitLabel} · {displayAmount}
          </>
        )}
      </button>

      {/* Trust badge */}
      <p className="text-center text-[11px] text-gray-400 flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        Secured by Stripe · Your card details are never stored on our servers
      </p>
    </form>
  )
}

// ── Public component (wraps in Elements provider) ─────────────────────────────

export type StripePaymentFormProps = CheckoutFormProps

/**
 * Drop-in Stripe payment form.
 *
 * Usage:
 * ```tsx
 * <StripePaymentForm
 *   amount={totalPrice}
 *   billingName={`${firstName} ${lastName}`}
 *   onSubmit={async (paymentMethodId) => {
 *     const res = await callCreateBookingEdgeFunction({ ...bookingPayload, stripeToken: paymentMethodId })
 *     return { clientSecret: res.clientSecret }
 *   }}
 *   onSuccess={() => navigate(`/trips/${bookingId}`)}
 * />
 * ```
 */
export default function StripePaymentForm(props: StripePaymentFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm {...props} />
    </Elements>
  )
}
