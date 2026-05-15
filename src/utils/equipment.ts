import type { RentalEquipmentType } from '../store/skiRentalStore'
import type { RidingStyle } from '../store/bikeRentalStore'

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

// ─── Bike types ───────────────────────────────────────────────────────────────

export type BikeFrameSize = 'S' | 'M' | 'L' | 'XL'

export type BikeTier =
  | 'leisure_bike'
  | 'trail_bike'
  | 'enduro_bike'
  | 'cross_country_bike'
  | 'leisure_ebike'
  | 'trail_ebike'
  | 'performance_ebike'

export interface BikeReco {
  frameSize: BikeFrameSize
  tier: BikeTier
  label: string
  tagline: string
  description: string
  specs: string[]
  reason: string
}

export const BIKE_TIER_COLORS: Record<BikeTier, { bg: string; text: string; border: string; dot: string }> = {
  leisure_bike:       { bg: 'bg-green-50',   text: 'text-green-700',   border: 'border-green-200',   dot: 'bg-green-500'   },
  trail_bike:         { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    dot: 'bg-blue-500'    },
  enduro_bike:        { bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  dot: 'bg-orange-500'  },
  cross_country_bike: { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',    dot: 'bg-teal-500'    },
  leisure_ebike:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  trail_ebike:        { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200',  dot: 'bg-violet-500'  },
  performance_ebike:  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500'     },
}

export const BIKE_TIER_LABELS: Record<BikeTier, string> = {
  leisure_bike:       'Leisure Bike',
  trail_bike:         'Trail Bike',
  enduro_bike:        'Enduro Bike',
  cross_country_bike: 'Cross-Country Bike',
  leisure_ebike:      'Leisure E-Bike',
  trail_ebike:        'Trail E-Bike',
  performance_ebike:  'Performance E-Bike',
}

export const BIKE_TIERS_BY_STYLE: Record<string, BikeTier[]> = {
  leisure:       ['leisure_bike', 'trail_bike', 'leisure_ebike'],
  trail:         ['trail_bike', 'enduro_bike', 'trail_ebike'],
  enduro:        ['enduro_bike', 'trail_bike', 'performance_ebike'],
  cross_country: ['cross_country_bike', 'trail_bike', 'trail_ebike'],
  leisure_ebike: ['leisure_ebike', 'trail_ebike'],
  trail_ebike:   ['trail_ebike', 'leisure_ebike', 'performance_ebike'],
  enduro_ebike:  ['performance_ebike', 'trail_ebike'],
  xc_ebike:      ['trail_ebike', 'leisure_ebike'],
}

export function bikeFrameSize(heightCm: number): BikeFrameSize {
  if (heightCm < 162) return 'S'
  if (heightCm < 174) return 'M'
  if (heightCm < 186) return 'L'
  return 'XL'
}

export function recommendBike(params: {
  heightCm: number
  weightKg: number
  ridingStyle: RidingStyle
  ebike: boolean
}): BikeReco {
  const { heightCm, weightKg, ridingStyle, ebike } = params
  const frameSize = bikeFrameSize(heightCm)
  const heavySpec = weightKg > 95 ? 'Reinforced frame (≥ 95 kg spec)' : null
  const baseSpecs = [`Frame size: ${frameSize}`, ...(heavySpec ? [heavySpec] : [])]

  if (ebike) {
    if (ridingStyle === 'leisure' || ridingStyle === 'cross_country') {
      return {
        frameSize, tier: 'leisure_ebike',
        label: 'Leisure E-Bike', tagline: 'Effortless exploration',
        description: 'Comfortable geometry with pedal-assist motor. Ideal for scenic rides and climbs without the effort. Hub-drive or mid-drive available.',
        specs: [...baseSpecs, 'Motor: 250 W pedal-assist', 'Range: ~60–80 km', 'Hydraulic disc brakes'],
        reason: `${ridingStyle === 'leisure' ? 'Leisure' : 'Cross-country'} riding with e-assist for longer rides and easier climbs.`,
      }
    }
    if (ridingStyle === 'trail') {
      return {
        frameSize, tier: 'trail_ebike',
        label: 'Trail E-Bike', tagline: 'Powered trail shredder',
        description: 'Full-suspension trail geometry with mid-drive motor for maximum power transfer on technical climbs and descents.',
        specs: [...baseSpecs, 'Motor: Bosch Performance mid-drive', 'Range: ~50–70 km', '150 mm travel front & rear'],
        reason: 'Trail riding with e-assist amplifies climbing power while keeping descents technical and fun.',
      }
    }
    return {
      frameSize, tier: 'performance_ebike',
      label: 'Performance E-Bike', tagline: 'Enduro power',
      description: 'High-torque mid-drive motor on an enduro platform. Machine-assisted climbs, raw and capable descents.',
      specs: [...baseSpecs, 'Motor: Shimano EP8 / Bosch CX', 'Torque: up to 85 Nm', '170 mm travel front & rear'],
      reason: 'Enduro with e-assist — aggressive terrain capability combined with effortless climbing.',
    }
  }

  if (ridingStyle === 'leisure') {
    return {
      frameSize, tier: 'leisure_bike',
      label: 'Leisure Bike', tagline: 'Easy, comfortable rides',
      description: 'Upright geometry, wide tires and a padded saddle. Great for scenic trails, bike paths and village-to-village rides.',
      specs: [...baseSpecs, 'Geometry: comfort / upright', 'Tire: 2.2" all-terrain', 'Hydraulic disc brakes'],
      reason: 'Leisure style — a comfortable, stable bike for relaxed mountain exploration.',
    }
  }
  if (ridingStyle === 'cross_country') {
    return {
      frameSize, tier: 'cross_country_bike',
      label: 'Cross-Country Bike', tagline: 'Efficient climber',
      description: 'Lightweight hardtail or short-travel full-suspension optimised for trail efficiency. Climbs fast, rolls quickly.',
      specs: [...baseSpecs, 'Geometry: aggressive XC', 'Travel: 100–120 mm', 'Fast-rolling XC tires'],
      reason: 'Cross-country rewards an efficient, lightweight bike that climbs fast and conserves energy.',
    }
  }
  if (ridingStyle === 'trail') {
    return {
      frameSize, tier: 'trail_bike',
      label: 'Trail Bike', tagline: 'All-mountain versatility',
      description: '140 mm full-suspension trail bike with balanced geometry. Climbs efficiently and descends confidently on most terrain.',
      specs: [...baseSpecs, 'Geometry: trail / all-mountain', 'Travel: 140 mm front & rear', 'Mid-fat tires 2.4"'],
      reason: 'Trail style — a versatile full-suspension bike that handles gravel to steep singletrack.',
    }
  }
  return {
    frameSize, tier: 'enduro_bike',
    label: 'Enduro Bike', tagline: 'Built for descents',
    description: 'Long-travel (160–170 mm) full-suspension enduro machine with slack geometry. Dominates technical descents and rough terrain.',
    specs: [...baseSpecs, 'Travel: 165 mm front & rear', 'Geometry: slack & low', 'Maxxis Assegai tires'],
    reason: 'Enduro style demands the most capable and progressive full-suspension bike in the fleet.',
  }
}
