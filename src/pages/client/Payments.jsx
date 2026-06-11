import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils'
import { CreditCard } from 'lucide-react'

export default function ClientPayments() {
  const { profile } = useAuthStore()

  const { data: payments, isLoading } = useQuery({
    queryKey: ['client-payments', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('payments')
        .select(`*, loans(loan_ref)`)
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!profile?.id,
  })

  const totalPaid = payments?.filter(p => p.status === 'confirmed').reduce((s,p) => s + Number(p.actual_amount || p.amount), 0) || 0
  const pending   = payments?.filter(p => p.status === 'pending').length || 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CreditCard size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Payments</h1>
          <p className="text-sm text-gray-500">{payments?.length || 0} payment records</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-xl font-bold text-green-600">{formatNaira(totalPaid)}</div>
          <div className="text-xs text-gray-500 mt-1">Total Paid</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-xl font-bold text-amber-600">{pending}</div>
          <div className="text-xs text-gray-500 mt-1">Pending</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-xl font-bold text-gray-900">{payments?.length || 0}</div>
          <div className="text-xs text-gray-500 mt-1">Total Records</div>
        </div>
      </div>

      {/* Payment list */}
      <div className="space-y-3">
        {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}
        {payments?.map(p => (
          <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-lg text-gray-900">{formatNaira(p.amount)}</div>
                {p.actual_amount && Number(p.actual_amount) !== Number(p.amount) && (
                  <div className="text-xs text-gray-500">Actual received: {formatNaira(p.actual_amount)}</div>
                )}
              </div>
              <Badge color={p.status==='confirmed'?'green':p.status==='rejected'?'red':'amber'}>
                {p.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Loan: <span className="font-mono text-brand-600">{p.loans?.loan_ref}</span></span>
              <span className="capitalize">{p.payment_method?.replace('_',' ')}</span>
              <span>{formatDate(p.payment_date)}</span>
            </div>
            {p.status === 'confirmed' && p.confirmed_at && (
              <div className="mt-2 text-xs text-green-600">✓ Confirmed {formatDateTime(p.confirmed_at)}</div>
            )}
            {p.notes && (
              <div className="mt-2 text-xs text-gray-400">{p.notes}</div>
            )}
          </div>
        ))}
        {!isLoading && !payments?.length && (
          <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No payment records yet.
          </div>
        )}
      </div>
    </div>
  )
}
