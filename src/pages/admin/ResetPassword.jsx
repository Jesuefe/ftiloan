import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { KeyRound, Search } from 'lucide-react'

export default function AdminResetPassword() {
  const [search, setSearch] = useState('')
  const [found,  setFound]  = useState(null)
  const [newPw,  setNewPw]  = useState('')
  const [flash,  setFlash]  = useState(null)

  const lookup = useMutation({
    mutationFn: async () => {
      const { data } = await supabase.from('users')
        .select('id,first_name,last_name,email,role,phone')
        .or(`email.ilike.%${search}%,phone.ilike.%${search}%`)
        .single()
      if (!data) throw new Error('User not found')
      return data
    },
    onSuccess: (data) => { setFound(data); setFlash(null) },
    onError: e => { setFlash({ type:'danger', msg: e.message }); setFound(null) },
  })

  const resetPw = useMutation({
    mutationFn: async () => {
      if (!newPw || newPw.length < 6) throw new Error('Password must be at least 6 characters')
      const { data: hashed, error: hashErr } = await supabase.rpc('hash_password', { p_password: newPw })
      if (hashErr) throw new Error('Failed to hash password')
      const { error } = await supabase.from('users').update({ password_hash: hashed }).eq('id', found.id)
      if (error) throw error
    },
    onSuccess: () => {
      setFlash({ type:'success', msg:`Password reset for ${found.first_name} ${found.last_name}. New password: ${newPw}` })
      setNewPw('')
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-lg">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2"><KeyRound size={20} className="text-brand-600"/> Reset Password</h1>
        <p className="text-sm text-gray-500">Reset any user's password</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4 font-mono text-xs">{flash.msg}</Alert>}

      <Card className="mb-4">
        <CardHeader><div className="font-bold">Find User</div></CardHeader>
        <CardBody>
          <div className="flex gap-2">
            <Input label="Email or Phone" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or phone…" className="flex-1"/>
          </div>
          <Button loading={lookup.isPending} onClick={() => lookup.mutate()} className="w-full justify-center gap-2 mt-0">
            <Search size={15}/> Find User
          </Button>
        </CardBody>
      </Card>

      {found && (
        <Card>
          <CardHeader><div className="font-bold">Reset Password</div></CardHeader>
          <CardBody>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 text-sm">
              <div className="font-bold">{found.first_name} {found.last_name}</div>
              <div className="text-gray-500">{found.email} — {found.phone}</div>
              <div className="text-xs text-brand-600 capitalize mt-1">{found.role?.replace(/_/g,' ')}</div>
            </div>
            <Input label="New Password *" type="text" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Enter new password"/>
            <Button loading={resetPw.isPending} onClick={() => resetPw.mutate()} className="w-full justify-center" variant="danger">
              Reset Password
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
