import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira } from '@/lib/utils'
import { Building2, Calculator } from 'lucide-react'

function generateRef() {
  return 'FTI-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(-6).toUpperCase()
}

export default function ClientApplyAsset() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({
    asset_name:'', asset_description:'', asset_vendor_name:'',
    asset_vendor_location:'', asset_estimated_price:'',
    duration_type:'monthly', duration_value:'',
    bank_name:'', bank_account_number:'', bank_account_name:'',
    guarantor_name:'', guarantor_phone:'', guarantor_relationship:'',
    purpose:'',
  })
  const [calc, setCalc] = useState(null)
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('*')
      const m = {}; data?.forEach(r => { m[r.setting_key] = r.setting_value }); return m
    },
  })

  useEffect(() => {
    if (form.asset_estimated_price && form.duration_value) {
      const rate     = Number(settings?.asset_interest_pct || 30)
      const months   = form.duration_type === 'monthly' ? Number(form.duration_value)
        : form.duration_type === 'weekly' ? Number(form.duration_value) / 4
        : Number(form.duration_value) / 30
      const principal   = Number(form.asset_estimated_price)
      const interest    = Math.round(principal * rate / 100 * 100) / 100
      const totalRepay  = principal + interest
      const adminCharge = Math.round(principal * Number(settings?.admin_charge_pct||1) / 100 * 100) / 100
      setCalc({ principal, interest, totalRepay, adminCharge, rate, months: Math.max(1,months) })
    }
  }, [form.asset_estimated_price, form.duration_value, form.duration_type, settings])

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.asset_name || !form.asset_estimated_price)
        throw new Error('Asset name and estimated price are required')

      const rate     = Number(settings?.asset_interest_pct || 30)
      const months   = form.duration_type === 'monthly' ? Number(form.duration_value)
        : form.duration_type === 'weekly' ? Number(form.duration_value) / 4
        : Number(form.duration_value) / 30
      const principal   = Number(form.asset_estimated_price)
      const interest    = Math.round(principal * rate / 100 * 100) / 100
      const totalRepay  = principal + interest
      const adminCharge = Math.round(principal * Number(settings?.admin_charge_pct||1) / 100 * 100) / 100
      const disbursed   = principal - adminCharge

      const { data: loan, error } = await supabase.from('loans').insert({
        loan_ref:             generateRef(),
        loan_type:            'asset',
        user_id:              profile.id,
        amount:               principal,
        duration_type:        form.duration_type,
        duration_value:       Number(form.duration_value),
        interest_rate:        rate,
        asset_interest_pct:   rate,
        total_repayment:      totalRepay,
        outstanding:          totalRepay,
        admin_charge:         adminCharge,
        disbursed_amount:     disbursed,
        purpose:              form.purpose || `Asset: ${form.asset_name}`,
        bank_name:            form.bank_name,
        bank_account_number:  form.bank_account_number,
        bank_account_name:    form.bank_account_name,
        asset_name:           form.asset_name,
        asset_description:    form.asset_description,
        asset_vendor_name:    form.asset_vendor_name,
        asset_vendor_location:form.asset_vendor_location,
        asset_estimated_price:principal,
        status:               'pending',
      }).select().single()
      if (error) throw error

      if (form.guarantor_name) {
        await supabase.from('guarantors').insert({
          loan_id: loan.id, name: form.guarantor_name,
          phone: form.guarantor_phone, relationship: form.guarantor_relationship,
        })
      }
      return loan
    },
    onSuccess: () => {
      setFlash({ type:'success', msg:'Asset loan application submitted! We will contact you.' })
      setTimeout(() => navigate('/client/loans'), 2000)
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Building2 size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Apply for Asset Loan</h1>
          <p className="text-sm text-gray-500">Finance equipment, machinery, or business assets</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="space-y-4">
        <Card>
          <CardHeader><div className="font-bold">Asset Details</div></CardHeader>
          <CardBody>
            <Input label="Asset Name *" value={form.asset_name} onChange={e => set('asset_name', e.target.value)} placeholder="e.g. Commercial Freezer, Generator, Motorcycle"/>
            <Input label="Asset Description" value={form.asset_description} onChange={e => set('asset_description', e.target.value)} placeholder="Brief description of the asset"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Input label="Vendor/Supplier Name" value={form.asset_vendor_name} onChange={e => set('asset_vendor_name', e.target.value)} placeholder="Where you'll buy it from"/>
              <Input label="Vendor Location" value={form.asset_vendor_location} onChange={e => set('asset_vendor_location', e.target.value)} placeholder="e.g. Wuse Market, Abuja"/>
            </div>
            <Input label="Estimated Price (₦) *" type="number" value={form.asset_estimated_price} onChange={e => set('asset_estimated_price', e.target.value)} placeholder="Market price of the asset"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Select label="Repayment Type" value={form.duration_type} onChange={e => set('duration_type', e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              <Input label="Number of Instalments" type="number" value={form.duration_value} onChange={e => set('duration_value', e.target.value)} placeholder="e.g. 6"/>
            </div>
          </CardBody>
        </Card>

        {calc && (
          <Card>
            <CardHeader>
              <div className="font-bold flex items-center gap-2"><Calculator size={16}/> Asset Loan Breakdown</div>
              <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                {calc.rate}% interest rate (asset loans)
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Asset Price',      formatNaira(calc.principal)],
                  ['Admin Fee',        formatNaira(calc.adminCharge)],
                  ['Interest',         `${calc.rate}% total`],
                  ['Interest Amount',  formatNaira(calc.interest)],
                  ['Total to Repay',   formatNaira(calc.totalRepay)],
                  ['Per Instalment',   formatNaira(calc.totalRepay / Math.max(1, Number(form.duration_value || 1)))],
                ].map(([k,v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-0.5">{k}</div>
                    <div className="font-bold text-gray-900">{v}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                FTI Loan purchases the asset on your behalf and transfers ownership once fully repaid.
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader><div className="font-bold">Bank Account</div></CardHeader>
          <CardBody>
            <Input label="Bank Name *" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. GTBank"/>
            <Input label="Account Number *" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="10-digit account number" maxLength={10}/>
            <Input label="Account Name *" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} placeholder="Name on account"/>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-bold">Guarantor</div></CardHeader>
          <CardBody>
            <Input label="Guarantor Name" value={form.guarantor_name} onChange={e => set('guarantor_name', e.target.value)} placeholder="Full name"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Input label="Phone" value={form.guarantor_phone} onChange={e => set('guarantor_phone', e.target.value)} placeholder="08012345678"/>
              <Input label="Relationship" value={form.guarantor_relationship} onChange={e => set('guarantor_relationship', e.target.value)} placeholder="e.g. Spouse"/>
            </div>
          </CardBody>
        </Card>

        <Button loading={submit.isPending} onClick={() => submit.mutate()} className="w-full justify-center" size="lg">
          Submit Asset Loan Application
        </Button>
      </div>
    </div>
  )
}
