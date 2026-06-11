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
import { formatNaira, calcLoan } from '@/lib/utils'
import { Banknote, Calculator } from 'lucide-react'

function generateRef() {
  return 'FTI-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(-6).toUpperCase()
}

export default function ClientApply() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({
    amount:'', duration_type:'daily', duration_value:'', purpose:'',
    bank_name:'', bank_account_number:'', bank_account_name:'',
    guarantor_name:'', guarantor_phone:'', guarantor_relationship:'',
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
    if (form.amount && form.duration_value) {
      const months  = form.duration_type === 'monthly' ? Number(form.duration_value)
        : form.duration_type === 'weekly' ? Number(form.duration_value) / 4
        : Number(form.duration_value) / 30
      setCalc(calcLoan(Number(form.amount), Math.max(1, months), Number(settings?.interest_rate||7), Number(settings?.admin_charge_pct||1)))
    }
  }, [form.amount, form.duration_value, form.duration_type, settings])

  const submit = useMutation({
    mutationFn: async () => {
      const min = Number(settings?.min_loan||200000)
      const max = Number(settings?.max_loan||2000000)
      if (Number(form.amount) < min || Number(form.amount) > max)
        throw new Error(`Amount must be between ${formatNaira(min)} and ${formatNaira(max)}`)

      const months   = form.duration_type === 'monthly' ? Number(form.duration_value)
        : form.duration_type === 'weekly' ? Number(form.duration_value) / 4
        : Number(form.duration_value) / 30
      const c = calcLoan(Number(form.amount), Math.max(1,months), Number(settings?.interest_rate||7), Number(settings?.admin_charge_pct||1))

      const { data: loan, error } = await supabase.from('loans').insert({
        loan_ref:         generateRef(),
        loan_type:        'cash',
        user_id:          profile.id,
        amount:           Number(form.amount),
        duration_type:    form.duration_type,
        duration_value:   Number(form.duration_value),
        interest_rate:    Number(settings?.interest_rate||7),
        total_repayment:  c.totalRepay,
        outstanding:      c.totalRepay,
        admin_charge:     c.adminCharge,
        disbursed_amount: c.disbursed,
        purpose:          form.purpose,
        bank_name:        form.bank_name,
        bank_account_number: form.bank_account_number,
        bank_account_name:   form.bank_account_name,
        status:           'pending',
      }).select().single()
      if (error) throw error

      if (form.guarantor_name) {
        await supabase.from('guarantors').insert({
          loan_id: loan.id, name: form.guarantor_name,
          phone: form.guarantor_phone, relationship: form.guarantor_relationship,
        })
      }

      // Generate repayment schedule
      const scheduleRows = []
      const startDate = new Date()
      const dVal = Number(form.duration_value)
      const dType = form.duration_type
      if (dType === 'daily') startDate.setDate(startDate.getDate() + 3) // 3 day grace
      const perInstalment = Math.round(c.totalRepay / dVal * 100) / 100
      for (let i = 1; i <= dVal; i++) {
        if (dType === 'daily')   startDate.setDate(startDate.getDate() + 1)
        else if (dType === 'weekly')   startDate.setDate(startDate.getDate() + 7)
        else                          startDate.setMonth(startDate.getMonth() + 1)
        scheduleRows.push({
          loan_id:    loan.id,
          due_date:   startDate.toISOString().slice(0,10),
          amount_due: perInstalment,
          status:     'pending',
        })
      }
      if (scheduleRows.length > 0) {
        await supabase.from('repayment_schedule').insert(scheduleRows)
      }
      return loan
    },
    onSuccess: () => {
      setFlash({ type:'success', msg:'Application submitted! We will review and contact you.' })
      setTimeout(() => navigate('/client/loans'), 2000)
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Banknote size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Apply for Cash Loan</h1>
          <p className="text-sm text-gray-500">Fill in the details below to submit your application</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="space-y-4">
        <Card>
          <CardHeader><div className="font-bold">Loan Details</div></CardHeader>
          <CardBody>
            <Input label={`Amount (₦) — Min: ${formatNaira(Number(settings?.min_loan||200000))}, Max: ${formatNaira(Number(settings?.max_loan||2000000))}`}
              type="number" value={form.amount} onChange={e => set('amount', e.target.value)}/>
            <div className="grid grid-cols-2 gap-x-4">
              <Select label="Duration Type" value={form.duration_type} onChange={e => set('duration_type', e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              <Input label="Number of Instalments" type="number" value={form.duration_value} onChange={e => set('duration_value', e.target.value)} placeholder="e.g. 30"/>
            </div>
            <Input label="Purpose" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="What will you use the loan for?"/>
          </CardBody>
        </Card>

        {calc && (
          <Card>
            <CardHeader><div className="font-bold flex items-center gap-2"><Calculator size={16}/> Loan Breakdown</div></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Principal',       formatNaira(calc.principal)],
                  ['Admin Fee (deducted)', formatNaira(calc.adminCharge)],
                  ['You Will Receive', formatNaira(calc.disbursed)],
                  ['Interest Rate',   `${calc.totalRate}% total`],
                  ['Total to Repay',  formatNaira(calc.totalRepay)],
                  ['Per Instalment',  formatNaira(calc.totalRepay / Math.max(1, Number(form.duration_value)))],
                ].map(([k,v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 mb-0.5">{k}</div>
                    <div className="font-bold text-gray-900">{v}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader><div className="font-bold">Bank Account</div></CardHeader>
          <CardBody>
            <Input label="Bank Name *" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. Access Bank"/>
            <Input label="Account Number *" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="10-digit number" maxLength={10}/>
            <Input label="Account Name *" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} placeholder="Name on account"/>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-bold">Guarantor</div></CardHeader>
          <CardBody>
            <Input label="Full Name" value={form.guarantor_name} onChange={e => set('guarantor_name', e.target.value)} placeholder="Guarantor's full name"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Input label="Phone" value={form.guarantor_phone} onChange={e => set('guarantor_phone', e.target.value)} placeholder="08012345678"/>
              <Input label="Relationship" value={form.guarantor_relationship} onChange={e => set('guarantor_relationship', e.target.value)} placeholder="e.g. Spouse"/>
            </div>
          </CardBody>
        </Card>

        <Button loading={submit.isPending} onClick={() => submit.mutate()} className="w-full justify-center" size="lg">
          Submit Application
        </Button>
      </div>
    </div>
  )
}
