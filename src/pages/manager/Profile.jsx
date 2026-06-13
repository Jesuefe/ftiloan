import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { User, LogOut } from 'lucide-react'

export default function Profile() {
  const { profile, fetchProfile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({
    first_name: profile?.first_name || '',
    last_name:  profile?.last_name  || '',
    phone:      profile?.phone      || '',
    residential_address: profile?.residential_address || '',
  })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('users').update(form).eq('id', profile.id)
      if (error) throw error
    },
    onSuccess: () => { fetchProfile(profile.id); setFlash({ type:'success', msg:'Profile updated.' }) },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <User size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 capitalize">{profile?.role?.replace(/_/g,' ')}</p>
        </div>
      </div>
      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}
      <Card>
        <CardHeader><div className="font-bold">Personal Information</div></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4">
            <Input label="First Name" value={form.first_name} onChange={e => set('first_name', e.target.value)}/>
            <Input label="Last Name"  value={form.last_name}  onChange={e => set('last_name',  e.target.value)}/>
          </div>
          <Input label="Email" value={profile?.email || ''} disabled className="opacity-60"/>
          <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)}/>
          <Input label="Address" value={form.residential_address} onChange={e => set('residential_address', e.target.value)}/>
          <Button loading={save.isPending} onClick={() => save.mutate()} className="w-full justify-center">Save Changes</Button>
        </CardBody>
      </Card>

      <button
        onClick={() => { signOut(); navigate('/login') }}
        className="mt-4 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
      >
        <LogOut size={16}/> Sign Out
      </button>
    </div>
  )
}
