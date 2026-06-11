import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef(({ label, error, className, ...props }, ref) => (
  <div className="mb-4">
    {label && <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>}
    <input
      ref={ref}
      className={cn(
        'w-full px-3 py-2 border rounded-lg text-sm transition-all',
        'focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent',
        error ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white',
        className
      )}
      {...props}
    />
    {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
  </div>
))
Input.displayName = 'Input'
