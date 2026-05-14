import { create } from 'zustand'
import type { SeasonMode } from '../types'

interface SeasonState {
  season: SeasonMode
  isManualOverride: boolean

  setSeason: (season: SeasonMode) => void
  toggleSeason: () => void
}

function detectSeason(): SeasonMode {
  const month = new Date().getMonth() + 1 // 1–12
  // Nov–Apr = winter, May–Oct = summer
  return month >= 11 || month <= 4 ? 'winter' : 'summer'
}

export const useSeasonStore = create<SeasonState>((set, get) => ({
  season: detectSeason(),
  isManualOverride: false,

  setSeason: (season) => set({ season, isManualOverride: true }),

  toggleSeason: () => {
    const next = get().season === 'winter' ? 'summer' : 'winter'
    set({ season: next, isManualOverride: true })
  },
}))
