import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { formatNaira, formatDate } from '@/lib/utils'
import { CheckCircle, XCircle } from 'lucide-react'

export default function AdminPayments() {
  const [status, setStatus]     = useState('all')
  const [modal, setModal]       = useState(null)
  const [selected, setSelected] = useState(null)
  const [actualAmt, setActualAmt] = useState('')
  const [flash, setFlash]       = useState(null)
  const qc = useQueryClient()

  const { data: payments, isLoading } = useQuery({
    queryKey: ['admin-payments', status],
    queryFn: async () => {
      let q = supabase.from('payments')
        .select('*, loans(loan_ref,amount), users!payments_user_id_fkey(first_name,last_name,phone)')
        .order('created_at', { ascending: false }).limit(100)
      if (status !== 'all') q = q.eq('status', status)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const confirm = useMutation({
    mutationFn: async ({ id, actual }) => {
      await supabase.from('payments').update({ status:'confirmed', actual_amount:actual, confirmed_at:new Date().toISOString() }).eq('id',id)
      const pay = payments.find(p => p.id === id)
      if (pay) {
        const { data: loan } = await supabase.from('loans').select('outstanding,amount_paid,status').eq('id',pay.loan_id).single()
        if (loan) {
          const newOut  = Math.max(0, Number(loan.outstanding) - Number(actual))
          const newPaid = Number(loan.amount_paid) + Number(actual)
          const newSt   = newOut <= 10 ? 'completed' : loan.status === 'disbursed' ? 'active' : loan.status
          await supabase.from('loans').update({ outstanding:newOut, amount_paid:newPaid, status:newSt }).eq('id',pay.loan_id)
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['admin-payments'] }); setModal(null); setFlash({ type:'success', msg:'Payment confirmed.' }) },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const reject = useMutation({
    mutationFn: async (id) => { await supabase.from('payments').update({ status:'rejected' }).eq('id',id) },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['admin-payments'] }); setFlash({ type:'success', msg:'Payment rejected.' }) },
  })

  const statusColor = s => ({ confirmed:'green', rejected:'red', pending:'amber' }[s] || 'gray')

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div><h1 className="text-xl font-bold">Payments</h1><p className="text-sm text-gray-500">{payments?.length||0} records</p></div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {['all','pending','confirmed','rejected'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all
              ${status===s ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>

      {/* Mobile */}
      <div className="space-y-2 lg:hidden">
        {isLoading && <div className="py-8 text-center text-sm text-gray-400">Loading…</div>}
        {payments?.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-gray-900">{formatNaira(p.amount)}</div>
                <div className="text-sm font-medium text-gray-700">{p.users?.first_name} {p.users?.last_name}</div>
                <div className="font-mono text-xs text-gray-400">{p.loans?.loan_ref}</div>
                <div className="text-xs text-gray-400 mt-0.5 capitalize">{p.payment_method?.replace('_',' ')} · {formatDate(p.created_at)}</div>
              </div>
              <Badge color={statusColor(p.status)}>{p.status}</Badge>
            </div>
            {p.status === 'pending' && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <Button size="sm" className="flex-1 justify-center gap-1"
                  onClick={() => { setSelected(p); setActualAmt(p.amount); setModal('confirm') }}>
                  <CheckCircle size={12}/> Confirm
                </Button>
                <Button size="sm" variant="danger" className="flex-1 justify-center gap-1"
                  onClick={() => reject.mutate(p.id)}>
                  <XCircle size={12}/> Reject
                </Button>
              </div>
            )}
          </div>
        ))}
        {!isLoading && !payments?.length && <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-200">No payments found</div>}
      </div>

      {/* Desktop */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['Client','Loan Ref','Claimed','Method','Status','Date','Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {payments?.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium"><div>{p.users?.first_name} {p.users?.last_name}</div><div className="text-xs text-gray-400">{p.users?.phone}</div></td>
                  <td className="px-4 py-3 font-mono text-xs">{p.loans?.loan_ref}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(p.amount)}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{p.payment_method?.replace('_',' ')}</td>
                  <td className="px-4 py-3"><Badge color={statusColor(p.status)}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-3">
                    {p.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button size="sm" className="gap-1" onClick={() => { setSelected(p); setActualAmt(p.amount); setModal('confirm') }}>
                          <CheckCircle size={12}/> Confirm
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => reject.mutate(p.id)}><XCircle size={12}/></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!isLoading && !payments?.length && <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No payments found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modal==='confirm'} onClose={() => setModal(null)} title="Confirm Payment">
        {selected && (
          <>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between"><span className="text-gray-500">Client</span><span className="font-medium">{selected.users?.first_name} {selected.users?.last_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Loan</span><span className="font-mono">{selected.loans?.loan_ref}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Claimed</span><span className="font-semibold">{formatNaira(selected.amount)}</span></div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Actual Amount Received (₦)</label>
              <input type="number" value={actualAmt} onChange={e => setActualAmt(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setModal(null)}>Cancel</Button>
              <Button loading={confirm.isPending} onClick={() => confirm.mutate({ id:selected.id, actual:actualAmt })}>Confirm Payment</Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
