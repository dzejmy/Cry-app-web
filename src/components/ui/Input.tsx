import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
  leftIcon?: ReactNode
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, id, className = '', ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              {leftIcon}
            </span>
          )}

          <input
            {...props}
            id={inputId}
            ref={ref}
            className={[
              'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
              leftIcon ? 'pl-10' : '',
              error
                ? 'border-red-400 focus:ring-red-300'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
              'disabled:bg-gray-50 disabled:text-gray-500',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
          />

          {error && (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
          )}
        </div>

        {error ? (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    )
  },
)

Input.displayName = 'Input'
export default Input
