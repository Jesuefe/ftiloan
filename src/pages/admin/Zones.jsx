import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Alert } from '@/components/ui/Alert'
import { PlusCircle } from 'lucide-react'

export default function AdminZones() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({ name:'', state:'FCT' })
  const [flash, setFlash] = useState(null)

  const { data: zones, isLoading } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => { const { data } = await supabase.from('zones').select('*').order('name'); return data||[] },
  })

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('zones').insert(form)
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['zones'] }); setModal(false); setForm({ name:'', state:'FCT' }); setFlash({ type:'success', msg:'Zone created.' }) },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }) => { await supabase.from('zones').update({ is_active: !is_active }).eq('id', id) },
    onSuccess: () => qc.invalidateQueries({ queryKey:['zones'] }),
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-xl font-bold text-gray-900">Zones</h1><p className="text-sm text-gray-500">Manage operational zones</p></div>
        <Button onClick={() => setModal(true)} className="gap-2"><PlusCircle size={15}/> Add Zone</Button>
      </div>
      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {zones?.map(z => (
          <div key={z.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="font-bold mb-1">{z.name}</div>
            <div className="text-xs text-gray-400 mb-3">{z.state}</div>
            <div className="flex items-center justify-between">
              <Badge color={z.is_active?'green':'gray'}>{z.is_active?'Active':'Inactive'}</Badge>
              <button onClick={() => toggle.mutate({ id:z.id, is_active:z.is_active })}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                {z.is_active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Add Zone">
        <Input label="Zone Name" value={form.name} onChange={e => setForm(f => ({...f,name:e.target.value}))} placeholder="e.g. AMAC"/>
        <Input label="State" value={form.state} onChange={e => setForm(f => ({...f,state:e.target.value}))} placeholder="e.g. FCT"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button loading={create.isPending} onClick={() => create.mutate()}>Create Zone</Button>
        </div>
      </Modal>
    </div>
  )
}
