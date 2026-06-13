import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import {
  ChevronRight, FileText, CreditCard, ArrowRight,
  AlertTriangle, TrendingDown, MessageCircle, User,
  BarChart2, CheckCircle, Clock, Wallet
} from 'lucide-react'

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
      const activeIds = loans?.filter(l => ['active','disbursed'].includes(l.status)).map(l => l.id) || []
      if (!activeIds.length) return null
      const { data } = await supabase.from('repayment_schedule')
        .select('*, loans(loan_ref)')
        .in('loan_id', activeIds)
        .in('status', ['pending','overdue','partial'])
        .order('due_date', { ascending: true })
        .limit(1).maybeSingle()
      return data
    },
    enabled: !!loans?.length,
  })

  const activeLoans      = loans?.filter(l => ['active','disbursed'].includes(l.status)) || []
  const totalOutstanding = activeLoans.reduce((s,l) => s + Number(l.outstanding), 0)
  const primaryLoan      = activeLoans[0] || null
  const perInstalment    = primaryLoan ? primaryLoan.total_repayment / Math.max(1, primaryLoan.duration_value) : 0
  const isOverdue        = nextDue?.status === 'overdue'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-b-3xl mb-5"
        style={{ background: 'linear-gradient(135deg, #1B2A6B 0%, #243580 60%, #1B5E45 100%)' }}>
        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-10" style={{ background:'#00D48F' }}/>
        <div className="absolute top-12 -right-4 w-24 h-24 rounded-full opacity-10" style={{ background:'#00D48F' }}/>

        <div className="px-5 pt-5 pb-8 relative z-10">
          <div className="flex items-center justify-between mb-6">
            <div>
              <p className="text-white/60 text-sm">Welcome back,</p>
              <h1 className="text-white text-2xl font-bold mt-0.5">{profile?.first_name} {profile?.last_name}</h1>
            </div>
            {profile?.kyc_verified
              ? <div className="bg-white/10 border border-white/20 text-white text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <CheckCircle size={11} className="text-[#00D48F]"/> Verified
                </div>
              : <Link to="/client/profile" className="bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <AlertTriangle size={11}/> Verify ID
                </Link>
            }
          </div>

          {/* Balance glass card */}
          <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4">
            <p className="text-white/60 text-xs mb-1">Total Outstanding</p>
            <p className="text-white text-3xl font-bold mb-3">{formatNaira(totalOutstanding)}</p>
            {nextDue ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-xs">Next Due Date</p>
                  <p className="text-white font-semibold text-sm">{formatDate(nextDue.due_date)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white/60 text-xs">Instalment</p>
                  <p className="font-bold text-sm" style={{ color:'#00D48F' }}>{formatNaira(nextDue.amount_due)}</p>
                </div>
                <div className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                  isOverdue
                    ? 'bg-red-500/20 text-red-300 border border-red-400/30'
                    : 'bg-[#00D48F]/20 text-[#00D48F] border border-[#00D48F]/30'
                }`}>
                  {isOverdue ? <AlertTriangle size={10}/> : <CheckCircle size={10}/>}
                  {isOverdue ? 'Overdue' : 'On Track'}
                </div>
              </div>
            ) : (
              <p className="text-white/50 text-sm flex items-center gap-1.5">
                <Clock size={13}/> No active loans
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4">

        {/* Quick actions */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label:'My Loans',  sub:'Track active loans', to:'/client/loans',   Icon:FileText,    bg:'rgba(0,212,143,0.10)',    ic:'#009864' },
            { label:'Apply Now', sub:'Apply for a new loan',to:'/client/apply',   Icon:CreditCard,  bg:'rgba(27,42,107,0.08)',    ic:'#1B2A6B' },
          ].map(({ label, sub, to, Icon, bg, ic }) => (
            <Link key={to} to={to}
              className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3" style={{ background:bg }}>
                <Icon size={18} style={{ color:ic }}/>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{label}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
                </div>
                <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background:bg }}>
                  <ArrowRight size={14} style={{ color:ic }}/>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Overdue alert */}
        {isOverdue && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex items-center gap-3">
            <AlertTriangle size={18} className="text-red-500 flex-shrink-0"/>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-red-700 text-sm">Payment Overdue</div>
              <div className="text-xs text-red-600 mt-0.5 truncate">{nextDue.loans?.loan_ref} — due {formatDate(nextDue.due_date)}</div>
            </div>
            <Link to="/client/payments" className="text-xs font-bold text-red-600 flex items-center gap-0.5 whitespace-nowrap">
              Pay Now <ArrowRight size={12}/>
            </Link>
          </div>
        )}

        {/* Loan overview card */}
        {primaryLoan && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background:'rgba(0,212,143,0.10)' }}>
                  <BarChart2 size={15} style={{ color:'#009864' }}/>
                </div>
                <span className="font-bold text-gray-900 text-sm">Your Loan Overview</span>
              </div>
              <Link to="/client/loans" className="flex items-center gap-0.5 text-xs font-semibold" style={{ color:'#009864' }}>
                View details <ChevronRight size={13}/>
              </Link>
            </div>

            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Outstanding Amount</p>
                <p className="text-2xl font-bold text-gray-900">{formatNaira(primaryLoan.outstanding)}</p>
              </div>
              <Badge color={loanStatusColor(primaryLoan.status)}>{loanStatusLabel(primaryLoan.status)}</Badge>
            </div>

            <div className="h-px bg-gray-100 mb-3"/>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Next Due Date</p>
                <p className="text-sm font-semibold text-gray-900">{nextDue ? formatDate(nextDue.due_date) : '—'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 mb-0.5">Instalment Amount</p>
                <p className="text-sm font-bold" style={{ color:'#1B2A6B' }}>{formatNaira(perInstalment)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Quick services */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {[
            { label:'Loans',    to:'/client/loans',    Icon:FileText,       bg:'rgba(0,212,143,0.10)', ic:'#009864' },
            { label:'Payments', to:'/client/payments', Icon:Wallet,         bg:'rgba(27,42,107,0.08)', ic:'#1B2A6B' },
            { label:'Chat',     to:'/client/chat',     Icon:MessageCircle,  bg:'rgba(79,70,229,0.08)', ic:'#4F46E5' },
            { label:'Profile',  to:'/client/profile',  Icon:User,           bg:'rgba(245,158,11,0.10)',ic:'#D97706' },
          ].map(({ label, to, Icon, bg, ic }) => (
            <Link key={to} to={to}
              className="bg-white rounded-2xl border border-gray-100 p-3 flex flex-col items-center gap-1.5 shadow-sm hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:bg }}>
                <Icon size={17} style={{ color:ic }}/>
              </div>
              <span className="text-xs text-gray-600 font-medium text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>

        {/* Recent loans */}
        {loans && loans.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <span className="font-bold text-sm text-gray-900">Recent Applications</span>
              <Link to="/client/loans" className="flex items-center gap-0.5 text-xs font-semibold" style={{ color:'#009864' }}>
                View all <ChevronRight size={13}/>
              </Link>
            </div>
            <div className="divide-y divide-gray-50">
              {loans.slice(0,3).map(loan => (
                <div key={loan.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <div className="font-semibold text-sm text-gray-900">{formatNaira(loan.amount)}</div>
                    <div className="font-mono text-xs text-gray-400 mt-0.5">{loan.loan_ref}</div>
                    <div className="text-xs text-gray-400">{formatDate(loan.created_at)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                    {Number(loan.outstanding) > 0 && (
                      <div className="text-xs font-medium text-amber-600">{formatNaira(loan.outstanding)} left</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No loans CTA */}
        {loans && loans.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center mb-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background:'rgba(0,212,143,0.10)' }}>
              <TrendingDown size={24} style={{ color:'#009864' }}/>
            </div>
            <div className="font-bold text-gray-900 mb-1">No loans yet</div>
            <p className="text-sm text-gray-400 mb-4">Apply for your first loan today with quick approval.</p>
            <Link to="/client/apply"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold"
              style={{ background:'linear-gradient(135deg, #1B2A6B, #009864)' }}>
              Apply for a Loan <ArrowRight size={15}/>
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
