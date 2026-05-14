import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  Resort,
  Operator,
  Service,
  AvailabilitySlot,
  ServiceType,
  SchoolData,
  RentalData,
} from '../types'

// ---------------------------------------------------------------------------
// Draft types — fields are optional while the user fills in the booking form
// ---------------------------------------------------------------------------

export interface DraftParticipant {
  first_name: string
  last_name: string
  age: number | null
  school_data: SchoolData | null
  rental_data: RentalData | null
}

export type BookingStep =
  | 'resort'
  | 'operator'
  | 'service'
  | 'slot'
  | 'participants'
  | 'review'
  | 'payment'
  | 'confirmation'

// ---------------------------------------------------------------------------
// State & actions
// ---------------------------------------------------------------------------

interface BookingState {
  currentStep: BookingStep
  serviceType: ServiceType | null
  selectedResort: Resort | null
  selectedOperator: Operator | null
  selectedService: Service | null
  selectedSlot: AvailabilitySlot | null
  participants: DraftParticipant[]
  rentalAddOns: RentalData[]
  totalAmount: number

  // Navigation
  setStep: (step: BookingStep) => void

  // Selection setters
  setServiceType: (type: ServiceType | null) => void
  setResort: (resort: Resort | null) => void
  setOperator: (operator: Operator | null) => void
  setService: (service: Service | null) => void
  setSlot: (slot: AvailabilitySlot | null) => void

  // Participants
  addParticipant: (participant?: Partial<DraftParticipant>) => void
  updateParticipant: (index: number, data: Partial<DraftParticipant>) => void
  removeParticipant: (index: number) => void

  // Rental add-ons (indexed by participant)
  setRentalAddOn: (participantIndex: number, data: RentalData | null) => void

  // Totals
  setTotalAmount: (amount: number) => void

  // Reset
  clearBooking: () => void
}

const emptyParticipant = (): DraftParticipant => ({
  first_name: '',
  last_name: '',
  age: null,
  school_data: null,
  rental_data: null,
})

const initialState: Omit<
  BookingState,
  | 'setStep'
  | 'setServiceType'
  | 'setResort'
  | 'setOperator'
  | 'setService'
  | 'setSlot'
  | 'addParticipant'
  | 'updateParticipant'
  | 'removeParticipant'
  | 'setRentalAddOn'
  | 'setTotalAmount'
  | 'clearBooking'
> = {
  currentStep: 'resort',
  serviceType: null,
  selectedResort: null,
  selectedOperator: null,
  selectedService: null,
  selectedSlot: null,
  participants: [],
  rentalAddOns: [],
  totalAmount: 0,
}

export const useBookingStore = create<BookingState>()(
  persist(
    (set, _get) => ({
      ...initialState,

      setStep: (step) => set({ currentStep: step }),

      setServiceType: (serviceType) => set({ serviceType }),
      setResort: (selectedResort) => set({ selectedResort }),
      setOperator: (selectedOperator) => set({ selectedOperator }),
      setService: (selectedService) => set({ selectedService }),
      setSlot: (selectedSlot) => set({ selectedSlot }),

      addParticipant: (partial = {}) =>
        set((s) => ({
          participants: [...s.participants, { ...emptyParticipant(), ...partial }],
        })),

      updateParticipant: (index, data) =>
        set((s) => {
          const participants = [...s.participants]
          participants[index] = { ...participants[index], ...data }
          return { participants }
        }),

      removeParticipant: (index) =>
        set((s) => ({
          participants: s.participants.filter((_, i) => i !== index),
          rentalAddOns: s.rentalAddOns.filter((_, i) => i !== index),
        })),

      setRentalAddOn: (participantIndex, data) =>
        set((s) => {
          const rentalAddOns = [...s.rentalAddOns]
          if (data === null) {
            rentalAddOns.splice(participantIndex, 1)
          } else {
            rentalAddOns[participantIndex] = data
          }
          return { rentalAddOns }
        }),

      setTotalAmount: (totalAmount) => set({ totalAmount }),

      clearBooking: () => {
        // Recalculate season-based defaults on next visit
        set({ ...initialState })
      },
    }),
    {
      name: 'peakpass-booking',
      storage: createJSONStorage(() => sessionStorage),
      // Persist everything except functions (handled automatically)
      partialize: (s) => ({
        currentStep: s.currentStep,
        serviceType: s.serviceType,
        selectedResort: s.selectedResort,
        selectedOperator: s.selectedOperator,
        selectedService: s.selectedService,
        selectedSlot: s.selectedSlot,
        participants: s.participants,
        rentalAddOns: s.rentalAddOns,
        totalAmount: s.totalAmount,
      }),
    },
  ),
)
