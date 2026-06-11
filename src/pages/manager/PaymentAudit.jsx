import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils'
import { CheckCircle, XCircle, AlertTriangle, MessageSquare, ExternalLink } from 'lucide-react'

export default function ManagerPaymentAudit() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab]       = useState('confirmed')
  const [modal, setModal]   = useState(null)
  const [selected, setSelected] = useState(null)
  const [note, setNote]     = useState('')
  const [flash, setFlash]   = useState(null)

  const { data: payments, isLoading } = useQuery({
    queryKey: ['manager-audit-payments', tab],
    queryFn: async () => {
      let q = supabase.from('payments')
        .select(`*, loans(loan_ref,amount,outstanding,user_id,agent_id,
          users!loans_user_id_fkey(first_name,last_name,phone)),
          users!payments_user_id_fkey(first_name,last_name,phone)`)
        .order('created_at', { ascending: false })
        .limit(50)

      if (tab === 'confirmed') q = q.eq('status','confirmed')
      if (tab === 'queried')   q = q.eq('audit_status','queried')
      if (tab === 'resolved')  q = q.eq('audit_status','resolved')

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const query = useMutation({
    mutationFn: async ({ paymentId, loanId, agentId, note }) => {
      // Mark payment as queried
      await supabase.from('payments').update({ audit_status: 'queried', audit_note: note }).eq('id', paymentId)

      // Notify agent
      if (agentId) {
        const { data: agent } = await supabase.from('agents').select('user_id').eq('id', agentId).single()
        if (agent) {
          await supabase.from('notifications').insert({
            user_id: agent.user_id,
            title:   '⚠ Payment Queried by Manager',
            message: `Manager has queried a payment you confirmed. Note: ${note}. Please review and respond.`,
            type:    'warning',
          })
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-audit-payments'] })
      setModal(null); setNote('')
      setFlash({ type:'success', msg:'Payment queried. Agent has been notified.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const revoke = useMutation({
    mutationFn: async ({ paymentId, loanId, amount }) => {
      // Reverse the payment
      await supabase.from('payments').update({ status:'rejected', audit_status:'revoked', audit_note: note }).eq('id', paymentId)

      // Reverse loan balance
      const { data: loan } = await supabase.from('loans').select('outstanding,amount_paid').eq('id', loanId).single()
      if (loan) {
        await supabase.from('loans').update({
          outstanding:  Number(loan.outstanding) + Number(amount),
          amount_paid:  Math.max(0, Number(loan.amount_paid) - Number(amount)),
        }).eq('id', loanId)
      }

      // Reverse schedule entries
      await supabase.from('repayment_schedule')
        .update({ status:'overdue', amount_paid:0, paid_at:null })
        .eq('loan_id', loanId).eq('status','paid')
        .limit(1)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['manager-audit-payments'] })
      setModal(null); setNote('')
      setFlash({ type:'success', msg:'Payment revoked. Loan balance restored.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const resolve = useMutation({
    mutationFn: async (paymentId) => {
      await supabase.from('payments').update({ audit_status:'resolved' }).eq('id', paymentId)
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['manager-audit-payments'] }); setFlash({ type:'success', msg:'Marked as resolved.' }) },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <CheckCircle size={20} className="text-brand-600"/> Payment Audit
        </h1>
        <p className="text-sm text-gray-500">Review confirmed payments, query or revoke suspicious ones</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="flex gap-2 mb-4 border-b border-gray-200">
        {[['confirmed','Confirmed'],['queried','Queried'],['resolved','Resolved']].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all
              ${tab===t?'border-brand-600 text-brand-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}

      <div className="space-y-3">
        {payments?.map(p => (
          <div key={p.id} className={`bg-white rounded-xl border shadow-sm p-4 ${
            p.audit_status==='queried'?'border-amber-300':p.audit_status==='revoked'?'border-red-300':'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold">{p.users?.first_name} {p.users?.last_name}</div>
                <div className="text-xs text-gray-500 font-mono">{p.loans?.loan_ref}</div>
                <div className="text-xs text-gray-400">{formatDateTime(p.created_at)}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge color={p.status==='confirmed'?'green':'red'}>{p.status}</Badge>
                {p.audit_status && <Badge color={p.audit_status==='queried'?'amber':p.audit_status==='resolved'?'green':'red'} className="text-xs">{p.audit_status}</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-3 text-xs">
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-gray-400 uppercase mb-0.5">Amount</div>
                <div className="font-bold text-green-600">{formatNaira(p.actual_amount||p.amount)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-gray-400 uppercase mb-0.5">Outstanding</div>
                <div className="font-bold text-amber-600">{formatNaira(p.loans?.outstanding)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <div className="text-gray-400 uppercase mb-0.5">Method</div>
                <div className="font-medium capitalize">{p.payment_method?.replace('_',' ')}</div>
              </div>
            </div>

            {p.slip_file && (
              <a href={`https://ftiloan.b-cdn.net/${p.slip_file}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1 text-xs text-brand-600 mb-3">
                <ExternalLink size={11}/> View Slip
              </a>
            )}

            {p.audit_note && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 mb-3">
                Query: {p.audit_note}
              </div>
            )}

            <div className="flex gap-2 flex-wrap">
              {tab === 'confirmed' && !p.audit_status && (
                <>
                  <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-300"
                    onClick={() => { setSelected(p); setModal('query') }}>
                    <MessageSquare size={12}/> Query Agent
                  </Button>
                  <Button size="sm" variant="danger" className="gap-1"
                    onClick={() => { setSelected(p); setModal('revoke') }}>
                    <XCircle size={12}/> Revoke
                  </Button>
                </>
              )}
              {tab === 'queried' && (
                <Button size="sm" variant="outline" className="gap-1 text-green-600 border-green-300"
                  onClick={() => resolve.mutate(p.id)}>
                  <CheckCircle size={12}/> Mark Resolved
                </Button>
              )}
            </div>
          </div>
        ))}
        {!isLoading && !payments?.length && (
          <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No {tab} payments.
          </div>
        )}
      </div>

      <Modal open={modal==='query'} onClose={() => setModal(null)} title="Query Payment">
        <p className="text-sm text-gray-600 mb-3">
          Send a query to the agent about this payment of <strong>{formatNaira(selected?.actual_amount||selected?.amount)}</strong>
        </p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Describe the issue…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-amber-400"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button className="bg-amber-500 border-amber-500 hover:bg-amber-600" loading={query.isPending}
            onClick={() => query.mutate({ paymentId:selected.id, loanId:selected.loan_id, agentId:selected.loans?.agent_id, note })}>
            Send Query
          </Button>
        </div>
      </Modal>

      <Modal open={modal==='revoke'} onClose={() => setModal(null)} title="Revoke Payment">
        <Alert type="danger" className="mb-4 text-sm">
          This will mark the payment as rejected and <strong>restore the loan balance</strong> by {formatNaira(selected?.actual_amount||selected?.amount)}.
        </Alert>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Reason for revoking…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={revoke.isPending}
            onClick={() => revoke.mutate({ paymentId:selected.id, loanId:selected.loan_id, amount:selected.actual_amount||selected.amount })}>
            Revoke Payment
          </Button>
        </div>
      </Modal>
    </div>
  )
}
