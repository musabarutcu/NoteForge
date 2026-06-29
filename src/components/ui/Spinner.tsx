import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?:      'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4 border-[1.5px]',
    md: 'h-6 w-6 border-2',
    lg: 'h-8 w-8 border-2',
  }

  return (
    <span
      className={cn(
        'inline-block rounded-full border-[#4D8DFF] border-t-transparent animate-spin',
        sizes[size],
        className
      )}
      aria-label="Yükleniyor"
    />
  )
}

export function FullPageSpinner() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="lg" />
        <p className="text-[13px] text-[#555555]">Yükleniyor…</p>
      </div>
    </div>
  )
}
