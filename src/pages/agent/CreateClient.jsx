import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { UserPlus } from 'lucide-react'

function generatePassword(firstName, dob) {
  if (!firstName || !dob) return Math.random().toString(36).slice(-8) + '@1'
  const d = new Date(dob)
  const dd = String(d.getDate()).padStart(2,'0')
  const mm = String(d.getMonth()+1).padStart(2,'0')
  const yyyy = d.getFullYear()
  return `${firstName.charAt(0).toUpperCase()}${firstName.slice(1).toLowerCase()}@${dd}${mm}${yyyy}`
}

export default function CreateClient() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({
    first_name:'', last_name:'', email:'', phone:'',
    date_of_birth:'', lga:'', residential_address:'',
    bvn_number:'', nin_number:'',
  })

  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  const create = useMutation({
    mutationFn: async () => {
      const password = generatePassword(form.first_name, form.date_of_birth)
      const { data: existing } = await supabase.from('users').select('id').eq('email', form.email).single()
      if (existing) throw new Error('Email already registered')

      // Hash password via RPC
      const { data: hashed, error: hashErr } = await supabase.rpc('hash_password', { p_password: password })
      if (hashErr) throw new Error('Could not hash password')

      // Get agent's zone
      const { data: agent } = await supabase.from('agents').select('id,zone_id').eq('user_id', profile.id).single()

      const { data: user, error } = await supabase.from('users').insert({
        first_name:          form.first_name,
        last_name:           form.last_name,
        email:               form.email,
        phone:               form.phone,
        date_of_birth:       form.date_of_birth || null,
        lga:                 form.lga || null,
        residential_address: form.residential_address || null,
        bvn_number:          form.bvn_number || null,
        nin_number:          form.nin_number || null,
        password_hash:       hashed,
        role:                'client',
        status:              'active',
        zone_id:             agent?.zone_id || null,
      }).select().single()

      if (error) throw error
      return { user, password }
    },
    onSuccess: ({ user, password }) => {
      setFlash({
        type: 'success',
        msg: `Client created! Login: ${form.email} | Password: ${password}`,
      })
      setForm({ first_name:'', last_name:'', email:'', phone:'', date_of_birth:'', lga:'', residential_address:'', bvn_number:'', nin_number:'' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <UserPlus size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Create New Client</h1>
          <p className="text-sm text-gray-500">Register a new client and send them their login credentials</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4 font-mono text-xs">{flash.msg}</Alert>}

      <Card>
        <CardHeader><div className="font-bold">Client Information</div></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4">
            <Input label="First Name *" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="e.g. Amaka"/>
            <Input label="Last Name *"  value={form.last_name}  onChange={e => set('last_name',  e.target.value)} placeholder="e.g. Okonkwo"/>
          </div>
          <Input label="Email Address *" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="client@email.com"/>
          <div className="grid grid-cols-2 gap-x-4">
            <Input label="Phone Number *" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="08012345678"/>
            <Input label="Date of Birth *" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/>
          </div>
          <Input label="Residential Address" value={form.residential_address} onChange={e => set('residential_address', e.target.value)} placeholder="House No, Street, Area"/>
          <Input label="LGA" value={form.lga} onChange={e => set('lga', e.target.value)} placeholder="Local Government Area"/>
          <div className="grid grid-cols-2 gap-x-4">
            <Input label="BVN" value={form.bvn_number} onChange={e => set('bvn_number', e.target.value)} placeholder="11-digit BVN" maxLength={11}/>
            <Input label="NIN" value={form.nin_number} onChange={e => set('nin_number', e.target.value)} placeholder="11-digit NIN" maxLength={11}/>
          </div>

          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 mb-4">
            Password will be auto-generated as <strong>Firstname@DDMMYYYY</strong> and shown after creation.
          </div>

          <Button loading={create.isPending} onClick={() => create.mutate()} className="w-full justify-center">
            <UserPlus size={15}/> Create Client
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
