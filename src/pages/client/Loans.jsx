import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { PlusCircle, Download, ChevronDown, ChevronUp, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { generateLoanAgreement, downloadAgreement } from '@/lib/generateAgreement'
import { generateRepaymentCard, downloadRepaymentCard } from '@/lib/generateRepaymentCard'

function ScheduleRow({ r, i }) {
  const isPaid    = r.status === 'paid'
  const isOverdue = r.status === 'overdue'
  const isPartial = r.status === 'partial'
  return (
    <div className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${isOverdue ? 'bg-red-50 -mx-3 px-3 rounded-lg' : ''}`}>
      {isPaid    ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0"/> :
       isOverdue ? <AlertTriangle size={14} className="text-red-500 flex-shrink-0"/> :
                   <Clock size={14} className="text-gray-300 flex-shrink-0"/>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">#{i+1} · {formatDate(r.due_date)}</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${isPaid ? 'text-green-600' : isOverdue ? 'text-red-600' : 'text-gray-900'}`}>
              {formatNaira(r.amount_due)}
            </span>
            <Badge color={isPaid?'green':isOverdue?'red':isPartial?'amber':'gray'} className="text-xs">
              {r.status}
            </Badge>
          </div>
        </div>
        {r.amount_paid > 0 && !isPaid && (
          <div className="mt-1 w-full bg-gray-100 rounded-full h-1">
            <div className="bg-amber-400 h-1 rounded-full" style={{ width:`${Math.min(100,Math.round(r.amount_paid/r.amount_due*100))}%` }}/>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ClientLoans() {
  const { profile } = useAuthStore()
  const [expanded, setExpanded]         = useState(null)
  const [downloading, setDownloading]   = useState(null)
  const [downloadingCard, setDownloadingCard] = useState(null)

  const { data: loans, isLoading } = useQuery({
    queryKey: ['client-loans-full', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('loans')
        .select('*, repayment_schedule(*)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      const loans = data || []

      // Auto-generate missing schedules immediately
      for (const loan of loans) {
        if (!loan.repayment_schedule?.length && loan.duration_value > 0 && loan.total_repayment > 0) {
          const dVal  = Number(loan.duration_value)
          const dType = loan.duration_type || 'monthly'
          const perInstalment = Math.round(loan.total_repayment / dVal * 100) / 100
          const startDate = new Date(loan.created_at)
          if (dType === 'daily') startDate.setDate(startDate.getDate() + 3)
          const rows = []
          for (let i = 1; i <= dVal; i++) {
            const d = new Date(startDate)
            if (dType === 'daily')       d.setDate(startDate.getDate() + i)
            else if (dType === 'weekly') d.setDate(startDate.getDate() + i * 7)
            else                         d.setMonth(startDate.getMonth() + i)
            rows.push({ loan_id: loan.id, due_date: d.toISOString().slice(0,10), amount_due: perInstalment, amount_paid: 0, status: 'pending' })
          }
          const { data: inserted } = await supabase.from('repayment_schedule').insert(rows).select()
          loan.repayment_schedule = inserted || []
        }
      }
      // Apply confirmed payments to schedule rows for each loan
      for (const loan of loans) {
        const schedule = loan.repayment_schedule || []
        if (!schedule.length) continue

        const { data: confirmedPayments } = await supabase
          .from('payments')
          .select('amount, actual_amount, confirmed_at')
          .eq('loan_id', loan.id)
          .eq('status', 'confirmed')
          .order('confirmed_at', { ascending: true })

        if (!confirmedPayments?.length) continue

        let pot = confirmedPayments.reduce((s,p) => s + Number(p.actual_amount || p.amount), 0)
        const sorted = [...schedule].sort((a,b) => new Date(a.due_date) - new Date(b.due_date))
        for (const row of sorted) {
          if (pot <= 0) break
          const due = Number(row.amount_due)
          if (pot >= due) {
            row.amount_paid = due
            row.status = 'paid'
            pot -= due
          } else {
            row.amount_paid = Math.round(pot * 100) / 100
            row.status = 'partial'
            pot = 0
          }
        }
        loan.repayment_schedule = sorted
      }

      return loans
    },
    enabled: !!profile?.id,
  })

  const handleDownload = async (loan) => {
    setDownloading(loan.id)
    try {
      const { data: settingsRaw } = await supabase.from('system_settings').select('*')
      const settings = {}
      settingsRaw?.forEach(r => { settings[r.setting_key] = r.setting_value })
      const doc = await generateLoanAgreement({ loan, client: profile, settings, guarantor: null, stampDataUrl: settings.stamp_image_data || null, sigDataUrl: settings.sig_image_data || null })
      downloadAgreement(doc, loan.loan_ref)
    } catch(e) { console.error('PDF error:', e) }
    setDownloading(null)
  }

  const handleDownloadCard = async (loan) => {
    setDownloadingCard(loan.id)
    try {
      const { data: settingsRaw } = await supabase.from('system_settings').select('*')
      const settings = {}
      settingsRaw?.forEach(r => { settings[r.setting_key] = r.setting_value })
      const doc = await generateRepaymentCard({ loan, client: profile, settings, stampDataUrl: settings.stamp_image_data || null, scheduleRows: loan.repayment_schedule || [] })
      downloadRepaymentCard(doc, loan.loan_ref)
    } catch(e) { console.error('Card error:', e) }
    setDownloadingCard(null)
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Loans</h1>
          <p className="text-sm text-gray-500">{loans?.length || 0} applications</p>
        </div>
        <Link to="/client/apply">
          <Button className="gap-2"><PlusCircle size={15}/> Apply</Button>
        </Link>
      </div>

      <div className="space-y-3">
        {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}
        {loans?.map(loan => {
          const schedule = loan.repayment_schedule || []
          const paid     = schedule.filter(r => r.status==='paid').length
          const total    = schedule.length
          const isOpen   = expanded === loan.id
          const perInstalment = loan.total_repayment / Math.max(1, loan.duration_value)

          return (
            <div key={loan.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Loan header */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-xs text-gray-400 mb-1">{loan.loan_ref}</div>
                    <div className="font-bold text-xl text-gray-900">{formatNaira(loan.amount)}</div>
                  </div>
                  <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                </div>

                {/* Key figures */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-0.5">Disbursed</div>
                    <div className="font-bold text-sm text-gray-900">{formatNaira(loan.disbursed_amount)}</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-3">
                    <div className="text-xs text-amber-600 mb-0.5">Outstanding</div>
                    <div className="font-bold text-sm text-amber-700">{formatNaira(loan.outstanding)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-0.5">Total Repay</div>
                    <div className="font-bold text-sm text-gray-900">{formatNaira(loan.total_repayment)}</div>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-0.5">Duration</div>
                    <div className="font-bold text-sm text-gray-900">{loan.duration_value} {loan.duration_type}</div>
                  </div>
                </div>

                {/* Per instalment notice */}
                {loan.status === 'active' || loan.status === 'disbursed' ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs text-blue-700 mb-3">
                    Min. payment per instalment: <strong>{formatNaira(perInstalment)}</strong> · Pay more to reduce next instalment
                  </div>
                ) : null}

                {/* Progress bar if schedule exists */}
                {total > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{paid} of {total} instalments paid</span>
                      <span className="font-semibold text-brand-600">{Math.round(paid/total*100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-brand-500 h-2 rounded-full" style={{ width:`${Math.round(paid/total*100)}%` }}/>
                    </div>
                  </div>
                )}

                {/* Action row */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                  <div className="flex gap-3">
                    <button onClick={() => handleDownload(loan)} disabled={downloading===loan.id}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700 flex items-center gap-1 disabled:opacity-50">
                      <Download size={12}/> {downloading===loan.id ? 'Generating…' : 'Agreement'}
                    </button>
                    <button onClick={() => handleDownloadCard(loan)} disabled={downloadingCard===loan.id}
                      className="text-xs font-medium text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50">
                      <Download size={12}/> {downloadingCard===loan.id ? 'Generating…' : 'Pay Card'}
                    </button>
                  </div>
                  {total > 0 && (
                    <button onClick={() => setExpanded(isOpen ? null : loan.id)}
                      className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700">
                      {isOpen ? <><ChevronUp size={14}/> Hide Schedule</> : <><ChevronDown size={14}/> View Schedule</>}
                    </button>
                  )}

                </div>
              </div>

              {/* Inline schedule */}
              {isOpen && total > 0 && (
                <div className="border-t border-gray-100 px-4 py-3 bg-gray-50 max-h-64 overflow-y-auto">
                  <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment Schedule</div>
                  {schedule
                    .sort((a,b) => new Date(a.due_date) - new Date(b.due_date))
                    .map((r, i) => <ScheduleRow key={r.id} r={r} i={i}/>)
                  }
                </div>
              )}
            </div>
          )
        })}
        {!isLoading && !loans?.length && (
          <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
            No loans yet. <Link to="/client/apply" className="text-brand-600 font-medium">Apply now</Link>
          </div>
        )}
      </div>
    </div>
  )
}
