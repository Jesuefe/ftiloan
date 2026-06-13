import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Select } from '@/components/ui/Select'
import { formatNaira, formatDate, formatDateTime, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import {
  ArrowLeft, Plus, RotateCcw, ChevronDown, ChevronUp,
  CheckCircle2, Clock, AlertTriangle, CreditCard, User
} from 'lucide-react'

export default function AgentClientDetail() {
  const { clientId } = useParams()
  const { profile }  = useAuthStore()
  const qc           = useQueryClient()
  const [flash, setFlash]         = useState(null)
  const [expandedLoan, setExpanded] = useState(null)
  const [payModal, setPayModal]   = useState(null) // loan object
  const [revertModal, setRevertModal] = useState(null) // payment object
  const [payForm, setPayForm]     = useState({ amount: '', payment_method: 'bank_transfer', payment_date: new Date().toISOString().slice(0,10), note: '' })
  const setP = (k,v) => setPayForm(f => ({...f,[k]:v}))

  // Client info
  const { data: client } = useQuery({
    queryKey: ['agent-client', clientId],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('*').eq('id', clientId).single()
      return data
    },
    enabled: !!clientId,
  })

  // Agent record
  const { data: agent } = useQuery({
    queryKey: ['agent-record', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      return data
    },
    enabled: !!profile?.id,
  })

  // Loans + schedule + payments
  const { data: loans, isLoading } = useQuery({
    queryKey: ['agent-client-loans', clientId],
    queryFn: async () => {
      const { data: loansData } = await supabase.from('loans')
        .select('*, repayment_schedule(*), payments(*)')
        .eq('user_id', clientId)
        .order('created_at', { ascending: false })
      if (!loansData) return []

      // Auto-generate missing schedules
      for (const loan of loansData) {
        if (!loan.repayment_schedule?.length && loan.duration_value > 0 && loan.total_repayment > 0) {
          const dVal  = Number(loan.duration_value)
          const dType = loan.duration_type || 'monthly'
          const per   = Math.round(loan.total_repayment / dVal * 100) / 100
          const start = new Date(loan.created_at)
          if (dType === 'daily') start.setDate(start.getDate() + 3)
          const rows = []
          for (let i = 1; i <= dVal; i++) {
            const d = new Date(start)
            if (dType === 'daily')       d.setDate(start.getDate() + i)
            else if (dType === 'weekly') d.setDate(start.getDate() + i * 7)
            else                         d.setMonth(start.getMonth() + i)
            rows.push({ loan_id: loan.id, due_date: d.toISOString().slice(0,10), amount_due: per, amount_paid: 0, status: 'pending' })
          }
          const { data: inserted } = await supabase.from('repayment_schedule').insert(rows).select()
          loan.repayment_schedule = inserted || []
        }

        // Apply confirmed payments to schedule
        const confirmed = (loan.payments || []).filter(p => p.status === 'confirmed')
        if (confirmed.length && loan.repayment_schedule?.length) {
          let pot = confirmed.reduce((s,p) => s + Number(p.actual_amount || p.amount), 0)
          const sorted = [...loan.repayment_schedule].sort((a,b) => new Date(a.due_date) - new Date(b.due_date))
          for (const row of sorted) {
            if (pot <= 0) break
            const due = Number(row.amount_due)
            if (pot >= due) { row.amount_paid = due; row.status = 'paid'; pot -= due }
            else { row.amount_paid = Math.round(pot*100)/100; row.status = 'partial'; pot = 0 }
          }
          loan.repayment_schedule = sorted
        }
      }
      return loansData
    },
    enabled: !!clientId,
  })

  // Record payment
  const recordPayment = useMutation({
    mutationFn: async () => {
      if (!payForm.amount || Number(payForm.amount) <= 0) throw new Error('Enter a valid amount')
      const loan = payModal
      const amt  = Number(payForm.amount)

      // Insert payment as confirmed (agent confirms directly)
      const { error: pErr } = await supabase.from('payments').insert({
        loan_id:        loan.id,
        user_id:        clientId,
        agent_id:       agent?.id,
        amount:         amt,
        actual_amount:  amt,
        payment_date:   payForm.payment_date,
        payment_method: payForm.payment_method,
        note:           payForm.note || null,
        status:         'confirmed',
        confirmed_at:   new Date().toISOString(),
      })
      if (pErr) throw pErr

      // Update loan outstanding
      const newOutstanding = Math.max(0, Number(loan.outstanding) - amt)
      const newPaid        = Number(loan.amount_paid || 0) + amt
      const newStatus      = newOutstanding <= 10 ? 'completed' : loan.status === 'disbursed' ? 'active' : loan.status
      await supabase.from('loans').update({
        outstanding: newOutstanding,
        amount_paid: newPaid,
        status: newStatus,
      }).eq('id', loan.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-client-loans', clientId] })
      setPayModal(null)
      setPayForm({ amount: '', payment_method: 'bank_transfer', payment_date: new Date().toISOString().slice(0,10), note: '' })
      setFlash({ type: 'success', msg: 'Payment recorded and confirmed.' })
    },
    onError: e => setFlash({ type: 'danger', msg: e.message }),
  })

  // Revert payment
  const revertPayment = useMutation({
    mutationFn: async (payment) => {
      // Get the loan
      const loan = loans?.find(l => l.id === payment.loan_id)
      if (!loan) throw new Error('Loan not found')

      const amt = Number(payment.actual_amount || payment.amount)

      // Mark payment as rejected
      await supabase.from('payments').update({ status: 'rejected', reverted_at: new Date().toISOString() }).eq('id', payment.id)

      // Restore outstanding
      const restoredOutstanding = Number(loan.outstanding) + amt
      const restoredPaid        = Math.max(0, Number(loan.amount_paid || 0) - amt)
      const restoredStatus      = loan.status === 'completed' ? 'active' : loan.status
      await supabase.from('loans').update({
        outstanding: restoredOutstanding,
        amount_paid: restoredPaid,
        status: restoredStatus,
      }).eq('id', loan.id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-client-loans', clientId] })
      setRevertModal(null)
      setFlash({ type: 'success', msg: 'Payment reverted successfully.' })
    },
    onError: e => setFlash({ type: 'danger', msg: e.message }),
  })

  if (isLoading) return <div className="py-12 text-center text-gray-400">Loading client…</div>

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Link to="/agent/clients" className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
          <ArrowLeft size={20}/>
        </Link>
        <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold flex-shrink-0">
          {client?.first_name?.[0]}{client?.last_name?.[0]}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{client?.first_name} {client?.last_name}</h1>
          <p className="text-sm text-gray-500">{client?.phone} · {client?.kyc_verified ? 'KYC Verified' : 'Not Verified'}</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Loans */}
      {!loans?.length && (
        <div className="py-12 text-center bg-white rounded-2xl border border-gray-200 text-gray-400">
          No loans for this client.
          <div className="mt-3">
            <Link to={`/agent/apply?client_id=${clientId}`}>
              <Button>Apply for Loan</Button>
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loans?.map(loan => {
          const schedule  = [...(loan.repayment_schedule || [])].sort((a,b) => new Date(a.due_date) - new Date(b.due_date))
          const payments  = [...(loan.payments || [])].sort((a,b) => new Date(b.created_at) - new Date(a.created_at))
          const paid      = schedule.filter(r => r.status === 'paid').length
          const total     = schedule.length
          const isOpen    = expandedLoan === loan.id
          const perInst   = loan.total_repayment / Math.max(1, loan.duration_value)
          const isActive  = ['active','disbursed'].includes(loan.status)

          return (
            <div key={loan.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              {/* Loan header */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono text-xs text-gray-400">{loan.loan_ref}</div>
                    <div className="font-bold text-xl text-gray-900 mt-0.5">{formatNaira(loan.amount)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{loan.duration_value} {loan.duration_type} · {formatNaira(perInst)}/instalment</div>
                  </div>
                  <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
                </div>

                {/* Figures */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-gray-50 rounded-xl p-2.5">
                    <div className="text-xs text-gray-400 mb-0.5">Disbursed</div>
                    <div className="text-sm font-bold text-gray-900">{formatNaira(loan.disbursed_amount)}</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-2.5">
                    <div className="text-xs text-amber-600 mb-0.5">Outstanding</div>
                    <div className="text-sm font-bold text-amber-700">{formatNaira(loan.outstanding)}</div>
                  </div>
                  <div className="bg-green-50 rounded-xl p-2.5">
                    <div className="text-xs text-green-600 mb-0.5">Paid</div>
                    <div className="text-sm font-bold text-green-700">{formatNaira(loan.amount_paid || 0)}</div>
                  </div>
                </div>

                {/* Progress */}
                {total > 0 && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                      <span>{paid}/{total} instalments paid</span>
                      <span className="font-semibold text-brand-600">{Math.round(paid/total*100)}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="bg-brand-500 h-2 rounded-full" style={{ width:`${Math.round(paid/total*100)}%` }}/>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  {isActive && (
                    <Button onClick={() => setPayModal(loan)} className="flex-1 justify-center gap-1.5 text-sm">
                      <Plus size={14}/> Record Payment
                    </Button>
                  )}
                  <button onClick={() => setExpanded(isOpen ? null : loan.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 px-2 py-1.5">
                    {isOpen ? <><ChevronUp size={14}/> Hide</> : <><ChevronDown size={14}/> Details</>}
                  </button>
                </div>
              </div>

              {/* Expanded: Schedule + Payments */}
              {isOpen && (
                <div className="border-t border-gray-100">
                  {/* Schedule */}
                  <div className="p-4 border-b border-gray-100">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Repayment Schedule</div>
                    <div className="space-y-2 max-h-52 overflow-y-auto">
                      {schedule.map((r, i) => (
                        <div key={r.id} className={`flex items-center gap-2 p-2 rounded-xl ${r.status==='overdue'?'bg-red-50':r.status==='paid'?'bg-green-50':'bg-gray-50'}`}>
                          {r.status==='paid' ? <CheckCircle2 size={14} className="text-green-500 flex-shrink-0"/>
                            : r.status==='overdue' ? <AlertTriangle size={14} className="text-red-500 flex-shrink-0"/>
                            : <Clock size={14} className="text-gray-300 flex-shrink-0"/>}
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                              <span className="text-xs text-gray-500">#{i+1} · {formatDate(r.due_date)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-gray-900">{formatNaira(r.amount_due)}</span>
                                <Badge color={r.status==='paid'?'green':r.status==='overdue'?'red':r.status==='partial'?'amber':'gray'}>
                                  {r.status}
                                </Badge>
                              </div>
                            </div>
                            {r.amount_paid > 0 && r.status !== 'paid' && (
                              <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                                <div className="bg-amber-400 h-1 rounded-full" style={{ width:`${Math.min(100,Math.round(r.amount_paid/r.amount_due*100))}%` }}/>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {!schedule.length && <div className="text-xs text-gray-400 text-center py-2">No schedule yet</div>}
                    </div>
                  </div>

                  {/* Payment history */}
                  <div className="p-4">
                    <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Payment History</div>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-xl">
                          <div>
                            <div className="font-semibold text-sm text-gray-900">{formatNaira(p.actual_amount || p.amount)}</div>
                            <div className="text-xs text-gray-400">{formatDate(p.payment_date)} · {p.payment_method?.replace('_',' ')}</div>
                            {p.note && <div className="text-xs text-gray-500 italic mt-0.5">{p.note}</div>}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge color={p.status==='confirmed'?'green':p.status==='rejected'?'red':'amber'}>{p.status}</Badge>
                            {p.status === 'confirmed' && (
                              <button
                                onClick={() => setRevertModal(p)}
                                className="p-1.5 rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors"
                                title="Revert this payment"
                              >
                                <RotateCcw size={12}/>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                      {!payments.length && <div className="text-xs text-gray-400 text-center py-2">No payments recorded yet</div>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Record Payment Modal */}
      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Record Payment — ${payModal?.loan_ref}`}>
        {payModal && (
          <>
            <div className="grid grid-cols-2 gap-2 text-sm mb-4 p-3 bg-gray-50 rounded-xl">
              <div><div className="text-xs text-gray-400">Outstanding</div><div className="font-bold text-amber-600">{formatNaira(payModal.outstanding)}</div></div>
              <div><div className="text-xs text-gray-400">Per Instalment</div><div className="font-bold">{formatNaira(payModal.total_repayment / Math.max(1, payModal.duration_value))}</div></div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Amount Paid (₦) *</label>
              <input type="number" value={payForm.amount} onChange={e => setP('amount', e.target.value)}
                placeholder="0.00"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Date</label>
              <input type="date" value={payForm.payment_date} onChange={e => setP('payment_date', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
            </div>

            <Select label="Payment Method" value={payForm.payment_method} onChange={e => setP('payment_method', e.target.value)}>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
              <option value="opay">OPay</option>
              <option value="pos">POS</option>
              <option value="manual">Manual (Agent Collected)</option>
            </Select>

            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Note <span className="text-gray-400 font-normal">(optional)</span></label>
              <input value={payForm.note} onChange={e => setP('note', e.target.value)}
                placeholder="e.g. Cash collected at client's shop"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700 mb-4">
              This payment will be <strong>immediately confirmed</strong> and will reduce the client's outstanding balance.
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setPayModal(null)}>Cancel</Button>
              <Button loading={recordPayment.isPending} onClick={() => recordPayment.mutate()}>
                Confirm Payment
              </Button>
            </div>
          </>
        )}
      </Modal>

      {/* Revert Payment Modal */}
      <Modal open={!!revertModal} onClose={() => setRevertModal(null)} title="Revert Payment">
        {revertModal && (
          <>
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl mb-4">
              <div className="font-bold text-red-700 mb-1">Are you sure?</div>
              <div className="text-sm text-red-600">
                This will revert the payment of <strong>{formatNaira(revertModal.actual_amount || revertModal.amount)}</strong> made on {formatDate(revertModal.payment_date)}.
                The client's outstanding balance will be restored.
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setRevertModal(null)}>Cancel</Button>
              <button
                onClick={() => revertPayment.mutate(revertModal)}
                disabled={revertPayment.isPending}
                className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40"
              >
                {revertPayment.isPending ? 'Reverting…' : 'Revert Payment'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
