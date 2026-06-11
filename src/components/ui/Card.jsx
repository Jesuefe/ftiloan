import { cn } from '@/lib/utils'
export function Card({ children, className, ...props }) {
  return <div className={cn('bg-white rounded-xl border border-gray-200 shadow-sm', className)} {...props}>{children}</div>
}
export function CardHeader({ children, className, ...props }) {
  return <div className={cn('px-5 py-4 border-b border-gray-100 flex items-center justify-between', className)} {...props}>{children}</div>
}
export function CardBody({ children, className, ...props }) {
  return <div className={cn('p-5', className)} {...props}>{children}</div>
}
