import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type RentalEquipmentType = 'skis' | 'snowboard' | 'telemark'

export interface RentalParticipant {
  firstName: string
  lastName: string
  age: number | null
  skillLevel: number | null        // 1–5 from SkillLevelPicker
  equipmentType: RentalEquipmentType | null
  heightCm: number | null
  weightKg: number | null
  shoeSizeEU: number | null
  helmet: boolean
  helmetCircumferenceCm: number | null
  poles: boolean
  recoTierOverride: string | null  // null → use computed recommendation
}

const emptyParticipant = (): RentalParticipant => ({
  firstName: '',
  lastName: '',
  age: null,
  skillLevel: null,
  equipmentType: null,
  heightCm: null,
  weightKg: null,
  shoeSizeEU: null,
  helmet: false,
  helmetCircumferenceCm: null,
  poles: true,
  recoTierOverride: null,
})

interface SkiRentalState {
  step: number
  pickupDate: string | null   // 'yyyy-MM-dd'
  returnDate: string | null
  participantCount: number
  participants: RentalParticipant[]
  termsAccepted: boolean
  confirmedBookingId: string | null

  setStep: (step: number) => void
  setDates: (pickup: string, ret: string) => void
  setParticipantCount: (n: number) => void
  updateParticipant: (index: number, data: Partial<RentalParticipant>) => void
  setTermsAccepted: (v: boolean) => void
  setConfirmedBookingId: (id: string) => void
  reset: () => void
}

const INITIAL: Omit<SkiRentalState,
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

export const useSkiRentalStore = create<SkiRentalState>()(
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
      name: 'peakpass-ski-rental',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
