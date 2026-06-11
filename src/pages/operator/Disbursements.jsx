import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Card } from '@/components/ui/Card'
import { formatNaira, formatDate } from '@/lib/utils'
import { Banknote, CheckCircle } from 'lucide-react'

export default function OperatorDisbursements() {
  const qc = useQueryClient()
  const [modal, setModal]   = useState(null)
  const [selected, setSelected] = useState(null)
  const [ref, setRef]       = useState('')
  const [flash, setFlash]   = useState(null)

  const { data: loans, isLoading } = useQuery({
    queryKey: ['operator-disburse'],
    queryFn: async () => {
      const { data, error } = await supabase.from('loans')
        .select(`*, users!loans_user_id_fkey(first_name,last_name,phone,email)`)
        .eq('status', 'admin_approved')
        .order('admin_decision_at', { ascending: true })
      if (error) throw error
      return data || []
    },
  })

  const disburse = useMutation({
    mutationFn: async ({ id, txnRef }) => {
      const { error } = await supabase.from('loans').update({
        status: 'disbursed',
        disbursed_at: new Date().toISOString(),
        admin_notes: txnRef ? `Disbursed. TXN: ${txnRef}` : 'Disbursed by operator',
      }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operator-disburse'] })
      setModal(null); setRef('')
      setFlash({ type:'success', msg:'Loan marked as disbursed.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Disbursements</h1>
        <p className="text-sm text-gray-500">{loans?.length || 0} loans awaiting disbursement</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}

      <div className="space-y-4">
        {loans?.map(loan => (
          <div key={loan.id} className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-bold text-gray-900">{loan.users?.first_name} {loan.users?.last_name}</div>
                <div className="font-mono text-xs text-gray-500 mt-0.5">{loan.loan_ref}</div>
              </div>
              <Badge color="green">Ready to Disburse</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Loan Amount</div>
                <div className="font-bold">{formatNaira(loan.amount)}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">To Disburse</div>
                <div className="font-bold text-green-600">{formatNaira(loan.disbursed_amount)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Bank</div>
                <div className="font-medium">{loan.bank_name}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Account</div>
                <div className="font-mono text-sm">{loan.bank_account_number}</div>
                <div className="text-xs text-gray-500 truncate">{loan.bank_account_name}</div>
              </div>
            </div>
            <Button className="gap-2" onClick={() => { setSelected(loan); setModal('disburse') }}>
              <Banknote size={15}/> Mark as Disbursed
            </Button>
          </div>
        ))}
        {!isLoading && !loans?.length && (
          <div className="py-16 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No loans awaiting disbursement.
          </div>
        )}
      </div>

      <Modal open={modal==='disburse'} onClose={() => setModal(null)} title="Confirm Disbursement">
        {selected && (
          <>
            <Alert type="info" className="mb-4 text-sm">
              Confirm that <strong>{formatNaira(selected.disbursed_amount)}</strong> has been sent to <strong>{selected.bank_account_name}</strong> ({selected.bank_account_number} — {selected.bank_name}).
            </Alert>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Transaction Reference (optional)</label>
              <input value={ref} onChange={e => setRef(e.target.value)} placeholder="Bank transaction reference"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button loading={disburse.isPending} onClick={() => disburse.mutate({ id: selected.id, txnRef: ref })}>
                <CheckCircle size={15}/> Confirm Disbursement
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
