import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { RentalEquipmentType } from './skiRentalStore'

export type LessonType = 'private' | 'group' | 'kids'

export interface SchoolRental {
  equipmentType: RentalEquipmentType | null
  heightCm: number | null
  weightKg: number | null
  shoeSizeEU: number | null
  helmet: boolean
  helmetCircumferenceCm: number | null
  poles: boolean
}

export interface SchoolParticipant {
  firstName: string
  lastName: string
  age: number | null
  skillLevel: number | null   // 1–5
  // kids lessons only
  guardianName: string
  guardianPhone: string
  // bundle rental
  rentalEnabled: boolean
  rental: SchoolRental
}

const emptyRental = (): SchoolRental => ({
  equipmentType: null,
  heightCm: null,
  weightKg: null,
  shoeSizeEU: null,
  helmet: false,
  helmetCircumferenceCm: null,
  poles: true,
})

const emptyParticipant = (): SchoolParticipant => ({
  firstName: '',
  lastName: '',
  age: null,
  skillLevel: null,
  guardianName: '',
  guardianPhone: '',
  rentalEnabled: false,
  rental: emptyRental(),
})

interface SkiSchoolState {
  step: number
  lessonType: LessonType | null
  selectedDate: string | null    // 'yyyy-MM-dd'
  selectedSlotId: string | null
  selectedSlotTime: string | null
  participantCount: number
  participants: SchoolParticipant[]
  apresSkiAddon: boolean
  termsAccepted: boolean
  confirmedBookingId: string | null

  setStep: (step: number) => void
  setLessonType: (type: LessonType) => void
  setDate: (date: string) => void
  setSlot: (slotId: string, time: string) => void
  setParticipantCount: (n: number) => void
  updateParticipant: (index: number, data: Partial<SchoolParticipant>) => void
  updateRental: (index: number, data: Partial<SchoolRental>) => void
  setApresSkiAddon: (v: boolean) => void
  setTermsAccepted: (v: boolean) => void
  setConfirmedBookingId: (id: string) => void
  reset: () => void
}

const INITIAL: Omit<SkiSchoolState,
  | 'setStep' | 'setLessonType' | 'setDate' | 'setSlot'
  | 'setParticipantCount' | 'updateParticipant' | 'updateRental'
  | 'setApresSkiAddon' | 'setTermsAccepted' | 'setConfirmedBookingId' | 'reset'
> = {
  step: 1,
  lessonType: null,
  selectedDate: null,
  selectedSlotId: null,
  selectedSlotTime: null,
  participantCount: 1,
  participants: [emptyParticipant()],
  apresSkiAddon: false,
  termsAccepted: false,
  confirmedBookingId: null,
}

export const useSkiSchoolStore = create<SkiSchoolState>()(
  persist(
    (set) => ({
      ...INITIAL,

      setStep: (step) => set({ step }),
      setLessonType: (lessonType) => set({ lessonType }),
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

      setApresSkiAddon: (apresSkiAddon) => set({ apresSkiAddon }),
      setTermsAccepted: (termsAccepted) => set({ termsAccepted }),
      setConfirmedBookingId: (confirmedBookingId) => set({ confirmedBookingId }),

      reset: () => set({ ...INITIAL, participants: [emptyParticipant()] }),
    }),
    {
      name: 'peakpass-ski-school',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
