import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, formatDate, formatDateTime, loanStatusColor, loanStatusLabel } from '@/lib/utils'
import { ArrowLeft, CheckCircle, XCircle, Send, FileText, User, Shield } from 'lucide-react'

const DOC_LABELS = {
  passport:        'Passport Photo',
  nin_slip:        'NIN Slip',
  bank_statement:  'Bank Statement',
  business_photo:  'Business/Shop Photo',
  proof_of_address:'Proof of Address',
  cac_document:    'CAC / Business Reg',
}

export default function ManagerLoanDetail() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { profile } = useAuthStore()
  const qc          = useQueryClient()
  const [modal, setModal]   = useState(null)
  const [note, setNote]     = useState('')
  const [offer, setOffer]   = useState('')
  const [flash, setFlash]   = useState(null)

  const { data: loan, isLoading } = useQuery({
    queryKey: ['manager-loan', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('loans')
        .select(`*, users!loans_user_id_fkey(*),
          guarantors(*),
          kyc_documents(*)
          `)
        .eq('id', id).single()
      if (error) throw error
      return data
    },
  })

  const updateStatus = useMutation({
    mutationFn: async ({ status, note, offer_amount }) => {
      const update = { status, manager_decision_at: new Date().toISOString() }
      if (note)         update.admin_notes = note
      if (offer_amount) update.offer_amount = offer_amount
      const { error } = await supabase.from('loans').update(update).eq('id', id)
      if (error) throw error
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['manager-loan', id] })
      qc.invalidateQueries({ queryKey: ['manager-loans'] })
      qc.invalidateQueries({ queryKey: ['manager-pending-count'] })
      setModal(null)
      setFlash({
        type: 'success',
        msg: vars.status === 'agent_approved' ? 'Loan forwarded to admin for final approval.' : 'Loan rejected.'
      })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  if (isLoading) return <div className="p-8 text-center text-gray-400">Loading…</div>
  if (!loan) return <div className="p-8 text-center text-gray-400">Loan not found</div>

  const client   = loan.users
  const docs     = loan.kyc_documents || []
  const canReview = ['under_review','manager_review'].includes(loan.status)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={18} className="text-gray-600"/>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{loan.loan_ref}</h1>
          <p className="text-sm text-gray-500">{loan.users?.first_name} {loan.users?.last_name} — {formatDateTime(loan.created_at)}</p>
        </div>
        <Badge color={loanStatusColor(loan.status)} className="text-sm px-3 py-1">
          {loanStatusLabel(loan.status)}
        </Badge>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Actions */}
      {canReview && (
        <div className="flex gap-2 flex-wrap mb-6">
          <Button onClick={() => setModal('forward')} className="gap-2">
            <Send size={15}/> Forward to Admin
          </Button>
          <Button variant="danger" onClick={() => setModal('reject')} className="gap-2">
            <XCircle size={15}/> Reject
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main details */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader><div className="font-bold flex items-center gap-2"><FileText size={16}/> Loan Details</div></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
                {[
                  ['Reference',      loan.loan_ref],
                  ['Type',           loan.loan_type === 'asset' ? 'Asset Loan' : 'Cash Loan'],
                  ['Amount',         formatNaira(loan.amount)],
                  ['Disbursed',      formatNaira(loan.disbursed_amount)],
                  ['Admin Charge',   formatNaira(loan.admin_charge)],
                  ['Interest Rate',  `${loan.interest_rate}% / month`],
                  ['Total Repayment',formatNaira(loan.total_repayment)],
                  ['Duration',       `${loan.duration_value} ${loan.duration_type} instalments`],
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
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <div className="font-semibold text-blue-700 mb-1">Notes</div>
                  <div className="text-blue-800">{loan.admin_notes}</div>
                </div>
              )}
            </CardBody>
          </Card>

          {/* KYC Documents */}
          <Card>
            <CardHeader>
              <div className="font-bold flex items-center gap-2"><Shield size={16}/> KYC Documents</div>
              <Badge color={docs.length > 0 ? 'green' : 'gray'}>{docs.length} uploaded</Badge>
            </CardHeader>
            <CardBody>
              {docs.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {docs.map(doc => (
                    <a key={doc.id}
                      href={`https://ftiloan.b-cdn.net/documents/${doc.file_path}`}
                      target="_blank" rel="noreferrer"
                      className="flex flex-col items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:border-brand-400 hover:bg-brand-50 transition-all text-center">
                      <div className="text-2xl">
                        {doc.doc_type === 'passport' ? '🪪' :
                         doc.doc_type === 'business_photo' ? '🏪' :
                         doc.doc_type === 'cac_document' ? '📋' :
                         doc.doc_type === 'bank_statement' ? '🏦' : '📄'}
                      </div>
                      <div className="text-xs font-semibold text-gray-700">
                        {DOC_LABELS[doc.doc_type] || doc.doc_type}
                      </div>
                      <div className="text-xs text-brand-600">View →</div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No documents uploaded</p>
              )}
            </CardBody>
          </Card>

          {/* Guarantors */}
          {loan.guarantors?.length > 0 && (
            <Card>
              <CardHeader><div className="font-bold">Guarantors</div></CardHeader>
              <CardBody>
                {loan.guarantors.map((g,i) => (
                  <div key={g.id} className={`${i>0?'mt-4 pt-4 border-t border-gray-100':''}`}>
                    <div className="font-semibold">{g.name}</div>
                    <div className="text-sm text-gray-500">{g.phone} — {g.relationship}</div>
                    {g.address && <div className="text-xs text-gray-400 mt-1">{g.address}</div>}
                  </div>
                ))}
              </CardBody>
            </Card>
          )}
        </div>

        {/* Client info */}
        <div className="space-y-4">
          <Card>
            <CardHeader><div className="font-bold flex items-center gap-2"><User size={16}/> Client</div></CardHeader>
            <CardBody>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-brand-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
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
                  ['DOB',     client?.date_of_birth ? formatDate(client.date_of_birth) : '—'],
                  ['LGA',     client?.lga || '—'],
                  ['Address', client?.residential_address || '—'],
                  ['KYC',     client?.kyc_verified ? '✅ Verified' : '❌ Not verified'],
                ].map(([k,v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <span className="text-gray-500 shrink-0">{k}</span>
                    <span className="font-medium text-right text-xs max-w-[60%]">{v}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Forward to Admin Modal */}
      <Modal open={modal==='forward'} onClose={() => setModal(null)} title="Forward to Admin">
        <p className="text-sm text-gray-600 mb-3">
          Add a risk assessment note before forwarding <strong>{loan.loan_ref}</strong> to admin for final approval.
        </p>
        <div className="mb-3">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Risk Assessment Note *</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
            placeholder="Summarise your review findings, client verification, and recommendation…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Counter Offer Amount (optional)</label>
          <input type="number" value={offer} onChange={e => setOffer(e.target.value)}
            placeholder="Leave empty to approve original amount"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
          <p className="text-xs text-gray-400 mt-1">Enter a lower amount if you want to suggest a counter offer to the admin</p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button loading={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ status:'agent_approved', note, offer_amount: offer ? Number(offer) : null })}>
            <Send size={14}/> Forward to Admin
          </Button>
        </div>
      </Modal>

      {/* Reject Modal */}
      <Modal open={modal==='reject'} onClose={() => setModal(null)} title="Reject Loan">
        <p className="text-sm text-gray-600 mb-3">Provide a reason for rejecting <strong>{loan.loan_ref}</strong>:</p>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
          placeholder="Reason for rejection…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ status:'manager_rejected', note })}>
            Reject Loan
          </Button>
        </div>
      </Modal>
    </div>
  )
}
