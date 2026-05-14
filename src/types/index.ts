// ─── Primitives & Enums ──────────────────────────────────────────────────────

export type SeasonMode = 'winter' | 'summer'

export type UserRole = 'customer' | 'operator' | 'admin'

export type ServiceType = 'ski_school' | 'ski_rental' | 'bike_rental' | 'bike_guiding'

export type BookingType = 'school_only' | 'rental_only' | 'guiding_only' | 'bundle'

export type BookingStatus = 'pending' | 'confirmed' | 'arrived' | 'completed' | 'cancelled'

export type SkillLevel = 'beginner' | 'intermediate' | 'advanced'

export type EquipmentCategory = 'ski' | 'snowboard' | 'boot' | 'helmet' | 'bike' | 'e-bike'

export type EquipmentType = 'ski' | 'snowboard' | 'bike' | 'e-bike'

export type EquipmentCondition = 'new' | 'good' | 'fair' | 'retired'

// ─── Resort ──────────────────────────────────────────────────────────────────

export interface Resort {
  id: string
  name: string
  slug: string
  description: string
  country: string
  region: string
  latitude: number
  longitude: number
  elevation_m: number | null
  season_modes: SeasonMode[]
  amenities: string[]
  image_urls: string[]
  website_url: string | null
  active: boolean
  created_at: string
  updated_at: string
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string           // matches auth.uid
  role: UserRole
  first_name: string
  last_name: string
  email: string
  phone: string | null
  avatar_url: string | null
  preferred_language: string
  created_at: string
  updated_at: string
}

// ─── Operator ─────────────────────────────────────────────────────────────────

export interface Operator {
  id: string
  profile_id: string
  name: string
  description: string
  logo_url: string | null
  website_url: string | null
  phone: string | null
  email: string | null
  verified: boolean
  active: boolean
  created_at: string
  updated_at: string
}

// ─── OperatorResort ───────────────────────────────────────────────────────────

export interface OperatorResort {
  id: string
  operator_id: string
  resort_id: string
  active: boolean
  created_at: string
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface Service {
  id: string
  operator_id: string
  resort_id: string
  type: ServiceType
  name: string
  description: string
  price_per_person: number
  currency: string
  duration_minutes: number
  max_participants: number
  min_age: number | null
  max_age: number | null
  season_mode: SeasonMode
  image_urls: string[]
  active: boolean
  created_at: string
  updated_at: string
}

// ─── OfferPageContent ─────────────────────────────────────────────────────────

export interface OfferPageContent {
  id: string
  operator_id: string
  resort_id: string
  service_id: string | null
  hero_image_url: string | null
  headline: string
  subheadline: string | null
  description: string
  highlights: string[]
  seo_title: string | null
  seo_description: string | null
  published: boolean
  created_at: string
  updated_at: string
}

// ─── AvailabilitySlot ─────────────────────────────────────────────────────────

export interface AvailabilitySlot {
  id: string
  service_id: string
  operator_id: string
  date: string              // ISO date, e.g. "2025-01-15"
  start_time: string        // "HH:mm"
  end_time: string          // "HH:mm"
  capacity_total: number
  capacity_booked: number
  price_override: number | null
  notes: string | null
  active: boolean
  created_at: string
  updated_at: string
}

// ─── Booking ──────────────────────────────────────────────────────────────────

export interface SchoolData {
  skill_level: SkillLevel
  instructor_preference: string | null
  special_requirements: string | null
}

export interface RentalData {
  equipment_type: EquipmentType
  height_cm: number
  weight_kg: number
  boot_size: number
  helmet_size: string       // e.g. "S", "M", "L", "XL"
  preferred_brand: string | null
}

export interface BookingParticipant {
  id: string
  booking_id: string
  first_name: string
  last_name: string
  age: number | null
  school_data: SchoolData | null
  rental_data: RentalData | null
}

export interface Booking {
  id: string
  customer_id: string       // Profile.id
  operator_id: string
  resort_id: string
  service_id: string
  availability_slot_id: string
  type: BookingType
  status: BookingStatus
  total_price: number
  currency: string
  stripe_payment_intent_id: string | null
  customer_notes: string | null
  operator_notes: string | null
  participants: BookingParticipant[]
  created_at: string
  updated_at: string
}

// ─── Review ───────────────────────────────────────────────────────────────────

export interface Review {
  id: string
  booking_id: string
  customer_id: string
  operator_id: string
  service_id: string
  rating: number            // 1–5
  title: string | null
  body: string
  operator_reply: string | null
  published: boolean
  created_at: string
  updated_at: string
}

// ─── EquipmentInventory ───────────────────────────────────────────────────────

export interface EquipmentInventory {
  id: string
  operator_id: string
  resort_id: string
  category: EquipmentCategory
  brand: string
  model: string
  size: string
  quantity_total: number
  quantity_available: number
  condition: EquipmentCondition
  season_mode: SeasonMode
  notes: string | null
  created_at: string
  updated_at: string
}
