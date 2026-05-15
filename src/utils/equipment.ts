import type { RentalEquipmentType } from '../store/skiRentalStore'

// ─── Recommendation output ────────────────────────────────────────────────────

export type RecoTier =
  | 'beginner_ski' | 'performance_ski' | 'race_ski'
  | 'beginner_snowboard' | 'freestyle_snowboard' | 'freeride_snowboard'
  | 'telemark'

export interface EquipmentReco {
  tier: RecoTier
  label: string
  tagline: string
  description: string
  specs: string[]
  reason: string
}

// ─── Colour tokens per tier ───────────────────────────────────────────────────

export const TIER_COLORS: Record<RecoTier, { bg: string; text: string; border: string; dot: string }> = {
  beginner_ski:        { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
  performance_ski:     { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   dot: 'bg-blue-500'   },
  race_ski:            { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  beginner_snowboard:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  dot: 'bg-green-500'  },
  freestyle_snowboard: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  freeride_snowboard:  { bg: 'bg-red-50',    text: 'text-red-700',    border: 'border-red-200',    dot: 'bg-red-500'    },
  telemark:            { bg: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-200',  dot: 'bg-amber-500'  },
}

// ─── Helper calculations ──────────────────────────────────────────────────────

function helmetSize(cm: number | null): string {
  if (!cm) return 'M'
  if (cm < 53) return 'XS'
  if (cm < 55) return 'S'
  if (cm < 57) return 'M'
  if (cm < 59) return 'L'
  if (cm < 62) return 'XL'
  return 'XXL'
}

function skiLength(heightCm: number, skill: number): number {
  const factor = skill <= 2 ? 0.85 : skill === 3 ? 0.90 : 0.95
  return Math.round((heightCm * factor) / 5) * 5
}

function snowboardLength(heightCm: number, skill: number): number {
  const base = heightCm * 0.85
  const offset = skill <= 2 ? -5 : skill >= 4 ? 5 : 0
  return Math.round((base + offset) / 2) * 2
}

function poleLength(heightCm: number): number {
  return Math.round((heightCm * 0.68) / 5) * 5
}

function bootFlex(skill: number, weightKg: number): number {
  const base = skill <= 2 ? 60 : skill === 3 ? 80 : 100
  const adj = weightKg > 85 ? 10 : weightKg < 60 ? -10 : 0
  return base + adj
}

// ─── Main recommendation function ────────────────────────────────────────────

export interface RecoParams {
  skillLevel: number           // 1–5
  heightCm: number
  weightKg: number
  shoeSizeEU: number
  equipmentType: RentalEquipmentType
  helmet: boolean
  helmetCircumferenceCm: number | null
  poles: boolean
}

export function recommendEquipment(p: RecoParams): EquipmentReco {
  const hSize = helmetSize(p.helmetCircumferenceCm)
  const poleLen = poleLength(p.heightCm)

  const commonSpecs: string[] = [
    `Boot size: EU ${p.shoeSizeEU}`,
    ...(p.helmet ? [`Helmet: size ${hSize}`] : []),
  ]

  if (p.equipmentType === 'snowboard') {
    const boardLen = snowboardLength(p.heightCm, p.skillLevel)
    const flexLabel = p.skillLevel <= 2 ? 'Soft (forgiving)' : p.skillLevel === 3 ? 'Medium (versatile)' : 'Stiff (responsive)'

    if (p.skillLevel <= 2) return {
      tier: 'beginner_snowboard',
      label: 'Beginner Board',
      tagline: 'Soft flex, easy turns',
      description: 'Twin-tip shape with soft flex — forgiving on heel-side and toe-side edges. Great for building fundamental skills on easy to medium runs.',
      specs: [`Board length: ${boardLen} cm`, `Flex: ${flexLabel}`, ...commonSpecs],
      reason: `Skill ${p.skillLevel}/5 — a softer, shorter board helps new riders learn balance and turns faster.`,
    }
    if (p.skillLevel === 3) return {
      tier: 'freestyle_snowboard',
      label: 'Freestyle Board',
      tagline: 'All-mountain fun',
      description: 'Medium flex twin-tip suitable for groomers, beginner park features, and exploring the whole mountain.',
      specs: [`Board length: ${boardLen} cm`, `Flex: ${flexLabel}`, ...commonSpecs],
      reason: `Skill ${p.skillLevel}/5 — a freestyle board handles the variety of terrain an intermediate rider explores.`,
    }
    return {
      tier: 'freeride_snowboard',
      label: 'Freeride Board',
      tagline: 'Off-piste specialist',
      description: 'Directional shape with stiff flex for carving, speed, and powder. Built for experienced riders who push limits.',
      specs: [`Board length: ${boardLen} cm`, `Flex: ${flexLabel}`, ...commonSpecs],
      reason: `Skill ${p.skillLevel}/5 — expert riders get maximum performance from a longer, stiffer board.`,
    }
  }

  if (p.equipmentType === 'telemark') {
    const skiLen = skiLength(p.heightCm, p.skillLevel)
    return {
      tier: 'telemark',
      label: 'Telemark Setup',
      tagline: 'Free-heel downhill',
      description: 'Classic telemark skis with NTN or 75mm free-heel bindings and compatible boots. We adjust the setup to your experience level.',
      specs: [
        `Ski length: ~${skiLen} cm`,
        'Binding: NTN / 75mm free-heel',
        ...(p.poles ? [`Poles: ${poleLen} cm`] : []),
        ...commonSpecs,
      ],
      reason: 'Telemark equipment is specialised — our technician will fine-tune the setup to match your skill level.',
    }
  }

  // Skis
  const skiLen = skiLength(p.heightCm, p.skillLevel)
  const flex = bootFlex(p.skillLevel, p.weightKg)
  const skiSpecs = [
    `Ski length: ${skiLen} cm`,
    `Boot flex: ${flex}`,
    ...(p.poles ? [`Poles: ${poleLen} cm`] : []),
    ...commonSpecs,
  ]

  if (p.skillLevel <= 2) return {
    tier: 'beginner_ski',
    label: 'Beginner Skis',
    tagline: 'Easy & forgiving',
    description: 'Wide waist and soft flex make turns easy and forgive technique mistakes. Perfect for first-timers and those revisiting skiing after a break.',
    specs: skiSpecs,
    reason: `Skill ${p.skillLevel}/5 — shorter skis with soft boots help build confidence quickly on easy runs.`,
  }
  if (p.skillLevel === 3) return {
    tier: 'performance_ski',
    label: 'Performance Skis',
    tagline: 'Versatile all-mountain',
    description: 'Medium waist for confident carving on piste and exploring easy off-piste. Good edge grip without being too demanding.',
    specs: skiSpecs,
    reason: `Skill ${p.skillLevel}/5 — an all-mountain ski handles the variety of terrain an intermediate skier enjoys.`,
  }
  return {
    tier: 'race_ski',
    label: 'Expert / Race Skis',
    tagline: 'High-performance carver',
    description: 'Narrow carving ski with stiff flex and titanium reinforcement. Maximum edge grip and energy transmission for precise, aggressive skiing.',
    specs: skiSpecs,
    reason: `Skill ${p.skillLevel}/5 — expert skiers get the best experience from longer, stiffer, more responsive equipment.`,
  }
}

// ─── All possible tiers for a given equipment type ───────────────────────────

export const TIERS_BY_EQUIPMENT: Record<RentalEquipmentType, RecoTier[]> = {
  skis:       ['beginner_ski', 'performance_ski', 'race_ski'],
  snowboard:  ['beginner_snowboard', 'freestyle_snowboard', 'freeride_snowboard'],
  telemark:   ['telemark'],
}

export const TIER_LABELS: Record<RecoTier, string> = {
  beginner_ski:        'Beginner Skis',
  performance_ski:     'Performance Skis',
  race_ski:            'Expert / Race Skis',
  beginner_snowboard:  'Beginner Board',
  freestyle_snowboard: 'Freestyle Board',
  freeride_snowboard:  'Freeride Board',
  telemark:            'Telemark Setup',
}
