import { forwardRef, type ButtonHTMLAttributes, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

function mergeButtonStyles(base: CSSProperties, override?: CSSProperties): CSSProperties {
  if (!override) return base
  const merged = { ...base, ...override }
  if (override.padding != null) {
    delete merged.paddingTop
    delete merged.paddingBottom
    delete merged.paddingLeft
    delete merged.paddingRight
  }
  if (override.height != null) delete merged.minHeight
  return merged
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'danger-ghost' | 'icon'
  size?:    'sm' | 'md' | 'lg'
  loading?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, disabled, children, style, ...props }, ref) => {
    const base = 'inline-flex max-w-full min-w-0 items-center justify-center gap-2 text-center font-medium leading-tight whitespace-normal transition-all duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#4D8DFF] focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none shrink-0'

    const variants = {
      primary:      'bg-[#4D8DFF] text-white hover:bg-[#3D7AEE] active:bg-[#2D6ADE] rounded-[8px]',
      ghost:        'bg-transparent text-[#9A9A9A] border border-[#232323] hover:border-[#4D8DFF] hover:text-white rounded-[8px]',
      danger:       'bg-[#EF4444] text-white hover:bg-[#DC2626] rounded-[8px]',
      'danger-ghost':'bg-transparent text-[#EF4444] border border-[#EF4444] hover:bg-[#EF4444]/10 rounded-[8px]',
      icon:         'bg-transparent text-[#9A9A9A] hover:text-white hover:bg-[#111111] rounded-[8px]',
    }

    const iconSizes = {
      sm: 'h-8  w-8',
      md: 'h-9  w-9',
      lg: 'h-11 w-11',
    }

    const explicitStyles = variant === 'icon' ? { flexShrink: 0 } : {
      sm: { minHeight: 36, paddingLeft: 18, paddingRight: 18, paddingTop: 8, paddingBottom: 8, fontSize: 13, flexShrink: 0 },
      md: { minHeight: 40, paddingLeft: 20, paddingRight: 20, paddingTop: 10, paddingBottom: 10, fontSize: 14, flexShrink: 0 },
      lg: { minHeight: 48, paddingLeft: 28, paddingRight: 28, paddingTop: 12, paddingBottom: 12, fontSize: 15, flexShrink: 0 },
    }[size]

    return (
      <button
        ref={ref}
        className={cn(
          base,
          variants[variant],
          variant === 'icon' ? iconSizes[size] : '',
          className
        )}
        style={mergeButtonStyles(explicitStyles, style)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <span className="h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
            {children}
          </>
        ) : children}
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
