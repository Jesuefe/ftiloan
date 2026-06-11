import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { Search, Filter, Eye, RefreshCw } from 'lucide-react'

const STATUSES = ['all','pending','under_review','manager_review','agent_approved','admin_approved','disbursed','active','completed','rejected','defaulted']

export default function AdminLoans() {
  const [search, setSearch] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || 'all'

  const { data: loans, isLoading, refetch } = useQuery({
    queryKey: ['admin-loans', status, search],
    queryFn: async () => {
      let q = supabase
        .from('loans')
        .select(`id,loan_ref,loan_type,amount,status,created_at,disbursed_at,
          users!loans_user_id_fkey(first_name,last_name,phone)`)
        .order('created_at', { ascending: false })
        .limit(100)
      if (status !== 'all') q = q.eq('status', status)
      if (search.trim()) q = q.or(`loan_ref.ilike.%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Loan Applications</h1>
          <p className="text-sm text-gray-500 mt-0.5">{loans?.length || 0} total</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="gap-2">
          <RefreshCw size={14}/> Refresh
        </Button>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-4">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setSearchParams(s === 'all' ? {} : { status: s })}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all
              ${status === s ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {s === 'all' ? 'All' : loanStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={15} className="text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by reference…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              )}
              {!isLoading && loans?.map(loan => (
                <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    <div>{loan.users?.first_name} {loan.users?.last_name}</div>
                    <div className="text-xs text-gray-400">{loan.users?.phone}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{loan.loan_ref}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${loan.loan_type === 'asset' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                      {loan.loan_type === 'asset' ? 'Asset' : 'Cash'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(loan.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/loans/${loan.id}`}>
                      <Button variant="outline" size="sm" className="gap-1">
                        <Eye size={12}/> View
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && !loans?.length && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No loans found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
