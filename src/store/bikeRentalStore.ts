import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type RidingStyle = 'trail' | 'enduro' | 'cross_country' | 'leisure'
export type MotorPreference = 'mid_drive' | 'hub_drive' | 'no_preference'

export interface BikeRentalParticipant {
  firstName: string
  lastName: string
  age: number | null
  heightCm: number | null
  weightKg: number | null
  ridingStyle: RidingStyle | null
  ebike: boolean
  motorPreference: MotorPreference | null
  helmet: boolean
  gloves: boolean
  bodyProtection: boolean
  recoTierOverride: string | null
}

const emptyParticipant = (): BikeRentalParticipant => ({
  firstName: '',
  lastName: '',
  age: null,
  heightCm: null,
  weightKg: null,
  ridingStyle: null,
  ebike: false,
  motorPreference: null,
  helmet: true,
  gloves: false,
  bodyProtection: false,
  recoTierOverride: null,
})

interface BikeRentalState {
  step: number
  pickupDate: string | null
  returnDate: string | null
  participantCount: number
  participants: BikeRentalParticipant[]
  termsAccepted: boolean
  confirmedBookingId: string | null

  setStep: (step: number) => void
  setDates: (pickup: string, ret: string) => void
  setParticipantCount: (n: number) => void
  updateParticipant: (index: number, data: Partial<BikeRentalParticipant>) => void
  setTermsAccepted: (v: boolean) => void
  setConfirmedBookingId: (id: string) => void
  reset: () => void
}

const INITIAL: Omit<BikeRentalState,
  'setStep' | 'setDates' | 'setParticipantCount' | 'updateParticipant' |
  'setTermsAccepted' | 'setConfirmedBookingId' | 'reset'
> = {
  step: 1,
  pickupDate: null,
  returnDate: null,
  participantCount: 1,
  participants: [emptyParticipant()],
  termsAccepted: false,
  confirmedBookingId: null,
}

export const useBikeRentalStore = create<BikeRentalState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setStep: (step) => set({ step }),

      setDates: (pickupDate, returnDate) => set({ pickupDate, returnDate }),

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

      setTermsAccepted: (termsAccepted) => set({ termsAccepted }),
      setConfirmedBookingId: (confirmedBookingId) => set({ confirmedBookingId }),

      reset: () => set({ ...INITIAL, participants: [emptyParticipant()] }),
    }),
    {
      name: 'peakpass-bike-rental',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
