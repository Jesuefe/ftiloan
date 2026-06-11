import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { formatNaira, formatDate } from '@/lib/utils'

export default function AuditorPayments() {
  const { data: payments, isLoading } = useQuery({
    queryKey: ['auditor-payments'],
    queryFn: async () => {
      const { data } = await supabase.from('payments')
        .select(`*, loans(loan_ref), users!payments_user_id_fkey(first_name,last_name)`)
        .order('created_at', { ascending:false }).limit(100)
      return data || []
    },
  })

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold">All Payments</h1><p className="text-sm text-gray-500">Read-only view</p></div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {['Client','Loan Ref','Amount','Actual','Method','Status','Date'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {payments?.map(p => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.users?.first_name} {p.users?.last_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{p.loans?.loan_ref}</td>
                <td className="px-4 py-3 font-semibold">{formatNaira(p.amount)}</td>
                <td className="px-4 py-3">{p.actual_amount ? formatNaira(p.actual_amount) : '—'}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{p.payment_method?.replace('_',' ')}</td>
                <td className="px-4 py-3"><Badge color={p.status==='confirmed'?'green':p.status==='rejected'?'red':'amber'}>{p.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
