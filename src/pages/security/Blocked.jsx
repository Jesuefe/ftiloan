import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils'
import { Shield, PlusCircle, Unlock } from 'lucide-react'

export default function SecurityBlocked() {
  const qc = useQueryClient()
  const [modal, setModal]   = useState(false)
  const [flash, setFlash]   = useState(null)
  const [form, setForm]     = useState({ ip_address:'', reason:'' })

  const { data: blocked, isLoading } = useQuery({
    queryKey: ['blocked-ips'],
    queryFn: async () => {
      const { data } = await supabase.from('blocked_ips').select('*').order('created_at', { ascending:false })
      return data || []
    },
  })

  const block = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('blocked_ips').insert({ ...form, is_active:true })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['blocked-ips'] }); setModal(false); setFlash({ type:'success', msg:'IP blocked.' }) },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const unblock = useMutation({
    mutationFn: async (id) => { await supabase.from('blocked_ips').update({ is_active:false }).eq('id',id) },
    onSuccess: () => qc.invalidateQueries({ queryKey:['blocked-ips'] }),
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-xl font-bold flex items-center gap-2"><Shield size={20} className="text-red-600"/> Blocked IPs</h1><p className="text-sm text-gray-500">{blocked?.filter(b=>b.is_active).length||0} active blocks</p></div>
        <Button onClick={() => setModal(true)} variant="danger" className="gap-2"><PlusCircle size={15}/> Block IP</Button>
      </div>
      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {['IP Address','Reason','Status','Date',''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {blocked?.map(b => (
              <tr key={b.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono font-semibold">{b.ip_address}</td>
                <td className="px-4 py-3 text-gray-600">{b.reason || '—'}</td>
                <td className="px-4 py-3"><Badge color={b.is_active?'red':'gray'}>{b.is_active?'Blocked':'Unblocked'}</Badge></td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(b.created_at)}</td>
                <td className="px-4 py-3">
                  {b.is_active && <Button size="sm" variant="outline" className="gap-1" onClick={() => unblock.mutate(b.id)}><Unlock size={12}/> Unblock</Button>}
                </td>
              </tr>
            ))}
            {!isLoading && !blocked?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No blocked IPs</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Block IP Address">
        <Input label="IP Address" value={form.ip_address} onChange={e => setForm(f=>({...f,ip_address:e.target.value}))} placeholder="e.g. 192.168.1.1"/>
        <Input label="Reason" value={form.reason} onChange={e => setForm(f=>({...f,reason:e.target.value}))} placeholder="Why blocking this IP?"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button variant="danger" loading={block.isPending} onClick={() => block.mutate()}>Block IP</Button>
        </div>
      </Modal>
    </div>
  )
}
