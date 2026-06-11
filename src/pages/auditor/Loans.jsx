import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'

export default function AuditorLoans() {
  const { data: loans, isLoading } = useQuery({
    queryKey: ['auditor-loans'],
    queryFn: async () => {
      const { data } = await supabase.from('loans')
        .select(`id,loan_ref,amount,status,created_at,outstanding,amount_paid,users!loans_user_id_fkey(first_name,last_name)`)
        .order('created_at', { ascending: false }).limit(100)
      return data || []
    },
  })

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold">All Loans</h1><p className="text-sm text-gray-500">Read-only view</p></div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {['Client','Reference','Amount','Outstanding','Paid','Status','Date'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {loans?.map(l => (
              <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{l.users?.first_name} {l.users?.last_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{l.loan_ref}</td>
                <td className="px-4 py-3 font-semibold">{formatNaira(l.amount)}</td>
                <td className="px-4 py-3 text-amber-600 font-semibold">{formatNaira(l.outstanding)}</td>
                <td className="px-4 py-3 text-green-600">{formatNaira(l.amount_paid)}</td>
                <td className="px-4 py-3"><Badge color={loanStatusColor(l.status)}>{loanStatusLabel(l.status)}</Badge></td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(l.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
