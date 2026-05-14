import type { Review } from '../../types'
import { supabase } from './client'

// ---------------------------------------------------------------------------
// Insert shape
// ---------------------------------------------------------------------------

export type ReviewInsert = Pick<
  Review,
  'booking_id' | 'customer_id' | 'operator_id' | 'service_id' | 'rating' | 'body'
> & {
  title?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertData<T>(data: T | null, error: { message: string } | null, context: string): T {
  if (error) throw new Error(`[reviews] ${context}: ${error.message}`)
  if (data === null) throw new Error(`[reviews] ${context}: no data returned`)
  return data
}

/**
 * Returns all published reviews for an operator, newest first.
 */
export async function getReviewsByOperator(operatorId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('operator_id', operatorId)
    .eq('published', true)
    .order('created_at', { ascending: false })

  return assertData(data, error, `getReviewsByOperator(${operatorId})`)
}

/**
 * Creates a review for a completed booking.
 * The review is created in an unpublished state; a backend process or admin
 * should publish it after moderation.
 */
export async function createReview(input: ReviewInsert): Promise<Review> {
  const { data, error } = await supabase
    .from('reviews')
    .insert({ ...input, published: false })
    .select()
    .single()

  return assertData(data, error, 'createReview')
}
