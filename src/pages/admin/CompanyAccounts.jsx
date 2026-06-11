import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { PlusCircle, Building2 } from 'lucide-react'

export default function AdminCompanyAccounts() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({ bank_name:'', account_number:'', account_name:'' })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const { data: accounts } = useQuery({
    queryKey: ['company-accounts'],
    queryFn: async () => {
      const { data } = await supabase.from('company_accounts').select('*').order('created_at',{ascending:false})
      return data || []
    },
  })

  const add = useMutation({
    mutationFn: async () => {
      if (!form.bank_name || !form.account_number || !form.account_name) throw new Error('All fields required')
      const { error } = await supabase.from('company_accounts').insert({ ...form, created_by: profile.id })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['company-accounts'] }); setModal(false); setForm({ bank_name:'', account_number:'', account_name:'' }); setFlash({ type:'success', msg:'Account added.' }) },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const toggle = useMutation({
    mutationFn: async ({ id, is_active }) => { await supabase.from('company_accounts').update({ is_active: !is_active }).eq('id',id) },
    onSuccess: () => qc.invalidateQueries({ queryKey:['company-accounts'] }),
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Building2 size={20} className="text-brand-600"/> Company Bank Accounts</h1>
          <p className="text-sm text-gray-500">Accounts clients pay into</p>
        </div>
        <Button onClick={() => setModal(true)} className="gap-2"><PlusCircle size={15}/> Add Account</Button>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts?.map(a => (
          <Card key={a.id} className={a.is_active ? '' : 'opacity-60'}>
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 bg-brand-100 rounded-lg flex items-center justify-center text-brand-700 font-bold text-sm">
                  {a.bank_name?.slice(0,2).toUpperCase()}
                </div>
                <Badge color={a.is_active?'green':'gray'}>{a.is_active?'Active':'Inactive'}</Badge>
              </div>
              <div className="font-bold text-gray-900 mb-1">{a.bank_name}</div>
              <div className="font-mono text-lg font-bold text-brand-600 mb-0.5">{a.account_number}</div>
              <div className="text-sm text-gray-500 mb-4">{a.account_name}</div>
              <Button size="sm" variant={a.is_active?'danger':'outline'} className="w-full justify-center"
                onClick={() => toggle.mutate({ id:a.id, is_active:a.is_active })}>
                {a.is_active ? 'Deactivate' : 'Activate'}
              </Button>
            </CardBody>
          </Card>
        ))}
        {!accounts?.length && (
          <div className="col-span-3 py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No accounts yet. <button onClick={() => setModal(true)} className="text-brand-600 font-medium">Add one</button>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Add Bank Account">
        <Input label="Bank Name *" value={form.bank_name} onChange={e => set('bank_name',e.target.value)} placeholder="e.g. GTBank"/>
        <Input label="Account Number *" value={form.account_number} onChange={e => set('account_number',e.target.value)} placeholder="10-digit account number" maxLength={10}/>
        <Input label="Account Name *" value={form.account_name} onChange={e => set('account_name',e.target.value)} placeholder="Account holder name"/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button loading={add.isPending} onClick={() => add.mutate()}>Add Account</Button>
        </div>
      </Modal>
    </div>
  )
}
