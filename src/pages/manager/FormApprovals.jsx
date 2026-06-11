import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { formatDate, formatDateTime } from '@/lib/utils'
import { ClipboardList, CheckCircle, XCircle } from 'lucide-react'

export default function ManagerFormApprovals() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [flash, setFlash]   = useState(null)
  const [modal, setModal]   = useState(null)
  const [selected, setSelected] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [tab, setTab]       = useState('pending')

  const { data: batches, isLoading } = useQuery({
    queryKey: ['form-batches', tab],
    queryFn: async () => {
      let q = supabase.from('form_batches')
        .select(`*, agents(id, users!agents_user_id_fkey(first_name,last_name,phone))`)
        .order('created_at', { ascending: false })
      if (tab !== 'all') q = q.eq('status', tab)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const approve = useMutation({
    mutationFn: async (batch) => {
      // Approve batch
      await supabase.from('form_batches').update({
        status: 'approved', reviewed_by: profile.id, reviewed_at: new Date().toISOString()
      }).eq('id', batch.id)

      // Generate form codes
      const codes = Array.from({ length: batch.quantity }, (_, i) => ({
        code:      `FTI-FORM-${batch.batch_ref}-${String(i+1).padStart(3,'0')}`,
        agent_id:  batch.agent_id,
        batch_ref: batch.batch_ref,
        status:    'unused',
      }))
      await supabase.from('form_codes').insert(codes)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-batches'] })
      setModal(null)
      setFlash({ type:'success', msg:'Batch approved. Form codes generated.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const reject = useMutation({
    mutationFn: async ({ id, reason }) => {
      await supabase.from('form_batches').update({
        status: 'rejected', reviewed_by: profile.id,
        reviewed_at: new Date().toISOString(), reject_reason: reason
      }).eq('id', id)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['form-batches'] })
      setModal(null); setRejectReason('')
      setFlash({ type:'success', msg:'Batch rejected.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Form Approvals</h1>
          <p className="text-sm text-gray-500">Approve or reject agent form batch requests</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="flex gap-2 mb-4">
        {['pending','approved','rejected','all'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize
              ${tab===t?'bg-brand-600 text-white':'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}
        {batches?.map(batch => (
          <div key={batch.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-gray-900 font-mono">{batch.batch_ref}</div>
                <div className="text-sm text-gray-500">
                  Agent: <span className="font-medium">
                    {batch.agents?.users?.first_name} {batch.agents?.users?.last_name}
                  </span> — {batch.agents?.users?.phone}
                </div>
              </div>
              <Badge color={batch.status==='approved'?'green':batch.status==='rejected'?'red':batch.status==='revoked'?'gray':'amber'}>
                {batch.status}
              </Badge>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4 text-sm">
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Quantity</div>
                <div className="font-bold text-xl">{batch.quantity}</div>
                <div className="text-xs text-gray-400">forms requested</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Requested</div>
                <div className="font-medium text-sm">{formatDate(batch.created_at)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-xs text-gray-400 uppercase mb-0.5">Reason</div>
                <div className="font-medium text-xs">{batch.reason || '—'}</div>
              </div>
            </div>

            {batch.reject_reason && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                Rejection reason: {batch.reject_reason}
              </div>
            )}

            {batch.status === 'pending' && (
              <div className="flex gap-2">
                <Button className="gap-2" onClick={() => { setSelected(batch); setModal('approve') }}>
                  <CheckCircle size={14}/> Approve & Generate Codes
                </Button>
                <Button variant="danger" className="gap-2" onClick={() => { setSelected(batch); setModal('reject') }}>
                  <XCircle size={14}/> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
        {!isLoading && !batches?.length && (
          <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No {tab === 'all' ? '' : tab} batch requests.
          </div>
        )}
      </div>

      <Modal open={modal==='approve'} onClose={() => setModal(null)} title="Approve Batch">
        {selected && (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Approve <strong>{selected.batch_ref}</strong>? This will generate <strong>{selected.quantity} form codes</strong> for the agent.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button loading={approve.isPending} onClick={() => approve.mutate(selected)}>
                Approve & Generate
              </Button>
            </div>
          </>
        )}
      </Modal>

      <Modal open={modal==='reject'} onClose={() => setModal(null)} title="Reject Batch">
        <p className="text-sm text-gray-600 mb-3">Reason for rejecting <strong>{selected?.batch_ref}</strong>:</p>
        <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
          placeholder="Reason for rejection…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-red-400"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
          <Button variant="danger" loading={reject.isPending}
            onClick={() => reject.mutate({ id: selected?.id, reason: rejectReason })}>
            Reject
          </Button>
        </div>
      </Modal>
    </div>
  )
}
