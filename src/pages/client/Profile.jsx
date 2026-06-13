import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Eye, EyeOff, LogOut, Shield, CheckCircle2, Lock } from 'lucide-react'

const SUPABASE_URL = 'https://douswgukwnvuvktjshbx.supabase.co'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvdXN3Z3Vrd252dXZrdGpzaGJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5ODk1ODAsImV4cCI6MjA5NjU2NTU4MH0.FZsx9DYixKBMAgmoLcloShTNM73k0liO88_A2EhOgyo'

export default function ClientProfile() {
  const { profile, fetchProfile, signOut } = useAuthStore()
  const navigate = useNavigate()
  const [flash, setFlash]     = useState(null)
  const [showNin, setShowNin] = useState(false)
  const [showBvn, setShowBvn] = useState(false)

  // KYC verification state (for users who skipped during registration)
  const [kycMethod, setKycMethod] = useState('bvn')
  const [kycNumber, setKycNumber] = useState('')
  const [verifying, setVerifying] = useState(false)

  const [form, setForm] = useState({
    first_name:          profile?.first_name || '',
    last_name:           profile?.last_name  || '',
    phone:               profile?.phone      || '',
    residential_address: profile?.residential_address || '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const mask = (val) => {
    if (!val) return '—'
    const s = String(val)
    return s.slice(0, 3) + '•'.repeat(Math.max(0, s.length - 5)) + s.slice(-2)
  }

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('users').update(form).eq('id', profile.id)
      if (error) throw error
    },
    onSuccess: () => { fetchProfile(profile.id); setFlash({ type: 'success', msg: 'Profile updated.' }) },
    onError: e => setFlash({ type: 'danger', msg: e.message }),
  })

  // KYC verify on profile (for skipped users)
  const handleVerifyKyc = async () => {
    if (!kycNumber || kycNumber.length < 10) {
      setFlash({ type: 'danger', msg: 'Enter a valid 11-digit number.' }); return
    }
    setVerifying(true)
    setFlash(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-identity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          method: kycMethod,
          number: kycNumber,
          first_name: profile.first_name,
          last_name: profile.last_name,
        }),
      })
      const data = await res.json()

      if (!data.success) {
        setFlash({ type: 'danger', msg: data.message || 'Verification failed. Check the number and try again.' })
        setVerifying(false); return
      }

      // Cross-check name against Prembly response
      const premblyFirst = (data.data?.firstName || '').toLowerCase().trim()
      const premblyLast  = (data.data?.lastName  || '').toLowerCase().trim()
      const userFirst    = (profile.first_name   || '').toLowerCase().trim()
      const userLast     = (profile.last_name    || '').toLowerCase().trim()

      const nameMatch = premblyFirst && premblyLast &&
        (premblyFirst.includes(userFirst) || userFirst.includes(premblyFirst)) &&
        (premblyLast.includes(userLast)   || userLast.includes(premblyLast))

      // Cross-check DOB if available
      let dobMatch = true
      if (data.data?.dateOfBirth && profile.date_of_birth) {
        const premblyDob = new Date(data.data.dateOfBirth).toISOString().slice(0, 10)
        dobMatch = premblyDob === profile.date_of_birth
      }

      if (!nameMatch && premblyFirst) {
        setFlash({ type: 'danger', msg: `Name mismatch — Prembly returned "${data.data?.firstName} ${data.data?.lastName}" but your profile says "${profile.first_name} ${profile.last_name}". Update your profile name to match your ${kycMethod.toUpperCase()}.` })
        setVerifying(false); return
      }

      if (!dobMatch) {
        setFlash({ type: 'warning', msg: `Date of birth mismatch — please verify your date of birth matches your ${kycMethod.toUpperCase()} records.` })
      }

      // Save to DB
      const update = {
        kyc_verified: true,
        [`${kycMethod}_number`]: kycNumber,
      }
      if (data.data?.dateOfBirth && !profile.date_of_birth) {
        update.date_of_birth = new Date(data.data.dateOfBirth).toISOString().slice(0, 10)
      }

      await supabase.from('users').update(update).eq('id', profile.id)
      await fetchProfile(profile.id)
      setKycNumber('')
      setFlash({ type: 'success', msg: `${kycMethod.toUpperCase()} verified successfully. Identity confirmed.` })
    } catch (e) {
      setFlash({ type: 'danger', msg: e.message })
    }
    setVerifying(false)
  }

  const initials = `${profile?.first_name?.[0] || ''}${profile?.last_name?.[0] || ''}`
  const isVerified = profile?.kyc_verified
  const hasBvn = !!profile?.bvn_number
  const hasNin = !!profile?.nin_number

  return (
    <div className="max-w-lg pb-6">
      {/* Avatar header */}
      <div className="flex flex-col items-center mb-6">
        <div className="relative">
          <div className="w-20 h-20 rounded-full bg-brand-600 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg">
            {initials}
          </div>
          {isVerified && (
            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
              <Shield size={13} className="text-white"/>
            </div>
          )}
        </div>
        <div className="text-lg font-bold text-gray-900 mt-1">{profile?.first_name} {profile?.last_name}</div>
        <div className="text-sm text-gray-400 capitalize mt-0.5">{profile?.role?.replace(/_/g, ' ')}</div>
        <div className="text-xs text-gray-400 mt-0.5">{profile?.email}</div>
        {isVerified
          ? <div className="mt-2 inline-flex items-center gap-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-medium px-3 py-1 rounded-full"><Shield size={11}/> Identity Verified</div>
          : <div className="mt-2 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium px-3 py-1 rounded-full">Identity Not Verified</div>
        }
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Personal Info */}
      <Card className="mb-4">
        <CardHeader><div className="font-bold">Personal Information</div></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4">
            <Input label="First Name" value={form.first_name} onChange={e => set('first_name', e.target.value)}/>
            <Input label="Last Name"  value={form.last_name}  onChange={e => set('last_name',  e.target.value)}/>
          </div>
          <Input label="Email" value={profile?.email || ''} disabled className="opacity-60"/>
          <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="080xxxxxxxx"/>
          <Input label="Date of Birth" type="date" value={profile?.date_of_birth || ''} disabled className="opacity-60"/>
          <Input label="Residential Address" value={form.residential_address} onChange={e => set('residential_address', e.target.value)} placeholder="Your full address"/>
          <Button loading={save.isPending} onClick={() => save.mutate()} className="w-full justify-center mt-2">
            Save Changes
          </Button>
        </CardBody>
      </Card>

      {/* Identity — BVN & NIN */}
      <Card className="mb-4">
        <CardHeader>
          <div className="font-bold">Identity Verification</div>
          {isVerified && <span className="text-xs text-green-600 font-medium">Verified</span>}
        </CardHeader>
        <CardBody>
          {/* BVN */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-1">BVN</div>
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <span className="font-mono text-sm text-gray-900">
                {showBvn ? (profile?.bvn_number || '—') : mask(profile?.bvn_number)}
              </span>
              {profile?.bvn_number && (
                <button onClick={() => setShowBvn(v => !v)} className="text-gray-400 hover:text-gray-700 ml-2 p-1">
                  {showBvn ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              )}
              {!profile?.bvn_number && <span className="text-xs text-gray-400">Not provided</span>}
            </div>
          </div>

          {/* NIN */}
          <div className="mb-4">
            <div className="text-sm font-semibold text-gray-700 mb-1">NIN</div>
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <span className="font-mono text-sm text-gray-900">
                {showNin ? (profile?.nin_number || '—') : mask(profile?.nin_number)}
              </span>
              {profile?.nin_number && (
                <button onClick={() => setShowNin(v => !v)} className="text-gray-400 hover:text-gray-700 ml-2 p-1">
                  {showNin ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              )}
              {!profile?.nin_number && <span className="text-xs text-gray-400">Not provided</span>}
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-4">
            Your identity details are secured. Tap the eye icon to reveal.
          </p>

          {/* Verify section — show if not verified OR missing BVN/NIN */}
          {(!isVerified || (!hasBvn && !hasNin)) && (
            <div className="border-t border-gray-100 pt-4">
              <div className="text-sm font-semibold text-gray-700 mb-3">
                {isVerified ? 'Add Another ID' : 'Verify Your Identity'}
              </div>

              {/* Method selector */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {[['bvn', 'BVN'], ['nin', 'NIN']].map(([v, l]) => (
                  <label key={v} className={`flex items-center gap-2 p-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium transition-all
                    ${kycMethod === v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                    <input type="radio" className="hidden" checked={kycMethod === v} onChange={() => { setKycMethod(v); setKycNumber('') }}/>
                    <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 ${kycMethod === v ? 'border-brand-500 bg-brand-500' : 'border-gray-300'}`}/>
                    {l}
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="tel"
                  value={kycNumber}
                  onChange={e => setKycNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder={`11-digit ${kycMethod.toUpperCase()}`}
                  maxLength={11}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
                <Button
                  onClick={handleVerifyKyc}
                  loading={verifying}
                  disabled={kycNumber.length < 11}
                  className="gap-1.5 whitespace-nowrap"
                >
                  <Shield size={14}/> Verify
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Your name and date of birth will be cross-checked against the {kycMethod.toUpperCase()} records.
              </p>
            </div>
          )}

          {/* Already verified with both */}
          {isVerified && hasBvn && hasNin && (
            <div className="flex items-center gap-2 text-xs text-green-600">
              <CheckCircle2 size={14}/> BVN and NIN both verified
            </div>
          )}
        </CardBody>
      </Card>

      {/* Change password */}
      <Link
        to="/client/change-password"
        className="mb-3 w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
      >
        <Lock size={16}/> Change Password
      </Link>

      {/* Sign out */}
      <button
        onClick={() => { signOut(); navigate('/login') }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
      >
        <LogOut size={16}/> Sign Out
      </button>
    </div>
  )
}
