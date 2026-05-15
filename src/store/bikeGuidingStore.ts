import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { RidingStyle, MotorPreference } from './bikeRentalStore'

export type TourType = 'half_day' | 'full_day' | 'multi_day'

export interface GuidingRental {
  heightCm: number | null
  weightKg: number | null
  ridingStyle: RidingStyle | null
  ebike: boolean
  motorPreference: MotorPreference | null
  helmet: boolean
  bodyProtection: boolean
}

export interface GuidingParticipant {
  firstName: string
  lastName: string
  age: number | null
  fitnessLevel: number | null   // 1–5
  rentalEnabled: boolean
  rental: GuidingRental
}

const emptyRental = (): GuidingRental => ({
  heightCm: null,
  weightKg: null,
  ridingStyle: null,
  ebike: false,
  motorPreference: null,
  helmet: true,
  bodyProtection: false,
})

const emptyParticipant = (): GuidingParticipant => ({
  firstName: '',
  lastName: '',
  age: null,
  fitnessLevel: null,
  rentalEnabled: false,
  rental: emptyRental(),
})

interface BikeGuidingState {
  step: number
  selectedGuideId: string | null
  tourType: TourType | null
  selectedDate: string | null
  selectedSlotId: string | null
  selectedSlotTime: string | null
  participantCount: number
  participants: GuidingParticipant[]
  apresRideAddon: boolean
  termsAccepted: boolean
  confirmedBookingId: string | null

  setStep: (step: number) => void
  setGuide: (guideId: string) => void
  setTourType: (type: TourType) => void
  setDate: (date: string) => void
  setSlot: (slotId: string, time: string) => void
  setParticipantCount: (n: number) => void
  updateParticipant: (index: number, data: Partial<GuidingParticipant>) => void
  updateRental: (index: number, data: Partial<GuidingRental>) => void
  setApresRideAddon: (v: boolean) => void
  setTermsAccepted: (v: boolean) => void
  setConfirmedBookingId: (id: string) => void
  reset: () => void
}

const INITIAL: Omit<BikeGuidingState,
  | 'setStep' | 'setGuide' | 'setTourType' | 'setDate' | 'setSlot'
  | 'setParticipantCount' | 'updateParticipant' | 'updateRental'
  | 'setApresRideAddon' | 'setTermsAccepted' | 'setConfirmedBookingId' | 'reset'
> = {
  step: 1,
  selectedGuideId: null,
  tourType: null,
  selectedDate: null,
  selectedSlotId: null,
  selectedSlotTime: null,
  participantCount: 1,
  participants: [emptyParticipant()],
  apresRideAddon: false,
  termsAccepted: false,
  confirmedBookingId: null,
}

export const useBikeGuidingStore = create<BikeGuidingState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setStep: (step) => set({ step }),
      setGuide: (selectedGuideId) => set({ selectedGuideId }),
      setTourType: (tourType) => set({ tourType }),
      setDate: (selectedDate) => set({ selectedDate, selectedSlotId: null, selectedSlotTime: null }),
      setSlot: (selectedSlotId, selectedSlotTime) => set({ selectedSlotId, selectedSlotTime }),

      setParticipantCount: (n) =>
        set((s) => {
          if (n > s.participants.length) {
            const extra = Array.from({ length: n - s.participants.length }, emptyParticipant)
            return { participantCount: n, participants: [...s.participants, ...extra] }
          }
          return { participantCount: n, participants: s.participants.slice(0, n) }
        }),

      updateParticipant: (index, data) =>
        set((s) => {
          const participants = [...s.participants]
          participants[index] = { ...participants[index], ...data }
          return { participants }
        }),

      updateRental: (index, data) =>
        set((s) => {
          const participants = [...s.participants]
          participants[index] = {
            ...participants[index],
            rental: { ...participants[index].rental, ...data },
          }
          return { participants }
        }),

      setApresRideAddon: (apresRideAddon) => set({ apresRideAddon }),
      setTermsAccepted: (termsAccepted) => set({ termsAccepted }),
      setConfirmedBookingId: (confirmedBookingId) => set({ confirmedBookingId }),

      reset: () => set({ ...INITIAL, participants: [emptyParticipant()] }),
    }),
    {
      name: 'peakpass-bike-guiding',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
