import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Select = forwardRef(({ label, error, children, className, ...props }, ref) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>}
    <select
      ref={ref}
      className={cn(
        'w-full px-3 py-2 border rounded-lg text-sm bg-white transition-all',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent',
        error ? 'border-red-400' : 'border-gray-300', className
      )}
      {...props}
    >{children}</select>
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
))
Select.displayName = 'Select'
