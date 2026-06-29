import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?:   string
  error?:   string
  hint?:    string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="text-[11px] font-semibold uppercase tracking-widest text-[#9A9A9A]"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full h-10 px-3 rounded-[8px]',
            'bg-[#0D0D0D] border border-[#232323]',
            'text-[15px] text-white placeholder:text-[#555555]',
            'transition-colors duration-150',
            'focus:outline-none focus:border-[#4D8DFF] focus:ring-1 focus:ring-[#4D8DFF]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-[12px] text-[#EF4444]">{error}</p>
        )}
        {hint && !error && (
          <p className="text-[12px] text-[#555555]">{hint}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export { Input }
