import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { Users, FileText, CreditCard, TrendingUp, Clock, CheckCircle, AlertCircle, Banknote, ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [loans, clients, activeLoans, confirmedPayments] = await Promise.all([
        supabase.from('loans').select('id,status,amount,disbursed_amount,created_at'),
        supabase.from('users').select('id', { count: 'exact' }).eq('role', 'client').eq('status', 'active'),
        supabase.from('loans').select('id,outstanding').in('status', ['active','disbursed']),
        supabase.from('payments').select('actual_amount,amount').eq('status','confirmed'),
      ])
      const allLoans = loans.data || []
      const activeAndDisbursed = allLoans.filter(l => ['active','disbursed'].includes(l.status))
      const totalDisbursed   = activeAndDisbursed.reduce((s,l) => s + Number(l.disbursed_amount||0), 0)
      const totalOutstanding = activeLoans.data?.reduce((s,l) => s + Number(l.outstanding), 0) || 0
      const totalReceived    = confirmedPayments.data?.reduce((s,p) => s + Number(p.actual_amount||p.amount||0), 0) || 0
      const statusCounts = {}
      allLoans.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1 })
      return {
        totalLoans: activeAndDisbursed.length,
        totalClients: clients.count || 0,
        totalDisbursed,
        totalOutstanding,
        totalReceived,
        statusCounts,
      }
    },
  })

  const { data: recentLoans } = useQuery({
    queryKey: ['recent-loans'],
    queryFn: async () => {
      const { data } = await supabase.from('loans')
        .select('id,loan_ref,amount,status,created_at,users!loans_user_id_fkey(first_name,last_name)')
        .order('created_at', { ascending: false }).limit(8)
      return data || []
    },
  })

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500">FTI Loan — Admin Overview</p>
      </div>

      {/* Stats 2x2 on mobile, 4 cols desktop */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
        {[
          { label:'Total Clients',   value: stats?.totalClients?.toLocaleString() || '0',   icon: Users,       color:'blue' },
          { label:'Active Loans',    value: stats?.totalLoans?.toLocaleString() || '0',     icon: FileText,    color:'purple' },
          { label:'Total Disbursed', value: formatNaira(stats?.totalDisbursed || 0),         icon: Banknote,    color:'green' },
          { label:'Outstanding',     value: formatNaira(stats?.totalOutstanding || 0),       icon: TrendingUp,  color:'amber' },
          { label:'Total Received',  value: formatNaira(stats?.totalReceived || 0),          icon: CheckCircle, color:'teal' },
          { label:'Net Balance',     value: formatNaira(Math.abs((stats?.totalReceived||0) - (stats?.totalDisbursed||0))), icon: CreditCard, color: (stats?.totalReceived||0) >= (stats?.totalDisbursed||0) ? 'green' : 'red' },
        ].map(({ label, value, icon: Icon, color }) => {
          const cls = { blue:'bg-blue-50 text-blue-600', purple:'bg-purple-50 text-purple-600', green:'bg-green-50 text-green-600', amber:'bg-amber-50 text-amber-600', teal:'bg-teal-50 text-teal-600', red:'bg-red-50 text-red-600' }[color]
          return (
            <div key={label} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${cls}`}><Icon size={16}/></div>
              <div className="text-lg font-bold text-gray-900 leading-tight">{value}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          )
        })}
      </div>

      {/* Status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        {[
          { key:'pending',      label:'Pending',   icon: Clock },
          { key:'active',       label:'Active',    icon: CheckCircle },
          { key:'under_review', label:'In Review', icon: AlertCircle },
          { key:'defaulted',    label:'Defaulted', icon: AlertCircle },
        ].map(({ key, label, icon: Icon }) => (
          <Link key={key} to={`/admin/loans?status=${key}`}
            className="bg-white border border-gray-200 rounded-xl p-3 hover:border-brand-400 transition-colors">
            <div className="text-2xl font-bold text-gray-900">{stats?.statusCounts?.[key] || 0}</div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1"><Icon size={11}/> {label}</div>
          </Link>
        ))}
      </div>

      {/* Recent Loans */}
      <Card>
        <CardHeader>
          <div className="font-bold text-sm">Recent Applications</div>
          <Link to="/admin/loans" className="text-sm text-brand-600 font-medium flex items-center gap-1">View all <ChevronRight size={14}/></Link>
        </CardHeader>

        {/* Mobile cards */}
        <div className="divide-y divide-gray-100 lg:hidden">
          {recentLoans?.map(loan => (
            <Link key={loan.id} to={`/admin/loans/${loan.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
              <div>
                <div className="font-medium text-sm text-gray-900">{loan.users?.first_name} {loan.users?.last_name}</div>
                <div className="font-mono text-xs text-gray-400 mt-0.5">{loan.loan_ref}</div>
                <div className="text-xs text-gray-400">{formatDate(loan.created_at)}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                <div className="text-sm font-semibold text-gray-900">{formatNaira(loan.amount)}</div>
              </div>
            </Link>
          ))}
          {!recentLoans?.length && <div className="px-4 py-8 text-center text-sm text-gray-400">No loans yet</div>}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
            </tr></thead>
            <tbody>
              {recentLoans?.map(loan => (
                <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{loan.users?.first_name} {loan.users?.last_name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{loan.loan_ref}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                  <td className="px-4 py-3"><Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(loan.created_at)}</td>
                </tr>
              ))}
              {!recentLoans?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No loans yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
