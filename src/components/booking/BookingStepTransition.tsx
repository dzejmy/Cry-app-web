import { AnimatePresence, motion } from 'framer-motion'

interface BookingStepTransitionProps {
  step: number
  direction: number    // +1 = forward (slide left), -1 = backward (slide right)
  children: React.ReactNode
}

/**
 * Wraps each booking step panel with a horizontal slide transition.
 *
 * Usage:
 * ```tsx
 * const [step, setStep] = useState(1)
 * const [dir, setDir] = useState(1)
 *
 * function goNext() { setDir(1); setStep(s => s + 1) }
 * function goBack() { setDir(-1); setStep(s => s - 1) }
 *
 * <BookingStepTransition step={step} direction={dir}>
 *   {step === 1 && <StepOne />}
 *   {step === 2 && <StepTwo />}
 * </BookingStepTransition>
 * ```
 */
export default function BookingStepTransition({
  step,
  direction,
  children,
}: BookingStepTransitionProps) {
  return (
    <div className="relative overflow-hidden">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={step}
          custom={direction}
          variants={{
            enter:  (d: number) => ({ x: d > 0 ? '60%' : '-60%', opacity: 0 }),
            center: { x: 0, opacity: 1 },
            exit:   (d: number) => ({ x: d > 0 ? '-60%' : '60%', opacity: 0 }),
          }}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
