import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-brand-600 text-white border-brand-600 hover:bg-brand-700',
  outline: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50',
  danger:  'bg-red-600 text-white border-red-600 hover:bg-red-700',
  ghost:   'bg-transparent text-gray-600 border-transparent hover:bg-gray-100',
  success: 'bg-green-600 text-white border-green-600 hover:bg-green-700',
}
const sizes = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
}

export function Button({ children, variant='primary', size='md', className, loading, disabled, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg font-semibold border transition-all duration-150 cursor-pointer',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant], sizes[size], className
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      )}
      {children}
    </button>
  )
}
