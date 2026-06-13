import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { Users, FileText, CreditCard, UserPlus, CheckSquare, ChevronRight } from 'lucide-react'

export default function AgentDashboard() {
  const { profile } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['agent-stats', profile?.id],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id,zone_id').eq('user_id', profile.id).single()
      if (!agent) return { clients:0, loans:0, pendingPayments:0, recentLoans:[] }

      const [loans, payments, zoneClients] = await Promise.all([
        supabase.from('loans').select('id,loan_ref,amount,status,created_at,user_id,users!loans_user_id_fkey(first_name,last_name)').eq('agent_id', agent.id).order('created_at', { ascending:false }).limit(6),
        supabase.from('payments').select('id',{count:'exact'}).eq('agent_id', agent.id).eq('status','pending'),
        agent.zone_id
          ? supabase.from('users').select('id',{count:'exact'}).eq('role','client').eq('zone_id', agent.zone_id)
          : supabase.from('users').select('id',{count:'exact'}).eq('role','client'),
      ])

      const loanClientIds = new Set(loans.data?.map(l => l.user_id)||[])
      const totalClients  = Math.max(loanClientIds.size, zoneClients.count || 0)

      return {
        clients: totalClients,
        loans: loans.data?.length || 0,
        pendingPayments: payments.count || 0,
        recentLoans: loans.data || [],
      }
    },
    enabled: !!profile?.id,
  })

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Welcome, {profile?.first_name} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">Agent Dashboard</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label:'My Clients',       value: stats?.clients||0,         icon:Users,      to:'/agent/clients' },
          { label:'Total Loans',      value: stats?.loans||0,           icon:FileText,   to:'/agent/clients' },
          { label:'Pending Payments', value: stats?.pendingPayments||0, icon:CreditCard, to:'/agent/confirm-payments' },
        ].map(({ label,value,icon:Icon,to }) => (
          <Link key={label} to={to} className="bg-white rounded-2xl border border-gray-200 p-3 lg:p-5 hover:border-brand-400 transition-colors">
            <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl flex items-center justify-center mb-2 lg:mb-3 bg-gray-100">
              <Icon size={15} className="text-gray-600"/>
            </div>
            <div className="text-xl lg:text-2xl font-bold font-display">{value}</div>
            <div className="text-xs text-gray-500 mt-0.5 leading-tight">{label}</div>
          </Link>
        ))}
      </div>

      {/* Quick actions — desktop only (mobile uses bottom nav) */}
      <div className="hidden lg:flex gap-3 mb-5">
        <Link to="/agent/create-client"><Button className="gap-2"><UserPlus size={15}/> New Client</Button></Link>
        <Link to="/agent/confirm-payments"><Button variant="outline" className="gap-2"><CheckSquare size={15}/> Confirm Payments</Button></Link>
      </div>

      {/* Recent loans */}
      <Card>
        <CardHeader>
          <div className="font-bold text-sm">Recent Loans</div>
          <Link to="/agent/clients" className="text-sm text-brand-600 font-medium flex items-center gap-1">
            View all <ChevronRight size={14}/>
          </Link>
        </CardHeader>

        {/* Mobile card list */}
        <div className="divide-y divide-gray-100 lg:hidden">
          {stats?.recentLoans?.map(loan => (
            <div key={loan.id} className="px-4 py-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900">
                  {loan.users?.first_name} {loan.users?.last_name}
                </div>
                <div className="font-mono text-xs text-gray-400 mt-0.5">{loan.loan_ref}</div>
                <div className="text-xs text-gray-400 mt-0.5">{formatDate(loan.created_at)}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                <div className="text-sm font-semibold text-gray-900">{formatNaira(loan.amount)}</div>
              </div>
            </div>
          ))}
          {!stats?.recentLoans?.length && (
            <div className="px-4 py-8 text-center text-sm text-gray-400">No loans yet</div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
            </tr></thead>
            <tbody>
              {stats?.recentLoans?.map(loan => (
                <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{loan.users?.first_name} {loan.users?.last_name}</td>
                  <td className="px-4 py-3 font-mono text-xs">{loan.loan_ref}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                  <td className="px-4 py-3"><Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge></td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(loan.created_at)}</td>
                </tr>
              ))}
              {!stats?.recentLoans?.length && (
                <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No loans yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
