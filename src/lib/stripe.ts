import { loadStripe, type Stripe } from '@stripe/stripe-js'

// Singleton — loadStripe is cached after the first call
export const stripePromise: Promise<Stripe | null> = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string,
)

/**
 * Confirms a card payment using the clientSecret returned by the
 * create-booking edge function.
 *
 * Call this AFTER create-booking returns the clientSecret; pass the
 * PaymentMethod ID that was already collected via CardElement.
 */
export async function confirmCardPayment(
  clientSecret: string,
  paymentMethodId: string,
): Promise<{ error?: string }> {
  const stripe = await stripePromise
  if (!stripe) return { error: 'Stripe.js failed to load' }

  const { error } = await stripe.confirmCardPayment(clientSecret, {
    payment_method: paymentMethodId,
  })

  return error ? { error: error.message } : {}
}

/**
 * Creates a PaymentMethod from a mounted CardElement.
 * Returns the PaymentMethod ID to pass to the create-booking edge function.
 */
export async function createPaymentMethod(
  cardElement: Parameters<Stripe['createPaymentMethod']>[0]['card'],
  billingName?: string,
): Promise<{ paymentMethodId: string } | { error: string }> {
  const stripe = await stripePromise
  if (!stripe) return { error: 'Stripe.js failed to load' }

  const { paymentMethod, error } = await stripe.createPaymentMethod({
    type: 'card',
    card: cardElement as any,
    billing_details: billingName ? { name: billingName } : undefined,
  })

  if (error || !paymentMethod) return { error: error?.message ?? 'Failed to create payment method' }
  return { paymentMethodId: paymentMethod.id }
}
