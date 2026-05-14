import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  footer?: ReactNode
  /** Prevent closing when the backdrop is clicked */
  disableBackdropClose?: boolean
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
}

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  disableBackdropClose = false,
  size = 'md',
}: ModalProps) {
  // Lock body scroll while open
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      role="dialog"
      aria-modal
      aria-labelledby={title ? 'modal-title' : undefined}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        aria-hidden
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
      />

      {/* Panel */}
      <div
        className={[
          'relative w-full bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]',
          sizeClasses[size],
        ].join(' ')}
      >
        {/* Header */}
        {(title || true) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
            {title ? (
              <h2 id="modal-title" className="text-base font-semibold text-gray-900">
                {title}
              </h2>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
