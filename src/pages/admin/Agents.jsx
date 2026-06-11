import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatDate } from '@/lib/utils'
import { Search, PlusCircle, UserCheck } from 'lucide-react'

export default function AdminAgents() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal]   = useState(false)
  const [flash, setFlash]   = useState(null)
  const [form, setForm]     = useState({
    first_name:'', last_name:'', email:'', phone:'',
    password:'', zone_id:'', commission_rate:'0', max_clients:'50'
  })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const { data: zones } = useQuery({
    queryKey: ['zones'],
    queryFn: async () => { const { data } = await supabase.from('zones').select('*').eq('is_active',true).order('name'); return data||[] },
  })

  const { data: agents, isLoading } = useQuery({
    queryKey: ['admin-agents', search],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select(`id, status, max_clients, current_clients_count, commission_rate, created_at,
          users!agents_user_id_fkey(id,first_name,last_name,email,phone,status,staff_code),
          zones(name)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      let result = data || []
      if (search) result = result.filter(a =>
        `${a.users?.first_name} ${a.users?.last_name} ${a.users?.email}`.toLowerCase().includes(search.toLowerCase())
      )
      return result
    },
  })

  const createAgent = useMutation({
    mutationFn: async () => {
      // Hash password
      const { data: hashed, error: hashErr } = await supabase.rpc('hash_password', { p_password: form.password })
      if (hashErr) throw new Error('Password hash failed')

      // Generate staff code
      const agentCount = agents?.length || 0
      const staffCode  = `FTI-AGENT-${String(agentCount + 1).padStart(4,'0')}`

      // Create user
      const { data: user, error: userErr } = await supabase.from('users').insert({
        first_name: form.first_name, last_name: form.last_name,
        email: form.email, phone: form.phone,
        password_hash: hashed, role: 'agent', status: 'active',
        zone_id: form.zone_id || null, staff_code: staffCode,
      }).select().single()
      if (userErr) throw userErr

      // Create agent record
      const { error: agentErr } = await supabase.from('agents').insert({
        user_id: user.id, zone_id: form.zone_id || null,
        status: 'active', max_clients: Number(form.max_clients),
        commission_rate: Number(form.commission_rate),
      })
      if (agentErr) throw agentErr
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-agents'] })
      setModal(false)
      setForm({ first_name:'', last_name:'', email:'', phone:'', password:'', zone_id:'', commission_rate:'0', max_clients:'50' })
      setFlash({ type:'success', msg:'Agent created successfully.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const toggleStatus = useMutation({
    mutationFn: async ({ agentId, userId, status }) => {
      const newStatus = status === 'active' ? 'suspended' : 'active'
      await supabase.from('agents').update({ status: newStatus }).eq('id', agentId)
      await supabase.from('users').update({ status: newStatus }).eq('id', userId)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-agents'] }),
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <UserCheck size={20} className="text-brand-600"/> Agents
          </h1>
          <p className="text-sm text-gray-500">{agents?.length || 0} registered agents</p>
        </div>
        <Button onClick={() => setModal(true)} className="gap-2">
          <PlusCircle size={15}/> Add Agent
        </Button>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={15} className="text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search agents…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 py-8 text-center text-gray-400">Loading…</div>}
        {agents?.map(agent => (
          <Card key={agent.id}>
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-sm flex-shrink-0">
                    {agent.users?.first_name?.[0]}{agent.users?.last_name?.[0]}
                  </div>
                  <div>
                    <div className="font-bold text-gray-900">{agent.users?.first_name} {agent.users?.last_name}</div>
                    <div className="text-xs text-gray-400 font-mono">{agent.users?.staff_code}</div>
                  </div>
                </div>
                <Badge color={agent.status === 'active' ? 'green' : 'red'}>{agent.status}</Badge>
              </div>

              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Email</span>
                  <span className="font-medium truncate max-w-[55%]">{agent.users?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Phone</span>
                  <span className="font-medium">{agent.users?.phone || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Zone</span>
                  <span className="font-medium">{agent.zones?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Clients</span>
                  <span className="font-medium">{agent.current_clients_count} / {agent.max_clients}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Commission</span>
                  <span className="font-medium">{agent.commission_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Joined</span>
                  <span className="text-gray-500">{formatDate(agent.created_at)}</span>
                </div>
              </div>

              <Button
                variant={agent.status === 'active' ? 'danger' : 'outline'}
                size="sm"
                className="w-full justify-center"
                onClick={() => toggleStatus.mutate({ agentId: agent.id, userId: agent.users?.id, status: agent.status })}>
                {agent.status === 'active' ? 'Suspend Agent' : 'Activate Agent'}
              </Button>
            </CardBody>
          </Card>
        ))}
        {!isLoading && !agents?.length && (
          <div className="col-span-3 py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No agents yet. <button onClick={() => setModal(true)} className="text-brand-600 font-medium">Create one</button>
          </div>
        )}
      </div>

      <Modal open={modal} onClose={() => setModal(false)} title="Create New Agent" size="lg">
        <div className="grid grid-cols-2 gap-x-4">
          <Input label="First Name *" value={form.first_name} onChange={e => set('first_name', e.target.value)}/>
          <Input label="Last Name *"  value={form.last_name}  onChange={e => set('last_name',  e.target.value)}/>
        </div>
        <Input label="Email *" type="email" value={form.email} onChange={e => set('email', e.target.value)}/>
        <div className="grid grid-cols-2 gap-x-4">
          <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="08012345678"/>
          <Input label="Password *" type="password" value={form.password} onChange={e => set('password', e.target.value)}/>
        </div>
        <div className="grid grid-cols-2 gap-x-4">
          <Select label="Zone" value={form.zone_id} onChange={e => set('zone_id', e.target.value)}>
            <option value="">— Select zone —</option>
            {zones?.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </Select>
          <Input label="Max Clients" type="number" value={form.max_clients} onChange={e => set('max_clients', e.target.value)}/>
        </div>
        <Input label="Commission Rate (%)" type="number" value={form.commission_rate} onChange={e => set('commission_rate', e.target.value)} placeholder="0"/>
        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button loading={createAgent.isPending} onClick={() => createAgent.mutate()}>Create Agent</Button>
        </div>
      </Modal>
    </div>
  )
}
