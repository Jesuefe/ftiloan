import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Eye, EyeOff, Lock } from 'lucide-react'

export default function ClientChangePassword() {
  const { profile } = useAuthStore()
  const [flash, setFlash]       = useState(null)
  const [showOld, setShowOld]   = useState(false)
  const [showNew, setShowNew]   = useState(false)
  const [showCon, setShowCon]   = useState(false)
  const [form, setForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const change = useMutation({
    mutationFn: async () => {
      if (!form.old_password) throw new Error('Enter your current password')
      if (!form.new_password || form.new_password.length < 8) throw new Error('New password must be at least 8 characters')
      if (form.new_password !== form.confirm) throw new Error('Passwords do not match')

      // Verify current password
      const { data: valid, error: verErr } = await supabase.rpc('verify_user_password', {
        p_email: profile.email,
        p_password: form.old_password,
      })
      if (verErr || !valid) throw new Error('Current password is incorrect')

      // Hash and update new password
      const { data: hashed, error: hashErr } = await supabase.rpc('hash_password', { p_password: form.new_password })
      if (hashErr) throw new Error('Failed to update password')

      const { error } = await supabase.from('users').update({ password_hash: hashed }).eq('id', profile.id)
      if (error) throw error
    },
    onSuccess: () => {
      setForm({ old_password: '', new_password: '', confirm: '' })
      setFlash({ type: 'success', msg: 'Password changed successfully.' })
    },
    onError: e => setFlash({ type: 'danger', msg: e.message }),
  })

  const PasswordInput = ({ label, field, show, toggle }) => (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={form[field]}
          onChange={e => set(field, e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
        <button type="button" onClick={toggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
          {show ? <EyeOff size={16}/> : <Eye size={16}/>}
        </button>
      </div>
    </div>
  )

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background:'rgba(27,42,107,0.08)' }}>
          <Lock size={18} style={{ color:'#1B2A6B' }}/>
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
          <p className="text-sm text-gray-500">Set a password you can remember</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <Card>
        <CardHeader><div className="font-bold">Update Your Password</div></CardHeader>
        <CardBody>
          <PasswordInput label="Current Password" field="old_password" show={showOld} toggle={() => setShowOld(v=>!v)}/>
          <PasswordInput label="New Password (min. 8 characters)" field="new_password" show={showNew} toggle={() => setShowNew(v=>!v)}/>
          <PasswordInput label="Confirm New Password" field="confirm" show={showCon} toggle={() => setShowCon(v=>!v)}/>

          {/* Password strength hint */}
          {form.new_password.length > 0 && (
            <div className="mb-4">
              <div className="flex gap-1 mb-1">
                {[...Array(4)].map((_,i) => {
                  const strength = form.new_password.length >= 12 ? 4 : form.new_password.length >= 10 ? 3 : form.new_password.length >= 8 ? 2 : 1
                  return <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? 'bg-brand-500' : 'bg-gray-200'}`}/>
                })}
              </div>
              <p className="text-xs text-gray-400">
                {form.new_password.length < 8 ? 'Too short' : form.new_password.length < 10 ? 'Weak' : form.new_password.length < 12 ? 'Good' : 'Strong'}
              </p>
            </div>
          )}

          <Button loading={change.isPending} onClick={() => change.mutate()} className="w-full justify-center">
            Update Password
          </Button>
        </CardBody>
      </Card>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <strong>Tip:</strong> Use a mix of letters, numbers and symbols. Avoid using your name or date of birth.
      </div>
    </div>
  )
}
