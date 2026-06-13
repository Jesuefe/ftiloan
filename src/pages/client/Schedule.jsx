import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNaira, formatDate } from '@/lib/utils'
import { CalendarDays, CheckCircle2, Clock, AlertTriangle } from 'lucide-react'

export default function ClientSchedule() {
  const { profile } = useAuthStore()

  const { data, isLoading, error } = useQuery({
    queryKey: ['client-schedule', profile?.id],
    queryFn: async () => {
      // Step 1: get ALL loans for this client (any status)
      const { data: loans, error: loanErr } = await supabase
        .from('loans')
        .select('id,loan_ref,total_repayment,duration_value,duration_type,status,created_at,amount')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })

      if (loanErr) throw loanErr
      if (!loans?.length) return { loans: [], schedule: [] }

      const ids = loans.map(l => l.id)

      // Step 2: get existing schedule rows
      const { data: existing, error: schErr } = await supabase
        .from('repayment_schedule')
        .select('*, loans(loan_ref)')
        .in('loan_id', ids)
        .order('due_date', { ascending: true })

      if (schErr) throw schErr

      // Step 3: for any loan missing schedule rows, auto-generate and insert them
      const coveredLoanIds = new Set((existing || []).map(r => r.loan_id))
      const loansNeedingSchedule = loans.filter(l =>
        !coveredLoanIds.has(l.id) &&
        l.duration_value > 0 &&
        l.total_repayment > 0
      )

      let newRows = []
      for (const loan of loansNeedingSchedule) {
        const dVal  = Number(loan.duration_value)
        const dType = loan.duration_type || "monthly"
        const perInstalment = Math.round(loan.total_repayment / dVal * 100) / 100
        const startDate = new Date(loan.created_at || new Date())
        if (dType === "daily") startDate.setDate(startDate.getDate() + 3)
        const rows = []
        for (let i = 1; i <= dVal; i++) {
          const d = new Date(startDate)
          if (dType === "daily")        d.setDate(startDate.getDate() + i)
          else if (dType === "weekly")  d.setDate(startDate.getDate() + i * 7)
          else                          d.setMonth(startDate.getMonth() + i)
          rows.push({
            loan_id:    loan.id,
            due_date:   d.toISOString().slice(0,10),
            amount_due: perInstalment,
            amount_paid: 0,
            status:     "pending",
          })
        }
        if (rows.length) {
          const { data: inserted } = await supabase
            .from("repayment_schedule")
            .insert(rows)
            .select("*, loans(loan_ref)")
          if (inserted) newRows = [...newRows, ...inserted]
        }
      }

      const allSchedule = [...(existing || []), ...newRows]
        .sort((a,b) => new Date(a.due_date) - new Date(b.due_date))

      // Step 4: get all confirmed payments for these loans and apply to schedule
      const { data: confirmedPayments } = await supabase
        .from('payments')
        .select('id,loan_id,amount,actual_amount,confirmed_at')
        .in('loan_id', ids)
        .eq('status', 'confirmed')
        .order('confirmed_at', { ascending: true })

      if (confirmedPayments?.length) {
        // Distribute payments across instalments in order (earliest first)
        // Build a mutable copy with running totals
        let remaining = confirmedPayments.map(p => Number(p.actual_amount || p.amount))
        let totalPaidPerLoan = {}
        confirmedPayments.forEach(p => {
          totalPaidPerLoan[p.loan_id] = (totalPaidPerLoan[p.loan_id] || 0) + Number(p.actual_amount || p.amount)
        })

        // For each loan, distribute total paid across instalments in order
        const updatedRows = [...allSchedule]
        for (const loanId of ids) {
          let pot = totalPaidPerLoan[loanId] || 0
          if (pot === 0) continue
          const loanRows = updatedRows.filter(r => r.loan_id === loanId)
          for (const row of loanRows) {
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
        }

        return { loans, schedule: updatedRows }
      }

      return { loans, schedule: allSchedule }
    },
    enabled: !!profile?.id,
  })

  const loans    = data?.loans || []
  const schedule = data?.schedule || []

  const paid    = schedule.filter(r => r.status === 'paid').length
  const overdue = schedule.filter(r => r.status === 'overdue').length
  const pending = schedule.filter(r => ['pending','partial'].includes(r.status)).length
  const total   = schedule.length

  const statusIcon = (s) => {
    if (s === 'paid')    return <CheckCircle2 size={16} className="text-green-500 flex-shrink-0"/>
    if (s === 'overdue') return <AlertTriangle size={16} className="text-red-500 flex-shrink-0"/>
    if (s === 'partial') return <Clock size={16} className="text-amber-500 flex-shrink-0"/>
    return <Clock size={16} className="text-gray-300 flex-shrink-0"/>
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-gray-400">Loading schedule…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
        Error loading schedule: {error.message}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <CalendarDays size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Repayment Schedule</h1>
          <p className="text-sm text-gray-500">
            {loans.length} loan{loans.length !== 1 ? 's' : ''} · {total} instalments
          </p>
        </div>
      </div>

      {/* No loans at all */}
      {loans.length === 0 && (
        <div className="py-16 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
          <CalendarDays size={32} className="mx-auto mb-3 text-gray-300"/>
          <div className="font-medium">No loans yet</div>
          <div className="text-sm mt-1">Apply for a loan to see your repayment schedule here</div>
        </div>
      )}



      {/* Has schedule rows — full view */}
      {total > 0 && (
        <>
          {/* Progress bar */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 font-medium">{paid} of {total} paid</span>
              <span className="text-brand-600 font-bold">{Math.round(paid/total*100)}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-brand-500 h-2 rounded-full transition-all" style={{ width: `${Math.round(paid/total*100)}%` }}/>
            </div>
            <div className="flex gap-4 mt-3 text-xs">
              <span className="text-green-600 font-medium">{paid} Paid</span>
              <span className="text-gray-400">· {pending} Pending</span>
              {overdue > 0 && <span className="text-red-600 font-medium">{overdue} Overdue</span>}
            </div>
          </div>

          {/* Info banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3 mb-4 text-xs text-blue-700">
            <strong>How payments work:</strong> Each instalment has a fixed minimum. You can pay more — any extra reduces your next instalment automatically.
          </div>

          {/* Mobile card list */}
          <Card>
            <CardHeader>
              <div className="font-bold text-sm">Payment Breakdown</div>
            </CardHeader>
            <div className="divide-y divide-gray-100 lg:hidden">
              {schedule.map((r, i) => (
                <div key={r.id} className={`px-4 py-3 ${r.status === 'overdue' ? 'bg-red-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    {statusIcon(r.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-500">
                          #{i + 1} · {r.loans?.loan_ref}
                        </span>
                        <Badge color={r.status==='paid'?'green':r.status==='overdue'?'red':r.status==='partial'?'amber':'gray'}>
                          {r.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-gray-900">{formatNaira(r.amount_due)}</div>
                          <div className="text-xs text-gray-400 mt-0.5">Due {formatDate(r.due_date)}</div>
                        </div>
                        <div className="text-right">
                          {r.amount_paid > 0 && (
                            <div className="text-xs text-green-600 font-medium">Paid {formatNaira(r.amount_paid)}</div>
                          )}
                          {r.status === 'partial' && (
                            <div className="text-xs text-amber-600">Balance: {formatNaira(r.amount_due - r.amount_paid)}</div>
                          )}
                        </div>
                      </div>
                      {r.amount_paid > 0 && r.status !== 'paid' && (
                        <div className="mt-2 w-full bg-gray-100 rounded-full h-1">
                          <div className="bg-amber-400 h-1 rounded-full"
                            style={{ width: `${Math.min(100, Math.round(r.amount_paid/r.amount_due*100))}%` }}/>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Loan</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount Due</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-100 ${r.status==='overdue'?'bg-red-50':''}`}>
                      <td className="px-4 py-3 text-gray-500">{i+1}</td>
                      <td className="px-4 py-3 font-mono text-xs">{r.loans?.loan_ref}</td>
                      <td className="px-4 py-3">{formatDate(r.due_date)}</td>
                      <td className="px-4 py-3 font-semibold">{formatNaira(r.amount_due)}</td>
                      <td className="px-4 py-3">{formatNaira(r.amount_paid)}</td>
                      <td className="px-4 py-3">
                        <Badge color={r.status==='paid'?'green':r.status==='overdue'?'red':r.status==='partial'?'amber':'gray'}>
                          {r.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
