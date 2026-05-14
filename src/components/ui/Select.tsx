import { forwardRef, type SelectHTMLAttributes } from 'react'
import { ChevronDown, AlertCircle } from 'lucide-react'

interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  error?: string
  helperText?: string
  options: SelectOption[]
  placeholder?: string
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, helperText, options, placeholder, id, className = '', ...props }, ref) => {
    const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          <select
            {...props}
            id={selectId}
            ref={ref}
            className={[
              'w-full appearance-none rounded-lg border bg-white pl-3 pr-9 py-2.5 text-sm text-gray-900',
              'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
              error
                ? 'border-red-400 focus:ring-red-300'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
              'disabled:bg-gray-50 disabled:text-gray-500',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Chevron — overlaps error icon to keep layout clean */}
          {error ? (
            <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500 pointer-events-none" />
          ) : (
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
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

Select.displayName = 'Select'
export default Select
