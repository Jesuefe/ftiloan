import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Eye, EyeOff } from 'lucide-react'

export default function Register() {
  const navigate  = useNavigate()
  const [step, setStep]   = useState(1) // 1=form, 2=otp
  const [flash, setFlash] = useState(null)
  const [showPw, setShowPw] = useState(false)
  const [otp, setOtp]     = useState('')
  const [pendingUser, setPendingUser] = useState(null)
  const [form, setForm]   = useState({
    first_name:'', last_name:'', email:'', phone:'',
    password:'', date_of_birth:'', residential_address:'',
  })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const register = useMutation({
    mutationFn: async () => {
      if (!form.first_name || !form.last_name || !form.email || !form.password)
        throw new Error('Please fill in all required fields')
      if (form.password.length < 8)
        throw new Error('Password must be at least 8 characters')

      // Check email not taken
      const { data: existing } = await supabase.from('users').select('id').eq('email', form.email.trim()).single()
      if (existing) throw new Error('Email already registered. Please log in.')

      // Hash password
      const { data: hashed, error: hashErr } = await supabase.rpc('hash_password', { p_password: form.password })
      if (hashErr) throw new Error('Registration failed. Please try again.')

      // Create user as pending_approval
      const { data: user, error } = await supabase.from('users').insert({
        first_name: form.first_name.trim(),
        last_name:  form.last_name.trim(),
        email:      form.email.trim().toLowerCase(),
        phone:      form.phone.trim(),
        password_hash: hashed,
        role: 'client',
        status: 'active',
        date_of_birth: form.date_of_birth || null,
        residential_address: form.residential_address || null,
      }).select().single()
      if (error) throw error
      return user
    },
    onSuccess: (user) => {
      setPendingUser(user)
      setFlash({ type:'success', msg:'Account created! You can now log in.' })
      setTimeout(() => navigate('/login'), 1500)
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 font-display mb-1">Create Account</h2>
      <p className="text-gray-500 text-sm mb-6">Register to apply for a business loan</p>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="grid grid-cols-2 gap-x-3">
        <Input label="First Name *" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Amaka"/>
        <Input label="Last Name *"  value={form.last_name}  onChange={e => set('last_name',  e.target.value)} placeholder="Okonkwo"/>
      </div>
      <Input label="Email Address *" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com"/>
      <Input label="Phone Number *" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="08012345678"/>
      <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/>
      <Input label="Residential Address" value={form.residential_address} onChange={e => set('residential_address', e.target.value)} placeholder="House No, Street, Area"/>

      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-1">Password *</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={form.password}
            onChange={e => set('password', e.target.value)}
            placeholder="Min. 8 characters"
            className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
          </button>
        </div>
      </div>

      <Button onClick={() => register.mutate()} loading={register.isPending} className="w-full justify-center">
        Create Account
      </Button>

      <p className="mt-4 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 font-medium hover:text-brand-700">Sign in</Link>
      </p>
    </>
  )
}
