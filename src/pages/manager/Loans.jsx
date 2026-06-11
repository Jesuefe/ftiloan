import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { Search, Eye, RefreshCw } from 'lucide-react'

export default function ManagerLoans() {
  const [search, setSearch] = useState('')
  const [tab, setTab]       = useState('pending')

  const { data: loans, isLoading, refetch } = useQuery({
    queryKey: ['manager-loans', tab, search],
    queryFn: async () => {
      let q = supabase.from('loans')
        .select(`id,loan_ref,amount,status,duration_type,duration_value,created_at,
          users!loans_user_id_fkey(first_name,last_name,phone),
          agents(id,users!agents_user_id_fkey(first_name,last_name))`)
        .order('created_at', { ascending: true })
        .limit(100)

      // Match PHP: pending tab = under_review + manager_review (queue)
      if (tab === 'pending') {
        q = q.in('status', ['under_review','manager_review'])
      } else if (tab === 'passed') {
        q = q.in('status', ['agent_approved','admin_approved','active','completed'])
      } else if (tab === 'rejected') {
        q = q.eq('status', 'manager_rejected')
      }

      if (search.trim()) {
        q = q.or(`loan_ref.ilike.%${search}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  // Count for badge
  const { data: pendingCount } = useQuery({
    queryKey: ['manager-pending-count'],
    queryFn: async () => {
      const { count } = await supabase.from('loans')
        .select('id', { count:'exact', head:true })
        .in('status', ['under_review','manager_review'])
      return count || 0
    },
    refetchInterval: 30000,
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Loan Review Queue</h1>
          <p className="text-sm text-gray-500">Applications awaiting risk assessment</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
          <RefreshCw size={14}/> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {[
          ['pending', 'Pending Review', pendingCount],
          ['passed',  'Passed to Admin', null],
          ['rejected','Rejected', null],
        ].map(([t,l,count]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all
              ${tab===t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
            {count > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={15} className="text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search loan ref…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {['Reference','Client','Amount','Type','Agent','Status','Date',''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {loans?.map(loan => (
                <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-brand-600">{loan.loan_ref}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{loan.users?.first_name} {loan.users?.last_name}</div>
                    <div className="text-xs text-gray-400">{loan.users?.phone}</div>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${loan.loan_type==='asset'?'bg-purple-100 text-purple-700':'bg-blue-100 text-blue-700'}`}>
                      {loan.loan_type === 'asset' ? 'Asset' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {loan.agents?.users?.first_name} {loan.agents?.users?.last_name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(loan.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/manager/loans/${loan.id}`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye size={12}/> Review
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && !loans?.length && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No loans in this category
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
