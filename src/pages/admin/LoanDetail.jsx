import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, formatDate, formatDateTime, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { ArrowLeft, CheckCircle, XCircle, Banknote, RotateCcw, User, FileText } from 'lucide-react'

export default function AdminLoanDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // 'approve'|'reject'|'disburse'
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')
  const [flash, setFlash] = useState(null)

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loans')
        .select(`*, users!loans_user_id_fkey(*), guarantors(*), repayment_schedule(*), kyc_documents(*)`)
        .eq('id', id)
        .single()
      if (error) throw error
      return data
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ status, admin_notes, rejection_reason, disbursed_at }) => {
      const update = { status, updated_at: new Date().toISOString() }
      if (admin_notes)      update.admin_notes = admin_notes
      if (rejection_reason) update.rejection_reason = rejection_reason
      if (disbursed_at)     update.disbursed_at = disbursed_at
      if (status === 'active') update.admin_decision_at = new Date().toISOString()
      const { error } = await supabase.from('loans').update(update).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['loan', id] })
      qc.invalidateQueries({ queryKey: ['admin-loans'] })
      setModal(null)
      setFlash({ type: 'success', msg: `Loan ${vars.status === 'active' ? 'approved' : vars.status}.` })
    },
    onError: (e) => setFlash({ type: 'danger', msg: e.message }),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!loan) return <div className="p-8 text-center text-gray-400">Loan not found</div>

  const client = loan.users
  const canApprove  = ['under_review','manager_review','agent_approved'].includes(loan.status)
  const canDisburse = loan.status === 'admin_approved'
  const canReject   = !['completed','rejected','defaulted'].includes(loan.status)

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-600"/>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{loan.loan_ref}</h1>
          <p className="text-sm text-gray-500">{formatDateTime(loan.created_at)}</p>
        </div>
        <Badge color={loanStatusColor(loan.status)} className="text-sm px-3 py-1">
          {loanStatusLabel(loan.status)}
        </Badge>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap mb-6">
        {canApprove && (
          <Button onClick={() => setModal('approve')} className="gap-2">
            <CheckCircle size={15}/> Approve Loan
          </Button>
        )}
        {canDisburse && (
          <Button onClick={() => setModal('disburse')} className="gap-2" variant="success">
            <Banknote size={15}/> Mark Disbursed
          </Button>
        )}
        {canReject && (
          <Button onClick={() => setModal('reject')} variant="danger" className="gap-2">
            <XCircle size={15}/> Reject
          </Button>
        )}
        <Link to={`/admin/loans/${id}/repayments`}>
          <Button variant="outline" className="gap-2"><RotateCcw size={15}/> Repayment History</Button>
        </Link>
        {['active','disbursed'].includes(loan.status) && (
          <Link to={`/admin/loans/${id}/restructure`}>
            <Button variant="outline" className="gap-2 text-amber-600 border-amber-300 hover:bg-amber-50">
              <RotateCcw size={15}/> Restructure
            </Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Loan details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><div className="font-bold flex items-center gap-2"><FileText size={16}/> Loan Details</div></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {[
                  ['Reference',      loan.loan_ref],
                  ['Type',           loan.loan_type === 'asset' ? 'Asset Loan' : 'Cash Loan'],
                  ['Amount',         formatNaira(loan.amount)],
                  ['Disbursed Amt',  formatNaira(loan.disbursed_amount)],
                  ['Admin Charge',   formatNaira(loan.admin_charge)],
                  ['Interest Rate',  `${loan.interest_rate}% / month`],
                  ['Total Repayment',formatNaira(loan.total_repayment)],
                  ['Outstanding',    formatNaira(loan.outstanding)],
                  ['Amount Paid',    formatNaira(loan.amount_paid)],
                  ['Duration',       `${loan.duration_value} ${loan.duration_type}`],
                  ['Purpose',        loan.purpose || '—'],
                  ['Bank',           loan.bank_name || '—'],
                  ['Account No',     loan.bank_account_number || '—'],
                  ['Account Name',   loan.bank_account_name || '—'],
                ].map(([k,v]) => (
                  <div key={k}>
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{k}</div>
                    <div className="font-medium text-gray-900">{v}</div>
                  </div>
                ))}
              </div>
              {loan.admin_notes && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
                  <div className="font-semibold text-amber-700 mb-1">Admin Notes</div>
                  <div className="text-amber-800">{loan.admin_notes}</div>
                </div>
              )}
              {loan.rejection_reason && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm">
                  <div className="font-semibold text-red-700 mb-1">Rejection Reason</div>
                  <div className="text-red-800">{loan.rejection_reason}</div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Repayment Schedule */}
          {loan.repayment_schedule?.length > 0 && (
            <Card>
              <CardHeader><div className="font-bold">Repayment Schedule</div></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Due Date</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Amount Due</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Amount Paid</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loan.repayment_schedule.map((r, i) => (
                      <tr key={r.id} className="border-b border-gray-100">
                        <td className="px-4 py-2 text-gray-500">{i+1}</td>
                        <td className="px-4 py-2">{formatDate(r.due_date)}</td>
                        <td className="px-4 py-2 font-medium">{formatNaira(r.amount_due)}</td>
                        <td className="px-4 py-2">{formatNaira(r.amount_paid)}</td>
                        <td className="px-4 py-2">
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
          )}
        </div>

        {/* Client info */}
        <div className="space-y-4">
          <Card>
            <CardHeader><div className="font-bold flex items-center gap-2"><User size={16}/> Client</div></CardHeader>
            <CardBody>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-lg">
                  {client?.first_name?.[0]}{client?.last_name?.[0]}
                </div>
                <div>
                  <div className="font-bold">{client?.first_name} {client?.last_name}</div>
                  <div className="text-xs text-gray-500">{client?.email}</div>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  ['Phone',   client?.phone || '—'],
                  ['BVN',     client?.bvn_number ? client.bvn_number.slice(0,4)+'*******' : '—'],
                  ['NIN',     client?.nin_number ? client.nin_number.slice(0,4)+'*******' : '—'],
                  ['Address', client?.residential_address || '—'],
                  ['KYC',     client?.kyc_verified ? 'Verified' : 'Not Verified'],
                ].map(([k,v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-right max-w-[60%]">{v}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* KYC Documents */}
          <Card>
            <CardHeader>
              <div className="font-bold text-sm">KYC Documents</div>
              <span className="text-xs text-gray-500">{loan.kyc_documents?.length || 0} files</span>
            </CardHeader>
            <CardBody>
              {loan.kyc_documents?.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {loan.kyc_documents.map(doc => (
                    <a key={doc.id}
                      href={`https://ftiloan.b-cdn.net/${doc.file_path}`}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg hover:border-brand-400 transition-all text-xs">
                      <span className="text-lg">
                        {doc.doc_type==='passport'?'🪪':doc.doc_type==='business_photo'?'🏪':doc.doc_type==='cac_document'?'📋':'📄'}
                      </span>
                      <div>
                        <div className="font-semibold capitalize">{doc.doc_type?.replace(/_/g,' ')}</div>
                        <div className="text-brand-600">View →</div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 text-center py-2">No documents</p>
              )}
            </CardBody>
          </Card>

          {/* Guarantors */}
          {loan.guarantors?.map(g => (
            <Card key={g.id}>
              <CardHeader><div className="font-bold text-sm">Guarantor</div></CardHeader>
              <CardBody>
                <div className="space-y-2 text-sm">
                  <div className="font-semibold">{g.name}</div>
                  <div className="text-gray-500">{g.phone}</div>
                  <div className="text-gray-500">{g.relationship}</div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      {/* Approve Modal */}
      <Modal open={modal==='approve'} onClose={() => setModal(null)} title="Approve Loan">
        <p className="text-sm text-gray-600 mb-4">
          Approve <strong>{loan.loan_ref}</strong> for <strong>{formatNaira(loan.amount)}</strong>?
        </p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder="Admin notes (optional)…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-brand-400"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button loading={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ status:'admin_approved', admin_notes: notes })}>
            Approve
          </Button>
        </div>
      </Modal>

      {/* Disburse Modal */}
      <Modal open={modal==='disburse'} onClose={() => setModal(null)} title="Mark as Disbursed">
        <Alert type="info" className="mb-4">
          This confirms funds of <strong>{formatNaira(loan.disbursed_amount)}</strong> have been transferred to <strong>{loan.bank_account_name}</strong> — {loan.bank_account_number} ({loan.bank_name}).
        </Alert>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="success" loading={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ status:'disbursed', disbursed_at: new Date().toISOString() })}>
            Confirm Disbursement
          </Button>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={modal==='reject'} onClose={() => setModal(null)} title="Reject Loan">
        <p className="text-sm text-gray-600 mb-3">Provide a reason for rejection:</p>
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
          placeholder="Reason for rejection…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ status:'rejected', rejection_reason: reason })}>
            Reject Loan
          </Button>
        </div>
      </Modal>
    </div>
  )
}
