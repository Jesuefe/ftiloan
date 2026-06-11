import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { PlusCircle } from 'lucide-react'

export default function ClientLoans() {
  const { profile } = useAuthStore()

  const { data: loans, isLoading } = useQuery({
    queryKey: ['client-loans-full', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('loans').select('*').eq('user_id', profile.id).order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!profile?.id,
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Loans</h1>
          <p className="text-sm text-gray-500">{loans?.length || 0} applications</p>
        </div>
        <Link to="/client/apply">
          <Button className="gap-2"><PlusCircle size={15}/> Apply</Button>
        </Link>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}
        {loans?.map(loan => (
          <div key={loan.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-mono text-xs text-gray-500 mb-1">{loan.loan_ref}</div>
                <div className="font-bold text-lg">{formatNaira(loan.amount)}</div>
              </div>
              <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div><div className="text-xs text-gray-400">Disbursed</div><div className="font-medium">{formatNaira(loan.disbursed_amount)}</div></div>
              <div><div className="text-xs text-gray-400">Outstanding</div><div className="font-medium text-amber-600">{formatNaira(loan.outstanding)}</div></div>
              <div><div className="text-xs text-gray-400">Total Repay</div><div className="font-medium">{formatNaira(loan.total_repayment)}</div></div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
              <span>Applied {formatDate(loan.created_at)}</span>
              <span className="capitalize">{loan.duration_value} {loan.duration_type} instalments</span>
            </div>
          </div>
        ))}
        {!isLoading && !loans?.length && (
          <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No loans yet. <Link to="/client/apply" className="text-brand-600 font-medium">Apply now</Link>
          </div>
        )}
      </div>
    </div>
  )
}
