import { cn } from '@/lib/utils'
import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

const styles = {
  success: { wrap:'bg-green-50 border-green-200 text-green-800', icon: CheckCircle },
  danger:  { wrap:'bg-red-50 border-red-200 text-red-800',       icon: AlertCircle },
  warning: { wrap:'bg-amber-50 border-amber-200 text-amber-800', icon: AlertTriangle },
  info:    { wrap:'bg-blue-50 border-blue-200 text-blue-800',    icon: Info },
}

export function Alert({ type='info', children, className }) {
  const { wrap, icon: Icon } = styles[type] || styles.info
  return (
    <div className={cn('flex items-start gap-3 p-4 rounded-lg border text-sm', wrap, className)}>
      <Icon size={16} className="mt-0.5 shrink-0"/>
      <div>{children}</div>
    </div>
  )
}
