import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Shield, Search } from 'lucide-react'

export default function AdminKycTest() {
  const [tab, setTab]     = useState('verify')
  const [method, setMethod] = useState('bvn')
  const [number, setNumber] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [creditBvn, setCreditBvn] = useState('')
  const [flash, setFlash] = useState(null)
  const [verifyResult, setVerifyResult] = useState(null)
  const [creditResult, setCreditResult] = useState(null)

  const verify = useMutation({
    mutationFn: async () => {
      if (!number.trim()) throw new Error('Enter an ID number')
      const { data, error } = await supabase.functions.invoke('verify-identity', {
        body: { method, number: number.trim(), first_name: firstName, last_name: lastName },
      })
      if (error) throw new Error(error.message || 'Verification failed')
      return data
    },
    onSuccess: (data) => {
      setVerifyResult(data)
      setFlash(data.success ? { type:'success', msg:'Verification passed.' } : { type:'danger', msg: data.message })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const creditSearch = useMutation({
    mutationFn: async () => {
      if (!creditBvn.trim() || creditBvn.length !== 11) throw new Error('Enter a valid 11-digit BVN')
      const { data, error } = await supabase.functions.invoke('credit-bureau', {
        body: { bvn: creditBvn.trim() },
      })
      if (error) throw new Error(error.message || 'Credit search failed')
      return data
    },
    onSuccess: (data) => {
      setCreditResult(data)
      setFlash({ type: data.success ? 'success' : 'warning', msg: data.message })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold">KYC & Credit Search</h1>
          <p className="text-sm text-gray-500">Prembly identity verification and credit bureau</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {[['verify','Identity Verification'],['credit','Credit Bureau Search']].map(([t,l]) => (
          <button key={t} onClick={() => { setTab(t); setFlash(null) }}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all
              ${tab===t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'verify' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><div className="font-bold">Run Verification</div></CardHeader>
            <CardBody>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {[['bvn','BVN'],['nin','NIN'],['phone','Phone']].map(([v,l]) => (
                    <label key={v} className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium
                      ${method===v ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                      <input type="radio" className="hidden" checked={method===v} onChange={() => setMethod(v)}/>
                      {l}
                    </label>
                  ))}
                </div>
              </div>
              <Input label={`${method.toUpperCase()} Number *`} value={number}
                onChange={e => setNumber(e.target.value.replace(/\D/g,''))}
                placeholder="11-digit number" maxLength={11}
                style={{fontFamily:'monospace',fontWeight:'700',letterSpacing:'.1em'}}/>
              {method !== 'phone' && (
                <div className="grid grid-cols-2 gap-x-3">
                  <Input label="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="Optional"/>
                  <Input label="Last Name"  value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Optional"/>
                </div>
              )}
              <Button loading={verify.isPending} onClick={() => verify.mutate()} className="w-full justify-center gap-2">
                <Search size={15}/> Run Verification
              </Button>
            </CardBody>
          </Card>

          {verifyResult && (
            <Card style={{ border:`2px solid ${verifyResult.success?'#4BB543':'#ef4444'}` }}>
              <CardHeader>
                <div className="font-bold">{verifyResult.success ? '✅ Passed' : '❌ Failed'}</div>
                <Badge color={verifyResult.success?'green':'red'}>{verifyResult.success?'VERIFIED':'FAILED'}</Badge>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-gray-600 mb-3">{verifyResult.message}</p>
                {verifyResult.data && (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(verifyResult.data).filter(([k,v]) =>
                      v && typeof v === 'string' && !['photo','base64Image'].includes(k.toLowerCase())
                    ).slice(0,8).map(([k,v]) => (
                      <div key={k} className="bg-gray-50 rounded p-2">
                        <div className="text-gray-400 uppercase text-xs mb-0.5">{k.replace(/([A-Z])/g,' $1').trim()}</div>
                        <div className="font-medium">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}

      {tab === 'credit' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader><div className="font-bold">Credit Bureau Search</div></CardHeader>
            <CardBody>
              <Input label="BVN *" value={creditBvn}
                onChange={e => setCreditBvn(e.target.value.replace(/\D/g,''))}
                placeholder="11-digit BVN" maxLength={11}
                style={{fontFamily:'monospace',fontWeight:'700',letterSpacing:'.12em',textAlign:'center',fontSize:'1.1rem'}}/>
              <div className="text-xs text-gray-400 mb-4 -mt-2">Searches Nigerian Credit Bureau for loan history and defaults</div>
              <Button loading={creditSearch.isPending} onClick={() => creditSearch.mutate()} className="w-full justify-center gap-2">
                <Search size={15}/> Run Credit Search
              </Button>
            </CardBody>
          </Card>

          {creditResult && (
            <Card style={{ border:`2px solid ${creditResult.success?'#4BB543':'#ef4444'}` }}>
              <CardHeader>
                <div className="font-bold">{(creditResult.risk||'UNKNOWN').toUpperCase()} RISK</div>
                <Badge color={creditResult.risk==='low'?'green':creditResult.risk==='high'?'red':'amber'}>
                  {creditResult.risk?.toUpperCase() || 'UNKNOWN'}
                </Badge>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-gray-600 mb-4">{creditResult.message}</p>
                {creditResult.summary && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ['Total Loans',   creditResult.summary.total_loans||0],
                      ['Performing',    creditResult.summary.performing||0],
                      ['Defaults',      creditResult.summary.defaults||0],
                      ['Risk Score',    `${creditResult.summary.risk_score||0}/100`],
                    ].map(([k,v]) => (
                      <div key={k} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 uppercase mb-0.5">{k}</div>
                        <div className="font-bold">{v}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
