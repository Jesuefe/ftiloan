import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, calcLoan } from '@/lib/utils'
import { Banknote, Building2, Calculator } from 'lucide-react'

function generateRef() {
  return 'FTI-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(-6).toUpperCase()
}

const TABS = [
  { key: 'cash',  label: 'Cash Loan',  icon: Banknote },
  { key: 'asset', label: 'Asset Loan', icon: Building2 },
]

export default function ClientApply() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()
  const [tab, setTab]   = useState(searchParams.get('type') === 'asset' ? 'asset' : 'cash')
  const [flash, setFlash] = useState(null)
  const [calc, setCalc]   = useState(null)

  const [cash, setCash] = useState({
    amount:'', duration_type:'daily', duration_value:'', purpose:'',
    bank_name:'', bank_account_number:'', bank_account_name:'',
    guarantor_name:'', guarantor_phone:'', guarantor_relationship:'',
  })
  const [asset, setAsset] = useState({
    asset_name:'', asset_description:'', asset_vendor_name:'', asset_vendor_location:'',
    asset_estimated_price:'', duration_type:'monthly', duration_value:'',
    bank_name:'', bank_account_number:'', bank_account_name:'',
    guarantor_name:'', guarantor_phone:'', guarantor_relationship:'', purpose:'',
  })
  const setC = (k,v) => setCash(f => ({...f,[k]:v}))
  const setA = (k,v) => setAsset(f => ({...f,[k]:v}))

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('*')
      const m = {}; data?.forEach(r => { m[r.setting_key] = r.setting_value }); return m
    },
  })

  // Recalculate whenever tab/form changes
  useEffect(() => {
    if (tab === 'cash' && cash.amount && cash.duration_value) {
      const months = cash.duration_type === 'monthly' ? Number(cash.duration_value)
        : cash.duration_type === 'weekly' ? Number(cash.duration_value) / 4
        : Number(cash.duration_value) / 30
      setCalc(calcLoan(Number(cash.amount), Math.max(1,months), Number(settings?.interest_rate||7), Number(settings?.admin_charge_pct||1)))
    } else if (tab === 'asset' && asset.asset_estimated_price && asset.duration_value) {
      const rate    = Number(settings?.asset_interest_pct || 30)
      const months  = asset.duration_type === 'monthly' ? Number(asset.duration_value)
        : asset.duration_type === 'weekly' ? Number(asset.duration_value) / 4
        : Number(asset.duration_value) / 30
      const principal  = Number(asset.asset_estimated_price)
      const interest   = Math.round(principal * rate / 100 * 100) / 100
      const totalRepay = principal + interest
      const adminCharge = Math.round(principal * Number(settings?.admin_charge_pct||1) / 100 * 100) / 100
      setCalc({ principal, interest, totalRepay, adminCharge, rate, months: Math.max(1,months), dVal: Number(asset.duration_value) })
    } else {
      setCalc(null)
    }
  }, [tab, cash.amount, cash.duration_value, cash.duration_type, asset.asset_estimated_price, asset.duration_value, asset.duration_type, settings])

  const submit = useMutation({
    mutationFn: async () => {
      if (tab === 'cash') {
        const min = Number(settings?.min_loan||200000)
        const max = Number(settings?.max_loan||2000000)
        if (Number(cash.amount) < min || Number(cash.amount) > max)
          throw new Error(`Amount must be between ${formatNaira(min)} and ${formatNaira(max)}`)

        const months = cash.duration_type === 'monthly' ? Number(cash.duration_value)
          : cash.duration_type === 'weekly' ? Number(cash.duration_value) / 4
          : Number(cash.duration_value) / 30
        const c = calcLoan(Number(cash.amount), Math.max(1,months), Number(settings?.interest_rate||7), Number(settings?.admin_charge_pct||1))
        const dVal = Number(cash.duration_value)

        const { data: loan, error } = await supabase.from('loans').insert({
          loan_ref: generateRef(), loan_type: 'cash', user_id: profile.id,
          amount: Number(cash.amount), duration_type: cash.duration_type, duration_value: dVal,
          interest_rate: Number(settings?.interest_rate||7),
          total_repayment: c.totalRepay, outstanding: c.totalRepay,
          admin_charge: c.adminCharge, disbursed_amount: c.disbursed,
          purpose: cash.purpose, bank_name: cash.bank_name,
          bank_account_number: cash.bank_account_number, bank_account_name: cash.bank_account_name,
          status: 'pending',
        }).select().single()
        if (error) throw error

        if (cash.guarantor_name) {
          await supabase.from('guarantors').insert({ loan_id: loan.id, name: cash.guarantor_name, phone: cash.guarantor_phone, relationship: cash.guarantor_relationship })
        }

        const perInstalment = Math.round(c.totalRepay / dVal * 100) / 100
        const scheduleRows = []
        const startDate = new Date()
        if (cash.duration_type === 'daily') startDate.setDate(startDate.getDate() + 3)
        for (let i = 1; i <= dVal; i++) {
          if (cash.duration_type === 'daily') startDate.setDate(startDate.getDate() + 1)
          else if (cash.duration_type === 'weekly') startDate.setDate(startDate.getDate() + 7)
          else startDate.setMonth(startDate.getMonth() + 1)
          scheduleRows.push({ loan_id: loan.id, due_date: startDate.toISOString().slice(0,10), amount_due: perInstalment, status: 'pending' })
        }
        if (scheduleRows.length) await supabase.from('repayment_schedule').insert(scheduleRows)

      } else {
        // Asset loan
        if (!asset.asset_name || !asset.asset_estimated_price)
          throw new Error('Asset name and estimated price are required')

        const rate       = Number(settings?.asset_interest_pct || 30)
        const principal  = Number(asset.asset_estimated_price)
        const interest   = Math.round(principal * rate / 100 * 100) / 100
        const totalRepay = principal + interest
        const adminCharge = Math.round(principal * Number(settings?.admin_charge_pct||1) / 100 * 100) / 100
        const disbursed  = principal - adminCharge
        const dVal = Number(asset.duration_value)

        const { data: loan, error } = await supabase.from('loans').insert({
          loan_ref: generateRef(), loan_type: 'asset', user_id: profile.id,
          amount: principal, duration_type: asset.duration_type, duration_value: dVal,
          interest_rate: rate, asset_interest_pct: rate,
          total_repayment: totalRepay, outstanding: totalRepay,
          admin_charge: adminCharge, disbursed_amount: disbursed,
          purpose: asset.purpose || `Asset: ${asset.asset_name}`,
          bank_name: asset.bank_name, bank_account_number: asset.bank_account_number, bank_account_name: asset.bank_account_name,
          asset_name: asset.asset_name, asset_description: asset.asset_description,
          asset_vendor_name: asset.asset_vendor_name, asset_vendor_location: asset.asset_vendor_location,
          asset_estimated_price: principal, status: 'pending',
        }).select().single()
        if (error) throw error

        if (asset.guarantor_name) {
          await supabase.from('guarantors').insert({ loan_id: loan.id, name: asset.guarantor_name, phone: asset.guarantor_phone, relationship: asset.guarantor_relationship })
        }

        const perInstalment = Math.round(totalRepay / dVal * 100) / 100
        const scheduleRows = []
        const startDate = new Date()
        if (asset.duration_type === 'daily') startDate.setDate(startDate.getDate() + 3)
        for (let i = 1; i <= dVal; i++) {
          if (asset.duration_type === 'daily') startDate.setDate(startDate.getDate() + 1)
          else if (asset.duration_type === 'weekly') startDate.setDate(startDate.getDate() + 7)
          else startDate.setMonth(startDate.getMonth() + 1)
          scheduleRows.push({ loan_id: loan.id, due_date: startDate.toISOString().slice(0,10), amount_due: perInstalment, status: 'pending' })
        }
        if (scheduleRows.length) await supabase.from('repayment_schedule').insert(scheduleRows)
      }
    },
    onSuccess: () => {
      setFlash({ type:'success', msg:'Application submitted! We will review and contact you.' })
      setTimeout(() => navigate('/client/loans'), 2000)
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const dVal = tab === 'cash' ? Number(cash.duration_value) : Number(asset.duration_value)

  return (
    <div className="max-w-2xl">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Apply for a Loan</h1>
        <p className="text-sm text-gray-500">Choose your loan type below</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setFlash(null); setCalc(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-white text-brand-700 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Icon size={15}/> {t.label}
            </button>
          )
        })}
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* KYC gate */}
      {!profile?.kyc_verified && (
        <div className="mb-5 p-4 bg-amber-50 border border-amber-300 rounded-2xl">
          <div className="flex items-start gap-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <div className="flex-1">
              <div className="font-bold text-amber-800 mb-1">Identity Verification Required</div>
              <p className="text-sm text-amber-700 mb-3">
                You must verify your BVN or NIN before applying for a loan. This protects you and ensures your loan is processed correctly.
              </p>
              <Link to="/client/profile" className="inline-flex items-center gap-2 bg-amber-600 text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-amber-700 transition-colors">
                Verify Identity Now →
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* ── CASH LOAN ── */}
        {tab === 'cash' && (
          <>
            <Card>
              <CardHeader><div className="font-bold">Loan Details</div></CardHeader>
              <CardBody>
                <Input
                  label={`Amount (₦) — Min: ${formatNaira(Number(settings?.min_loan||200000))}, Max: ${formatNaira(Number(settings?.max_loan||2000000))}`}
                  type="number" value={cash.amount} onChange={e => setC('amount', e.target.value)}
                />
                <div className="grid grid-cols-2 gap-x-4">
                  <Select label="Repayment Type" value={cash.duration_type} onChange={e => setC('duration_type', e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Select>
                  <Input label="No. of Instalments" type="number" value={cash.duration_value} onChange={e => setC('duration_value', e.target.value)} placeholder="e.g. 30"/>
                </div>
                <Input label="Purpose" value={cash.purpose} onChange={e => setC('purpose', e.target.value)} placeholder="What will you use the loan for?"/>
              </CardBody>
            </Card>

            {calc && (
              <Card>
                <CardHeader><div className="font-bold flex items-center gap-2"><Calculator size={16}/> Loan Breakdown</div></CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    {[
                      ['Principal',           formatNaira(calc.principal)],
                      ['Admin Fee (deducted)',  formatNaira(calc.adminCharge)],
                      ['You Will Receive',     formatNaira(calc.disbursed)],
                      ['Interest Rate',        `${calc.totalRate}% total`],
                      ['Total to Repay',       formatNaira(calc.totalRepay)],
                      ['Per Instalment',       formatNaira(calc.totalRepay / Math.max(1, dVal))],
                    ].map(([k,v]) => (
                      <div key={k} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-0.5">{k}</div>
                        <div className="font-bold text-gray-900">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-xs text-brand-700">
                    Min. payment per instalment: <strong>{formatNaira(calc.totalRepay / Math.max(1, dVal))}</strong>. You can pay more — extra reduces your next instalment.
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        )}

        {/* ── ASSET LOAN ── */}
        {tab === 'asset' && (
          <>
            <Card>
              <CardHeader><div className="font-bold">Asset Details</div></CardHeader>
              <CardBody>
                <Input label="Asset Name *" value={asset.asset_name} onChange={e => setA('asset_name', e.target.value)} placeholder="e.g. Commercial Freezer, Generator"/>
                <Input label="Asset Description" value={asset.asset_description} onChange={e => setA('asset_description', e.target.value)} placeholder="Brief description"/>
                <div className="grid grid-cols-2 gap-x-4">
                  <Input label="Vendor/Supplier" value={asset.asset_vendor_name} onChange={e => setA('asset_vendor_name', e.target.value)} placeholder="Where you'll buy it"/>
                  <Input label="Vendor Location" value={asset.asset_vendor_location} onChange={e => setA('asset_vendor_location', e.target.value)} placeholder="e.g. Wuse Market"/>
                </div>
                <Input label="Estimated Price (₦) *" type="number" value={asset.asset_estimated_price} onChange={e => setA('asset_estimated_price', e.target.value)} placeholder="Market price"/>
                <div className="grid grid-cols-2 gap-x-4">
                  <Select label="Repayment Type" value={asset.duration_type} onChange={e => setA('duration_type', e.target.value)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                  </Select>
                  <Input label="No. of Instalments" type="number" value={asset.duration_value} onChange={e => setA('duration_value', e.target.value)} placeholder="e.g. 6"/>
                </div>
              </CardBody>
            </Card>

            {calc && (
              <Card>
                <CardHeader>
                  <div className="font-bold flex items-center gap-2"><Calculator size={16}/> Asset Loan Breakdown</div>
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">{calc.rate}% interest</span>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                    {[
                      ['Asset Price',       formatNaira(calc.principal)],
                      ['Admin Fee',         formatNaira(calc.adminCharge)],
                      ['Interest',          formatNaira(calc.interest)],
                      ['Total to Repay',    formatNaira(calc.totalRepay)],
                      ['Per Instalment',    formatNaira(calc.totalRepay / Math.max(1, dVal))],
                      ['Interest Rate',     `${calc.rate}% total`],
                    ].map(([k,v]) => (
                      <div key={k} className="bg-gray-50 rounded-lg p-3">
                        <div className="text-xs text-gray-400 mb-0.5">{k}</div>
                        <div className="font-bold text-gray-900">{v}</div>
                      </div>
                    ))}
                  </div>
                  <div className="bg-brand-50 border border-brand-200 rounded-lg p-3 text-xs text-brand-700">
                    Min. payment per instalment: <strong>{formatNaira(calc.totalRepay / Math.max(1, dVal))}</strong>. You can pay more — extra reduces your next instalment.
                  </div>
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                    FTI Loan purchases the asset on your behalf. Ownership transfers when fully repaid.
                  </div>
                </CardBody>
              </Card>
            )}
          </>
        )}

        {/* Shared: Bank + Guarantor */}
        {tab === 'cash' && (
          <>
            <Card>
              <CardHeader><div className="font-bold">Your Bank Account</div></CardHeader>
              <CardBody>
                <Input label="Bank Name *" value={cash.bank_name} onChange={e => setC('bank_name', e.target.value)} placeholder="e.g. Access Bank"/>
                <Input label="Account Number *" value={cash.bank_account_number} onChange={e => setC('bank_account_number', e.target.value)} placeholder="10-digit number" maxLength={10}/>
                <Input label="Account Name *" value={cash.bank_account_name} onChange={e => setC('bank_account_name', e.target.value)} placeholder="Name on account"/>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><div className="font-bold">Guarantor <span className="text-gray-400 font-normal text-xs">(optional)</span></div></CardHeader>
              <CardBody>
                <Input label="Full Name" value={cash.guarantor_name} onChange={e => setC('guarantor_name', e.target.value)} placeholder="Guarantor's full name"/>
                <div className="grid grid-cols-2 gap-x-4">
                  <Input label="Phone" value={cash.guarantor_phone} onChange={e => setC('guarantor_phone', e.target.value)} placeholder="08012345678"/>
                  <Input label="Relationship" value={cash.guarantor_relationship} onChange={e => setC('guarantor_relationship', e.target.value)} placeholder="e.g. Spouse"/>
                </div>
              </CardBody>
            </Card>
          </>
        )}
        {tab === 'asset' && (
          <>
            <Card>
              <CardHeader><div className="font-bold">Your Bank Account</div></CardHeader>
              <CardBody>
                <Input label="Bank Name *" value={asset.bank_name} onChange={e => setA('bank_name', e.target.value)} placeholder="e.g. GTBank"/>
                <Input label="Account Number *" value={asset.bank_account_number} onChange={e => setA('bank_account_number', e.target.value)} placeholder="10-digit number" maxLength={10}/>
                <Input label="Account Name *" value={asset.bank_account_name} onChange={e => setA('bank_account_name', e.target.value)} placeholder="Name on account"/>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><div className="font-bold">Guarantor <span className="text-gray-400 font-normal text-xs">(optional)</span></div></CardHeader>
              <CardBody>
                <Input label="Full Name" value={asset.guarantor_name} onChange={e => setA('guarantor_name', e.target.value)} placeholder="Full name"/>
                <div className="grid grid-cols-2 gap-x-4">
                  <Input label="Phone" value={asset.guarantor_phone} onChange={e => setA('guarantor_phone', e.target.value)} placeholder="08012345678"/>
                  <Input label="Relationship" value={asset.guarantor_relationship} onChange={e => setA('guarantor_relationship', e.target.value)} placeholder="e.g. Spouse"/>
                </div>
              </CardBody>
            </Card>
          </>
        )}

        <Button loading={submit.isPending} onClick={() => submit.mutate()} className="w-full justify-center" size="lg">
          Submit {tab === 'cash' ? 'Cash' : 'Asset'} Loan Application
        </Button>
      </div>
    </div>
  )
}
