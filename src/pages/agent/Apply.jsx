import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, calcLoan } from '@/lib/utils'
import { FileText, Calculator } from 'lucide-react'

function generateRef() {
  return 'FTI-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(-6).toUpperCase()
}

export default function AgentApply() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({
    client_id: searchParams.get('client_id') || '',
    amount: '', duration_type: 'daily', duration_value: '',
    purpose: '', bank_account_number: '', bank_account_name: '', bank_name: '',
    guarantor_name: '', guarantor_phone: '', guarantor_relationship: '',
  })
  const [calc, setCalc] = useState(null)
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  const { data: clients } = useQuery({
    queryKey: ['agent-clients-list', profile?.id],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id,zone_id').eq('user_id', profile.id).single()
      if (!agent) return []

      // Get clients from loans
      const { data: loans } = await supabase.from('loans').select('user_id').eq('agent_id', agent.id)
      const loanClientIds = new Set(loans?.map(l => l.user_id) || [])

      // Get clients from same zone
      let zoneClients = []
      if (agent.zone_id) {
        const { data: zc } = await supabase.from('users').select('id,first_name,last_name,phone')
          .eq('role','client').eq('zone_id', agent.zone_id)
        zoneClients = zc || []
      } else {
        // No zone — get all clients
        const { data: ac } = await supabase.from('users').select('id,first_name,last_name,phone')
          .eq('role','client').limit(100)
        zoneClients = ac || []
      }

      // Merge both sources, deduplicate by id
      const seen = new Set()
      const all  = [...zoneClients]
      all.forEach(c => seen.add(c.id))

      // Add any loan clients not already in zone list
      if (loanClientIds.size > 0) {
        const missing = [...loanClientIds].filter(id => !seen.has(id))
        if (missing.length) {
          const { data: extra } = await supabase.from('users').select('id,first_name,last_name,phone').in('id', missing)
          extra?.forEach(c => all.push(c))
        }
      }

      return all
    },
    enabled: !!profile?.id,
  })

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('*')
      const m = {}; data?.forEach(r => { m[r.setting_key] = r.setting_value }); return m
    },
  })

  useEffect(() => {
    if (form.amount && form.duration_value && form.duration_type) {
      const months = form.duration_type === 'monthly' ? Number(form.duration_value)
        : form.duration_type === 'weekly' ? Number(form.duration_value) / 4
        : Number(form.duration_value) / 30
      const rate    = Number(settings?.interest_rate || 7)
      const adminPct= Number(settings?.admin_charge_pct || 1)
      setCalc(calcLoan(Number(form.amount), Math.max(1, months), rate, adminPct))
    }
  }, [form.amount, form.duration_value, form.duration_type, settings])

  const submit = useMutation({
    mutationFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      if (!agent) throw new Error('Agent record not found')

      const months = form.duration_type === 'monthly' ? Number(form.duration_value)
        : form.duration_type === 'weekly' ? Number(form.duration_value) / 4
        : Number(form.duration_value) / 30
      const rate     = Number(settings?.interest_rate || 7)
      const adminPct = Number(settings?.admin_charge_pct || 1)
      const c        = calcLoan(Number(form.amount), Math.max(1, months), rate, adminPct)

      const { data: loan, error } = await supabase.from('loans').insert({
        loan_ref:         generateRef(),
        loan_type:        'cash',
        user_id:          form.client_id,
        agent_id:         agent.id,
        amount:           Number(form.amount),
        duration_type:    form.duration_type,
        duration_value:   Number(form.duration_value),
        interest_rate:    rate,
        total_repayment:  c.totalRepay,
        outstanding:      c.totalRepay,
        admin_charge:     c.adminCharge,
        disbursed_amount: c.disbursed,
        purpose:          form.purpose,
        bank_account_number: form.bank_account_number,
        bank_account_name:   form.bank_account_name,
        bank_name:           form.bank_name,
        status:           'under_review',
      }).select().single()
      if (error) throw error

      // Add guarantor
      if (form.guarantor_name) {
        await supabase.from('guarantors').insert({
          loan_id: loan.id, name: form.guarantor_name,
          phone: form.guarantor_phone, relationship: form.guarantor_relationship,
        })
      }
      return loan
    },
    onSuccess: (loan) => {
      setFlash({ type:'success', msg:`Loan application ${loan.loan_ref} submitted successfully.` })
      setTimeout(() => navigate('/agent/clients'), 2000)
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <FileText size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Apply for Loan</h1>
          <p className="text-sm text-gray-500">Submit a cash loan application for a client</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="space-y-4">
        <Card>
          <CardHeader><div className="font-bold">Client & Loan Details</div></CardHeader>
          <CardBody>
            <Select label="Select Client *" value={form.client_id} onChange={e => set('client_id', e.target.value)}>
              <option value="">— Select client —</option>
              {clients?.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} — {c.phone}</option>)}
            </Select>
            <Input label="Loan Amount (₦) *" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="200000"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Select label="Duration Type *" value={form.duration_type} onChange={e => set('duration_type', e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              <Input label="Number of Instalments *" type="number" value={form.duration_value} onChange={e => set('duration_value', e.target.value)} placeholder="e.g. 30"/>
            </div>
            <Input label="Purpose" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="Business capital, equipment…"/>
          </CardBody>
        </Card>

        {calc && (
          <Card>
            <CardHeader><div className="font-bold flex items-center gap-2"><Calculator size={16}/> Loan Summary</div></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Principal',      formatNaira(calc.principal)],
                  ['Admin Fee',      formatNaira(calc.adminCharge)],
                  ['Amount Disbursed',formatNaira(calc.disbursed)],
                  ['Interest',       `${calc.totalRate}% total`],
                  ['Total Repayment',formatNaira(calc.totalRepay)],
                  ['Per Instalment', formatNaira(calc.totalRepay / Number(form.duration_value || 1))],
                ].map(([k,v]) => (
                  <div key={k} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">{k}</div>
                    <div className="font-bold text-gray-900">{v}</div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader><div className="font-bold">Bank Details</div></CardHeader>
          <CardBody>
            <Input label="Bank Name *" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. GTBank"/>
            <Input label="Account Number *" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="10-digit account number" maxLength={10}/>
            <Input label="Account Name *" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} placeholder="Account holder name"/>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-bold">Guarantor</div></CardHeader>
          <CardBody>
            <Input label="Guarantor Name" value={form.guarantor_name} onChange={e => set('guarantor_name', e.target.value)} placeholder="Full name"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Input label="Phone" value={form.guarantor_phone} onChange={e => set('guarantor_phone', e.target.value)} placeholder="08012345678"/>
              <Input label="Relationship" value={form.guarantor_relationship} onChange={e => set('guarantor_relationship', e.target.value)} placeholder="e.g. Spouse, Sibling"/>
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
