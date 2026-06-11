import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { FileText, CreditCard, CalendarDays, PlusCircle, TrendingDown } from 'lucide-react'

export default function ClientDashboard() {
  const { profile } = useAuthStore()

  const { data: loans } = useQuery({
    queryKey: ['client-loans', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('loans')
        .select('*').eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!profile?.id,
  })

  const { data: nextDue } = useQuery({
    queryKey: ['client-next-due', profile?.id],
    queryFn: async () => {
      const activeLoans = loans?.filter(l => ['active','disbursed'].includes(l.status)).map(l => l.id) || []
      if (!activeLoans.length) return null
      const { data } = await supabase.from('repayment_schedule')
        .select('*, loans(loan_ref)')
        .in('loan_id', activeLoans)
        .in('status', ['pending','overdue','partial'])
        .order('due_date', { ascending: true })
        .limit(1)
        .single()
      return data
    },
    enabled: !!loans?.length,
  })

  const activeLoans     = loans?.filter(l => ['active','disbursed'].includes(l.status)) || []
  const totalOutstanding = activeLoans.reduce((s,l) => s + Number(l.outstanding), 0)
  const pendingLoans    = loans?.filter(l => ['pending','under_review','manager_review','agent_approved','admin_approved'].includes(l.status)) || []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Welcome, {profile?.first_name}</h1>
        <p className="text-sm text-gray-500">Here's your loan overview</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3"><FileText size={16} className="text-blue-600"/></div>
          <div className="text-2xl font-bold">{loans?.length || 0}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Loans</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center mb-3"><CreditCard size={16} className="text-green-600"/></div>
          <div className="text-2xl font-bold">{activeLoans.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Active Loans</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center mb-3"><TrendingDown size={16} className="text-amber-600"/></div>
          <div className="text-2xl font-bold text-amber-600">{formatNaira(totalOutstanding)}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Outstanding</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3"><CalendarDays size={16} className="text-purple-600"/></div>
          <div className="text-2xl font-bold">{pendingLoans.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Pending Review</div>
        </div>
      </div>

      {/* Next payment due */}
      {nextDue && (
        <div className={`rounded-xl p-4 mb-6 border ${
          nextDue.status === 'overdue'
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <div className={`font-bold text-sm ${nextDue.status === 'overdue' ? 'text-red-700' : 'text-amber-700'}`}>
                {nextDue.status === 'overdue' ? '⚠ Payment Overdue' : '📅 Next Payment Due'}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">{nextDue.loans?.loan_ref} — Due {formatDate(nextDue.due_date)}</div>
            </div>
            <div className="font-bold text-lg">{formatNaira(nextDue.amount_due)}</div>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <Link to="/client/apply">
          <Button className="gap-2"><PlusCircle size={15}/> Apply for Loan</Button>
        </Link>
        <Link to="/client/schedule">
          <Button variant="outline" className="gap-2"><CalendarDays size={15}/> View Schedule</Button>
        </Link>
      </div>

      {/* Loans list */}
      <Card>
        <CardHeader>
          <div className="font-bold">My Loans</div>
          <Link to="/client/loans" className="text-sm text-brand-600">View all</Link>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Outstanding</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {loans?.slice(0,5).map(loan => (
                <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{loan.loan_ref}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                  <td className="px-4 py-3 font-semibold text-amber-600">{formatNaira(loan.outstanding)}</td>
                  <td className="px-4 py-3"><Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(loan.created_at)}</td>
                </tr>
              ))}
              {!loans?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No loans yet. <Link to="/client/apply" className="text-brand-600">Apply now</Link></td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
