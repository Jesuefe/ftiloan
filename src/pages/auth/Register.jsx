import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Eye, EyeOff, User, Shield, CheckCircle2, ChevronRight } from 'lucide-react'

// ── Prembly via Supabase Edge Function (direct fetch, avoids CORS) ──────────
async function verifyWithPrembly(supabase, method, number, firstName, lastName) {
  const SUPABASE_URL = 'https://douswgukwnvuvktjshbx.supabase.co'
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdXN3Z3Vrd252dXZrdGpzaGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODk1ODAsImV4cCI6MjA5NjU2NTU4MH0.FZsx9DYixKBMAgmoLcloShTNM73k0liO88_A2EhOgyo'

  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-identity`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ method, number, first_name: firstName, last_name: lastName }),
  })

  if (!res.ok) throw new Error(`Verification service error (${res.status})`)
  const data = await res.json()
  if (!data) throw new Error('No response from verification service')
  return data
}

const STEPS = [
  { id: 1, label: 'Personal Info',  icon: User },
  { id: 2, label: 'Identity (KYC)', icon: Shield },
  { id: 3, label: 'Done',           icon: CheckCircle2 },
]

export default function Register() {
  const navigate   = useNavigate()
  const [step, setStep]       = useState(1)
  const [flash, setFlash]     = useState(null)
  const [showPw, setShowPw]   = useState(false)
  const [kycMethod, setKycMethod] = useState('bvn')
  const [kycNumber, setKycNumber] = useState('')
  const [kycResult, setKycResult] = useState(null)
  const [kycVerified, setKycVerified] = useState(false)
  const [kycSkipped,  setKycSkipped]  = useState(false)

  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    password: '', confirm_password: '',
    date_of_birth: '', residential_address: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // ── Step 1 validation ────────────────────────────────────────────────────
  const goToStep2 = () => {
    if (!form.first_name || !form.last_name) return setFlash({ type:'danger', msg:'Enter your first and last name.' })
    if (!form.email || !/\S+@\S+\.\S+/.test(form.email)) return setFlash({ type:'danger', msg:'Enter a valid email address.' })
    if (!form.phone || form.phone.length < 10) return setFlash({ type:'danger', msg:'Enter a valid phone number.' })
    if (!form.password || form.password.length < 8) return setFlash({ type:'danger', msg:'Password must be at least 8 characters.' })
    if (form.password !== form.confirm_password) return setFlash({ type:'danger', msg:'Passwords do not match.' })
    setFlash(null)
    setStep(2)
  }

  // ── KYC verification ─────────────────────────────────────────────────────
  const runKyc = useMutation({
    mutationFn: async () => {
      if (!kycNumber || kycNumber.length < 10) throw new Error('Enter a valid ID number (min 10 digits)')
      return await verifyWithPrembly(supabase, kycMethod, kycNumber, form.first_name, form.last_name)
    },
    onSuccess: (result) => {
      setKycResult(result)
      if (!result.success) {
        setFlash({ type:'danger', msg: result.message || `Identity could not be verified. Check your ${kycMethod.toUpperCase()} and try again.` })
        return
      }

      // Cross-check name against Prembly response
      const premblyFirst = (result.data?.firstName || '').toLowerCase().trim()
      const premblyLast  = (result.data?.lastName  || '').toLowerCase().trim()
      const userFirst    = (form.first_name || '').toLowerCase().trim()
      const userLast     = (form.last_name  || '').toLowerCase().trim()

      if (premblyFirst && premblyLast) {
        const nameMatch =
          (premblyFirst.includes(userFirst) || userFirst.includes(premblyFirst)) &&
          (premblyLast.includes(userLast)   || userLast.includes(premblyLast))

        if (!nameMatch) {
          setFlash({ type:'danger', msg:`Name mismatch — your ${kycMethod.toUpperCase()} is registered to "${result.data?.firstName} ${result.data?.lastName}" but you entered "${form.first_name} ${form.last_name}". Please use the exact name on your ${kycMethod.toUpperCase()}.` })
          return
        }
      }

      // Cross-check DOB if user provided one
      if (result.data?.dateOfBirth && form.date_of_birth) {
        const premblyDob = new Date(result.data.dateOfBirth).toISOString().slice(0, 10)
        if (premblyDob !== form.date_of_birth) {
          setFlash({ type:'warning', msg:`Date of birth does not match your ${kycMethod.toUpperCase()} records. You may proceed but this will be flagged for review.` })
        }
      }

      setKycVerified(true)
      setFlash({ type:'success', msg:`✅ Identity verified — ${result.data?.firstName} ${result.data?.lastName}` })
    },
    onError: (e) => setFlash({ type:'danger', msg: e.message }),
  })

  // ── Final registration ────────────────────────────────────────────────────
  const register = useMutation({
    mutationFn: async () => {
      // Check email not taken
      const { data: existing } = await supabase.from('users').select('id').eq('email', form.email.trim().toLowerCase()).maybeSingle()
      if (existing) throw new Error('Email already registered. Please log in.')

      // Hash password
      const { data: hashed, error: hashErr } = await supabase.rpc('hash_password', { p_password: form.password })
      if (hashErr) throw new Error('Registration failed. Please try again.')

      // Build user record
      const userData = {
        first_name:          form.first_name.trim(),
        last_name:           form.last_name.trim(),
        email:               form.email.trim().toLowerCase(),
        phone:               form.phone.trim(),
        password_hash:       hashed,
        role:                'client',
        status:              'active',
        date_of_birth:       form.date_of_birth || null,
        residential_address: form.residential_address || null,
        kyc_verified:        kycVerified,
      }

      // Store BVN/NIN from KYC
      if (kycVerified && kycNumber) {
        if (kycMethod === 'bvn') userData.bvn_number = kycNumber
        if (kycMethod === 'nin') userData.nin_number = kycNumber
      }

      const { data: user, error } = await supabase.from('users').insert(userData).select().single()
      if (error) throw error
      return user
    },
    onSuccess: () => {
      setStep(3)
      setFlash(null)
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  // ── Step indicator ───────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-1 mb-6">
      {STEPS.map((s, i) => {
        const Icon = s.icon
        const active   = step === s.id
        const complete = step > s.id
        return (
          <div key={s.id} className="flex items-center gap-1 flex-1">
            <div className={`flex items-center gap-1.5 flex-1 ${i > 0 ? 'justify-center' : ''}`}>
              {i > 0 && <div className={`h-px flex-1 ${complete ? 'bg-brand-500' : 'bg-gray-200'}`}/>}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                complete ? 'bg-brand-500' : active ? 'bg-brand-600 ring-2 ring-brand-200' : 'bg-gray-200'
              }`}>
                <Icon size={13} className={complete || active ? 'text-white' : 'text-gray-400'}/>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  // ── Step 3: Success ──────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <>
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 size={32} className="text-green-600"/>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Created!</h2>
          <p className="text-gray-500 text-sm mb-2">
            Welcome, {form.first_name}. Your account has been created successfully.
          </p>
          {kycVerified && (
            <div className="inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              <Shield size={12}/> Identity Verified
            </div>
          )}
          {kycSkipped && (
            <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1.5 rounded-full mb-4">
              ⚠️ Identity not verified — you can complete this from your profile
            </div>
          )}
          <Button className="w-full justify-center mt-2" onClick={() => navigate('/login')}>
            Sign In Now
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <h2 className="text-xl font-bold text-gray-900 font-display mb-1">Create Account</h2>
      <p className="text-gray-500 text-sm mb-4">Register to apply for a loan</p>

      <StepBar/>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* ── STEP 1: Personal Details ──────────────────────────────────── */}
      {step === 1 && (
        <>
          <div className="grid grid-cols-2 gap-x-3">
            <Input label="First Name *" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="Amaka"/>
            <Input label="Last Name *"  value={form.last_name}  onChange={e => set('last_name',  e.target.value)} placeholder="Okonkwo"/>
          </div>
          <Input label="Email Address *" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="you@example.com" autoComplete="email"/>
          <Input label="Phone Number *" value={form.phone} onChange={e => set('phone', e.target.value.replace(/\D/g,''))} placeholder="08012345678" maxLength={11}/>
          <Input label="Date of Birth" type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)}/>
          <Input label="Residential Address" value={form.residential_address} onChange={e => set('residential_address', e.target.value)} placeholder="House No, Street, Area, City"/>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password *</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm Password *</label>
            <input
              type="password"
              value={form.confirm_password}
              onChange={e => set('confirm_password', e.target.value)}
              placeholder="Repeat password"
              autoComplete="new-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>

          <Button onClick={goToStep2} className="w-full justify-center gap-2">
            Continue <ChevronRight size={15}/>
          </Button>

          <p className="mt-4 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-600 font-medium">Sign in</Link>
          </p>
        </>
      )}

      {/* ── STEP 2: KYC ──────────────────────────────────────────────── */}
      {step === 2 && (
        <>
          <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-700">
            <div className="font-semibold mb-1">🔒 Identity Verification</div>
            We verify your BVN or NIN to confirm your identity and protect your account. This is required to apply for loans.
          </div>

          {/* Method selector */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Method</label>
            <div className="grid grid-cols-2 gap-2">
              {[['bvn','BVN (Bank Verification Number)'],['nin','NIN (National ID Number)']].map(([v, l]) => (
                <label key={v} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium
                  ${kycMethod === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  <input type="radio" className="hidden" checked={kycMethod === v} onChange={() => { setKycMethod(v); setKycResult(null); setKycNumber('') }}/>
                  <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${kycMethod === v ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`}/>
                  {l}
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-1">{kycMethod.toUpperCase()} Number *</label>
            <input
              type="tel"
              value={kycNumber}
              onChange={e => { setKycNumber(e.target.value.replace(/\D/g,'')); setKycResult(null); setKycVerified(false) }}
              placeholder={`Enter your 11-digit ${kycMethod.toUpperCase()}`}
              maxLength={11}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg text-base font-mono font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-400 text-center"
            />
            <div className="text-xs text-gray-400 mt-1 text-center">{kycNumber.length}/11 digits</div>
          </div>

          {/* Verify button */}
          {!kycVerified && (
            <Button
              onClick={() => runKyc.mutate()}
              loading={runKyc.isPending}
              className="w-full justify-center gap-2 mb-3"
              variant={kycNumber.length === 11 ? 'primary' : 'outline'}
              disabled={kycNumber.length < 10}
            >
              <Shield size={15}/> Verify {kycMethod.toUpperCase()}
            </Button>
          )}

          {/* Verified result */}
          {kycVerified && (
            <div className="mb-4 p-3 bg-green-50 border border-green-300 rounded-xl flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0"/>
              <div>
                <div className="font-semibold text-green-800 text-sm">Identity Verified</div>
                <div className="text-xs text-green-600">{kycMethod.toUpperCase()}: {kycNumber.slice(0,3)}{'•'.repeat(5)}{kycNumber.slice(-3)}</div>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2 mt-2">
            <Button
              onClick={() => register.mutate()}
              loading={register.isPending}
              disabled={!kycVerified && !kycSkipped}
              className="w-full justify-center"
            >
              {kycVerified ? 'Create Account' : 'Verify to Continue'}
            </Button>

            {!kycVerified && (
              <button
                onClick={() => { setKycSkipped(true); register.mutate() }}
                disabled={register.isPending}
                className="text-xs text-gray-400 hover:text-gray-600 text-center py-2 underline-offset-2 hover:underline"
              >
                Skip verification for now (can complete later from profile)
              </button>
            )}
          </div>

          <button onClick={() => { setStep(1); setFlash(null) }} className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600 text-center py-1">
            ← Back
          </button>
        </>
      )}
    </>
  )
}
