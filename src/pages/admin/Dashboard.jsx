import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { Users, FileText, CreditCard, TrendingUp, Clock, CheckCircle, AlertCircle, Banknote } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Link } from 'react-router-dom'

function StatCard({ label, value, icon: Icon, color, sub }) {
  const colors = {
    green:  'bg-green-50 text-green-600',
    blue:   'bg-blue-50 text-blue-600',
    amber:  'bg-amber-50 text-amber-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={18}/>
        </div>
      </div>
      <div className="text-2xl font-bold font-display text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  )
}

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [loans, clients, payments, activeLoans] = await Promise.all([
        supabase.from('loans').select('id,status,amount,created_at', { count: 'exact' }),
        supabase.from('users').select('id', { count: 'exact' }).eq('role', 'client').eq('status', 'active'),
        supabase.from('payments').select('amount').eq('status', 'confirmed'),
        supabase.from('loans').select('id,outstanding').in('status', ['active','disbursed']),
      ])
      const totalDisbursed   = payments.data?.reduce((s,p) => s + Number(p.amount), 0) || 0
      const totalOutstanding = activeLoans.data?.reduce((s,l) => s + Number(l.outstanding), 0) || 0
      const statusCounts = {}
      loans.data?.forEach(l => { statusCounts[l.status] = (statusCounts[l.status] || 0) + 1 })
      return {
        totalLoans:      loans.count || 0,
        totalClients:    clients.count || 0,
        totalDisbursed,
        totalOutstanding,
        statusCounts,
        recentLoans:     loans.data?.slice(0,5) || [],
      }
    },
  })

  const { data: recentLoans } = useQuery({
    queryKey: ['recent-loans'],
    queryFn: async () => {
      const { data } = await supabase
        .from('loans')
        .select('id,loan_ref,amount,status,created_at,users!loans_user_id_fkey(first_name,last_name)')
        .order('created_at', { ascending: false })
        .limit(8)
      return data || []
    },
  })

  return (
    <div>
      <div className="page-hdr">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">FTI Loan — Admin Overview</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Clients"    value={stats?.totalClients?.toLocaleString() || '—'} icon={Users}     color="blue"/>
        <StatCard label="Total Loans"      value={stats?.totalLoans?.toLocaleString() || '—'}   icon={FileText}  color="purple"/>
        <StatCard label="Total Disbursed"  value={formatNaira(stats?.totalDisbursed || 0)}       icon={Banknote}  color="green"/>
        <StatCard label="Outstanding"      value={formatNaira(stats?.totalOutstanding || 0)}     icon={TrendingUp} color="amber"/>
      </div>

      {/* Loan status breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { key:'pending',      label:'Pending',    icon:Clock,        color:'amber' },
          { key:'active',       label:'Active',     icon:CheckCircle,  color:'green' },
          { key:'under_review', label:'In Review',  icon:AlertCircle,  color:'blue'  },
          { key:'defaulted',    label:'Defaulted',  icon:AlertCircle,  color:'red'   },
        ].map(({ key, label, icon: Icon, color }) => (
          <Link key={key} to={`/admin/loans?status=${key}`}
            className="bg-white border border-gray-200 rounded-xl p-4 hover:border-brand-400 transition-colors">
            <div className="text-2xl font-bold font-display text-gray-900">
              {stats?.statusCounts?.[key] || 0}
            </div>
            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
              <Icon size={12}/> {label}
            </div>
          </Link>
        ))}
      </div>

      {/* Recent Loans */}
      <Card>
        <CardHeader>
          <div>
            <div className="font-bold text-gray-900">Recent Loan Applications</div>
            <div className="text-xs text-gray-500 mt-0.5">Latest submissions</div>
          </div>
          <Link to="/admin/loans" className="text-sm text-brand-600 hover:text-brand-700 font-medium">View all</Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentLoans?.map(loan => (
                <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">
                    {loan.users?.first_name} {loan.users?.last_name}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{loan.loan_ref}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(loan.created_at)}</td>
                </tr>
              ))}
              {!recentLoans?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No loans yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
