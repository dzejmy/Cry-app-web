import { forwardRef, type TextareaHTMLAttributes } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, id, className = '', ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        <textarea
          {...props}
          id={textareaId}
          ref={ref}
          className={[
            'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 resize-y min-h-[96px]',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-offset-0',
            error
              ? 'border-red-400 focus:ring-red-300'
              : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500',
            'disabled:bg-gray-50 disabled:text-gray-500',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {error ? (
          <p className="mt-1.5 text-xs text-red-600">{error}</p>
        ) : helperText ? (
          <p className="mt-1.5 text-xs text-gray-500">{helperText}</p>
        ) : null}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
export default Textarea
