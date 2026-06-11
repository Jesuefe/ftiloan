import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { ArrowLeft, CheckCircle, XCircle } from 'lucide-react'

export default function ManagerLoanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null)
  const [reason, setReason] = useState('')
  const [flash, setFlash]   = useState(null)

  const { data: loan, isLoading } = useQuery({
    queryKey: ['manager-loan', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('loans')
        .select(`*, users!loans_user_id_fkey(*), guarantors(*)`)
        .eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ status, reason }) => {
      const update = { status, manager_decision_at: new Date().toISOString() }
      if (reason) update.rejection_reason = reason
      const { error } = await supabase.from('loans').update(update).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['manager-loan', id] })
      setModal(null)
      setFlash({ type:'success', msg:`Loan ${vars.status}.` })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!loan) return <div className="p-8 text-center text-gray-400">Loan not found</div>

  const canReview = ['under_review','manager_review'].includes(loan.status)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ArrowLeft size={18}/></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{loan.loan_ref}</h1>
          <p className="text-sm text-gray-500">{loan.users?.first_name} {loan.users?.last_name}</p>
        </div>
        <Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {canReview && (
        <div className="flex gap-2 mb-6">
          <Button onClick={() => setModal('approve')} className="gap-2"><CheckCircle size={15}/> Approve for Admin</Button>
          <Button variant="danger" onClick={() => setModal('reject')} className="gap-2"><XCircle size={15}/> Reject</Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><div className="font-bold">Loan Details</div></CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm">
              {[
                ['Amount',         formatNaira(loan.amount)],
                ['Disbursed Amt',  formatNaira(loan.disbursed_amount)],
                ['Total Repayment',formatNaira(loan.total_repayment)],
                ['Outstanding',    formatNaira(loan.outstanding)],
                ['Interest Rate',  `${loan.interest_rate}%/month`],
                ['Duration',       `${loan.duration_value} ${loan.duration_type}`],
                ['Purpose',        loan.purpose || '—'],
                ['Bank',           `${loan.bank_name} — ${loan.bank_account_number}`],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader><div className="font-bold">Client</div></CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm">
              {[
                ['Name',    `${loan.users?.first_name} ${loan.users?.last_name}`],
                ['Email',   loan.users?.email],
                ['Phone',   loan.users?.phone],
                ['BVN',     loan.users?.bvn_number ? loan.users.bvn_number.slice(0,4)+'*******':'—'],
                ['KYC',     loan.users?.kyc_verified ? '✅ Verified' : '❌ Not verified'],
                ['Address', loan.users?.residential_address || '—'],
              ].map(([k,v]) => (
                <div key={k} className="flex justify-between">
                  <span className="text-gray-500">{k}</span>
                  <span className="font-medium text-right max-w-[60%]">{v}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <Modal open={modal==='approve'} onClose={() => setModal(null)} title="Forward to Admin">
        <p className="text-sm text-gray-600 mb-4">Forward <strong>{loan.loan_ref}</strong> to admin for final approval?</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button loading={updateStatus.isPending} onClick={() => updateStatus.mutate({ status:'manager_review' })}>Forward to Admin</Button>
        </div>
      </Modal>

      <Modal open={modal==='reject'} onClose={() => setModal(null)} title="Reject Loan">
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Reason for rejection…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={updateStatus.isPending} onClick={() => updateStatus.mutate({ status:'manager_rejected', reason })}>Reject</Button>
        </div>
      </Modal>
    </div>
  )
}
