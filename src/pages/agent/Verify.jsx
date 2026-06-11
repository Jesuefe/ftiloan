import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Shield, Search } from 'lucide-react'

export default function AgentVerify() {
  const qc = useQueryClient()
  const [method, setMethod] = useState('bvn')
  const [number, setNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [flash, setFlash]   = useState(null)
  const [result, setResult] = useState(null)

  const verify = useMutation({
    mutationFn: async () => {
      if (!number.trim()) throw new Error('Please enter an ID number')
      // Call Supabase Edge Function for Prembly verification
      const { data, error } = await supabase.functions.invoke('verify-identity', {
        body: { method, number: number.trim(), first_name: firstName, last_name: lastName },
      })
      if (error) throw error
      return data
    },
    onSuccess: (data) => {
      setResult(data)
      setFlash(data.success
        ? { type:'success', msg:'Identity verified successfully.' }
        : { type:'danger',  msg: data.message || 'Verification failed.' }
      )
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const markVerified = useMutation({
    mutationFn: async ({ clientId, method }) => {
      const { error } = await supabase.from('users').update({
        kyc_verified: true,
        kyc_method: method,
        kyc_checked_at: new Date().toISOString(),
      }).eq('id', clientId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-clients'] })
      setFlash({ type:'success', msg:'Client marked as KYC verified.' })
    },
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Identity Verification</h1>
          <p className="text-sm text-gray-500">Verify client BVN or NIN via Prembly</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <Card className="mb-4">
        <CardHeader><div className="font-bold">Run Verification</div></CardHeader>
        <CardBody>
          {/* Method selector */}
          <div className="mb-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Verification Method</label>
            <div className="grid grid-cols-2 gap-3">
              {[['bvn','BVN','Bank Verification Number'],['nin','NIN','National Identity Number']].map(([v,l,s]) => (
                <label key={v} className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${method===v ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="method" value={v} checked={method===v} onChange={() => setMethod(v)} className="hidden"/>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                    ${method===v ? 'border-brand-600' : 'border-gray-300'}`}>
                    {method===v && <div className="w-2 h-2 rounded-full bg-brand-600"/>}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{l}</div>
                    <div className="text-xs text-gray-400">{s}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Input
            label={`${method.toUpperCase()} Number *`}
            value={number}
            onChange={e => setNumber(e.target.value.replace(/\D/g,''))}
            placeholder="11-digit number"
            maxLength={11}
            style={{ fontFamily:'monospace', fontSize:'1.1rem', fontWeight:'700', letterSpacing:'.1em' }}
          />
          <div className="grid grid-cols-2 gap-x-4">
            <Input label="First Name (for matching)" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Optional"/>
            <Input label="Last Name (for matching)"  value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Optional"/>
          </div>

          <Button loading={verify.isPending} onClick={() => verify.mutate()} className="w-full justify-center gap-2">
            <Search size={15}/> Verify Identity
          </Button>
        </CardBody>
      </Card>

      {/* Result */}
      {result && (
        <Card style={{ border: `2px solid ${result.success ? '#4BB543' : '#ef4444'}` }}>
          <CardHeader>
            <div className="font-bold flex items-center gap-2">
              {result.success ? '✅' : '❌'} Verification Result
            </div>
            <Badge color={result.success ? 'green' : 'red'}>
              {result.success ? 'VERIFIED' : 'FAILED'}
            </Badge>
          </CardHeader>
          <CardBody>
            <p className="text-sm text-gray-600 mb-4">{result.message}</p>
            {result.data && (
              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                {Object.entries(result.data).filter(([k,v]) =>
                  v && !['photo','base64Image','picture'].includes(k.toLowerCase()) && typeof v === 'string'
                ).slice(0,10).map(([k,v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">
                      {k.replace(/([A-Z])/g,' $1').trim()}
                    </div>
                    <div className="font-medium text-xs">{v}</div>
                  </div>
                ))}
              </div>
            )}
            {result.success && (
              <Alert type="info" className="text-xs">
                To mark this client as KYC verified, go to their profile and update their KYC status.
              </Alert>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
