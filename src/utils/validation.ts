import { z } from 'zod'

// ─── Primitives & Enums ──────────────────────────────────────────────────────

export const SeasonModeSchema = z.enum(['winter', 'summer'])

export const UserRoleSchema = z.enum(['customer', 'operator', 'admin'])

export const ServiceTypeSchema = z.enum([
  'ski_school',
  'ski_rental',
  'bike_rental',
  'bike_guiding',
])

export const BookingTypeSchema = z.enum([
  'school_only',
  'rental_only',
  'guiding_only',
  'bundle',
])

export const BookingStatusSchema = z.enum([
  'pending',
  'confirmed',
  'arrived',
  'completed',
  'cancelled',
])

export const SkillLevelSchema = z.enum(['beginner', 'intermediate', 'advanced'])

export const EquipmentCategorySchema = z.enum([
  'ski',
  'snowboard',
  'boot',
  'helmet',
  'bike',
  'e-bike',
])

export const EquipmentTypeSchema = z.enum(['ski', 'snowboard', 'bike', 'e-bike'])

export const EquipmentConditionSchema = z.enum(['new', 'good', 'fair', 'retired'])

// ─── Resort ──────────────────────────────────────────────────────────────────

export const ResortSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  description: z.string().min(1),
  country: z.string().min(1),
  region: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  elevation_m: z.number().positive().nullable(),
  season_modes: z.array(SeasonModeSchema).min(1),
  amenities: z.array(z.string()),
  image_urls: z.array(z.string().url()),
  website_url: z.string().url().nullable(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ─── Profile ─────────────────────────────────────────────────────────────────

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  role: UserRoleSchema,
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().nullable(),
  avatar_url: z.string().url().nullable(),
  preferred_language: z.string().min(2).max(10),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ─── Operator ─────────────────────────────────────────────────────────────────

export const OperatorSchema = z.object({
  id: z.string().uuid(),
  profile_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  logo_url: z.string().url().nullable(),
  website_url: z.string().url().nullable(),
  phone: z.string().nullable(),
  email: z.string().email().nullable(),
  verified: z.boolean(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ─── OperatorResort ───────────────────────────────────────────────────────────

export const OperatorResortSchema = z.object({
  id: z.string().uuid(),
  operator_id: z.string().uuid(),
  resort_id: z.string().uuid(),
  active: z.boolean(),
  created_at: z.string().datetime(),
})

// ─── Service ──────────────────────────────────────────────────────────────────

export const ServiceSchema = z.object({
  id: z.string().uuid(),
  operator_id: z.string().uuid(),
  resort_id: z.string().uuid(),
  type: ServiceTypeSchema,
  name: z.string().min(1).max(200),
  description: z.string().min(1),
  price_per_person: z.number().nonnegative(),
  currency: z.string().length(3),
  duration_minutes: z.number().int().positive(),
  max_participants: z.number().int().positive(),
  min_age: z.number().int().nonnegative().nullable(),
  max_age: z.number().int().positive().nullable(),
  season_mode: SeasonModeSchema,
  image_urls: z.array(z.string().url()),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ─── OfferPageContent ─────────────────────────────────────────────────────────

export const OfferPageContentSchema = z.object({
  id: z.string().uuid(),
  operator_id: z.string().uuid(),
  resort_id: z.string().uuid(),
  service_id: z.string().uuid().nullable(),
  hero_image_url: z.string().url().nullable(),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(300).nullable(),
  description: z.string().min(1),
  highlights: z.array(z.string().min(1)),
  seo_title: z.string().max(60).nullable(),
  seo_description: z.string().max(160).nullable(),
  published: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ─── AvailabilitySlot ─────────────────────────────────────────────────────────

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/

export const AvailabilitySlotSchema = z.object({
  id: z.string().uuid(),
  service_id: z.string().uuid(),
  operator_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  start_time: z.string().regex(timeRegex, 'Time must be HH:mm'),
  end_time: z.string().regex(timeRegex, 'Time must be HH:mm'),
  capacity_total: z.number().int().positive(),
  capacity_booked: z.number().int().nonnegative(),
  price_override: z.number().nonnegative().nullable(),
  notes: z.string().nullable(),
  active: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).refine(
  (slot) => slot.capacity_booked <= slot.capacity_total,
  { message: 'capacity_booked cannot exceed capacity_total', path: ['capacity_booked'] },
)

// ─── Booking ──────────────────────────────────────────────────────────────────

export const SchoolDataSchema = z.object({
  skill_level: SkillLevelSchema,
  instructor_preference: z.string().nullable(),
  special_requirements: z.string().nullable(),
})

export const RentalDataSchema = z.object({
  equipment_type: EquipmentTypeSchema,
  height_cm: z.number().int().min(50).max(250),
  weight_kg: z.number().min(10).max(300),
  boot_size: z.number().min(15).max(55),
  helmet_size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL']),
  preferred_brand: z.string().nullable(),
})

export const BookingParticipantSchema = z.object({
  id: z.string().uuid(),
  booking_id: z.string().uuid(),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  age: z.number().int().nonnegative().nullable(),
  school_data: SchoolDataSchema.nullable(),
  rental_data: RentalDataSchema.nullable(),
})

export const BookingSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  operator_id: z.string().uuid(),
  resort_id: z.string().uuid(),
  service_id: z.string().uuid(),
  availability_slot_id: z.string().uuid(),
  type: BookingTypeSchema,
  status: BookingStatusSchema,
  total_price: z.number().nonnegative(),
  currency: z.string().length(3),
  stripe_payment_intent_id: z.string().nullable(),
  customer_notes: z.string().nullable(),
  operator_notes: z.string().nullable(),
  participants: z.array(BookingParticipantSchema).min(1),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ─── Review ───────────────────────────────────────────────────────────────────

export const ReviewSchema = z.object({
  id: z.string().uuid(),
  booking_id: z.string().uuid(),
  customer_id: z.string().uuid(),
  operator_id: z.string().uuid(),
  service_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).nullable(),
  body: z.string().min(10).max(2000),
  operator_reply: z.string().max(2000).nullable(),
  published: z.boolean(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

// ─── EquipmentInventory ───────────────────────────────────────────────────────

export const EquipmentInventorySchema = z.object({
  id: z.string().uuid(),
  operator_id: z.string().uuid(),
  resort_id: z.string().uuid(),
  category: EquipmentCategorySchema,
  brand: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  size: z.string().min(1).max(20),
  quantity_total: z.number().int().nonnegative(),
  quantity_available: z.number().int().nonnegative(),
  condition: EquipmentConditionSchema,
  season_mode: SeasonModeSchema,
  notes: z.string().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
}).refine(
  (inv) => inv.quantity_available <= inv.quantity_total,
  { message: 'quantity_available cannot exceed quantity_total', path: ['quantity_available'] },
)

// ─── Inferred Types ───────────────────────────────────────────────────────────
// Use these where you need the Zod-inferred shape (e.g. form data) instead of
// the hand-written interfaces in src/types/index.ts.

export type ResortInput = z.infer<typeof ResortSchema>
export type ProfileInput = z.infer<typeof ProfileSchema>
export type OperatorInput = z.infer<typeof OperatorSchema>
export type OperatorResortInput = z.infer<typeof OperatorResortSchema>
export type ServiceInput = z.infer<typeof ServiceSchema>
export type OfferPageContentInput = z.infer<typeof OfferPageContentSchema>
export type AvailabilitySlotInput = z.infer<typeof AvailabilitySlotSchema>
export type SchoolDataInput = z.infer<typeof SchoolDataSchema>
export type RentalDataInput = z.infer<typeof RentalDataSchema>
export type BookingParticipantInput = z.infer<typeof BookingParticipantSchema>
export type BookingInput = z.infer<typeof BookingSchema>
export type ReviewInput = z.infer<typeof ReviewSchema>
export type EquipmentInventoryInput = z.infer<typeof EquipmentInventorySchema>
