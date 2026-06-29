import { type HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hover?: boolean
}

export function Card({ className, hover, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[#0D0D0D] border border-[#232323] rounded-[12px]',
        hover && 'transition-colors duration-150 cursor-pointer hover:border-[#3A3A3A]',
        className
      )}
      {...props}
    />
  )
}

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'blue' | 'success' | 'danger'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-[#111111] border-[#232323] text-[#9A9A9A]',
    blue:    'bg-[#4D8DFF]/10 border-[#4D8DFF]/30 text-[#4D8DFF]',
    success: 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]',
    danger:  'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-[6px]',
        'border text-[11px] font-semibold uppercase tracking-wide',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}

export function Divider({ className, ...props }: HTMLAttributes<HTMLHRElement>) {
  return (
    <hr
      className={cn('border-0 border-t border-[#1A1A1A] w-full', className)}
      {...props}
    />
  )
}
