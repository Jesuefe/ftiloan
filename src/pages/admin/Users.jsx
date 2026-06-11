import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils'
import { Search, PlusCircle } from 'lucide-react'

export default function AdminUsers() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [flash, setFlash]   = useState(null)
  const [form, setForm]     = useState({ first_name:'', last_name:'', email:'', phone:'', role:'agent', password:'' })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin-users', search],
    queryFn: async () => {
      let q = supabase.from('users').select('id,first_name,last_name,email,phone,role,status,created_at')
        .neq('role','client').order('created_at', { ascending:false })
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const createUser = useMutation({
    mutationFn: async () => {
      const { data: hashed } = await supabase.rpc('hash_password', { p_password: form.password })
      const { error } = await supabase.from('users').insert({ first_name: form.first_name, last_name: form.last_name, email: form.email, phone: form.phone, password_hash: hashed, status:'active' })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['admin-users'] }); setModal(false); setFlash({ type:'success', msg:'User created.' }) },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }) => { await supabase.from('users').update({ status: status==='active'?'suspended':'active' }).eq('id',id) },
    onSuccess: () => qc.invalidateQueries({ queryKey:['admin-users'] }),
  })

  const ROLES = ['super_admin','manager','agent','auditor','operator','security_officer','editor']
  const roleColor = r => ({ super_admin:'purple', manager:'blue', agent:'green', auditor:'amber', operator:'gray', security_officer:'red', editor:'gray' }[r] || 'gray')

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div><h1 className="text-xl font-bold">Staff Users</h1><p className="text-sm text-gray-500">{users?.length||0} staff members</p></div>
        <Button onClick={() => setModal(true)} className="gap-2"><PlusCircle size={15}/> Add User</Button>
      </div>
      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={15} className="text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" className="bg-transparent text-sm outline-none w-full"/>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Role</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Joined</th>
            <th className="px-4 py-3"></th>
          </tr></thead>
          <tbody>
            {users?.map(u => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-medium">{u.first_name} {u.last_name}</div><div className="text-xs text-gray-400">{u.email}</div></td>
                <td className="px-4 py-3"><Badge color={roleColor(u.role)} className="capitalize">{u.role?.replace(/_/g,' ')}</Badge></td>
                <td className="px-4 py-3"><Badge color={u.status==='active'?'green':'red'}>{u.status}</Badge></td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(u.created_at)}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="outline" onClick={() => toggleStatus.mutate({ id:u.id, status:u.status })}>
                    {u.status==='active'?'Suspend':'Activate'}
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && !users?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found</td></tr>}
          </tbody>
        </table>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Create Staff User">
        <div className="grid grid-cols-2 gap-x-4">
          <Input label="First Name" value={form.first_name} onChange={e => set('first_name',e.target.value)}/>
          <Input label="Last Name"  value={form.last_name}  onChange={e => set('last_name', e.target.value)}/>
        </div>
        <Input label="Email" type="email" value={form.email} onChange={e => set('email',e.target.value)}/>
        <Input label="Phone" value={form.phone} onChange={e => set('phone',e.target.value)}/>
        <Select label="Role" value={form.role} onChange={e => set('role',e.target.value)}>
          {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
        </Select>
        <Input label="Password" type="password" value={form.password} onChange={e => set('password',e.target.value)}/>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button loading={createUser.isPending} onClick={() => createUser.mutate()}>Create User</Button>
        </div>
      </Modal>
    </div>
  )
}
