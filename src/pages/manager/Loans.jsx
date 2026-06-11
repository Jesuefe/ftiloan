import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { Search, Eye } from 'lucide-react'

export default function ManagerLoans() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('under_review')

  const { data: loans, isLoading } = useQuery({
    queryKey: ['manager-loans', status, search],
    queryFn: async () => {
      let q = supabase.from('loans')
        .select(`id,loan_ref,amount,status,created_at,users!loans_user_id_fkey(first_name,last_name,phone)`)
        .order('created_at', { ascending: false }).limit(100)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold">Loan Reviews</h1><p className="text-sm text-gray-500">{loans?.length || 0} loans</p></div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {['under_review','manager_review','all'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${status===s?'bg-brand-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {s==='all'?'All':loanStatusLabel(s)}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {loans?.map(loan => (
              <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{loan.users?.first_name} {loan.users?.last_name}</td>
                <td className="px-4 py-3 font-mono text-xs">{loan.loan_ref}</td>
                <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                <td className="px-4 py-3"><Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge></td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(loan.created_at)}</td>
                <td className="px-4 py-3"><Link to={`/manager/loans/${loan.id}`}><Button variant="outline" size="sm"><Eye size={12}/></Button></Link></td>
              </tr>
            ))}
            {!isLoading && !loans?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No loans</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
