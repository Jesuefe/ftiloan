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
import { FileText, Calculator, Upload, X, CheckCircle } from 'lucide-react'

function generateRef() {
  return 'FTI-' + new Date().toISOString().slice(0,10).replace(/-/g,'') + '-' + Math.random().toString(36).slice(-6).toUpperCase()
}

const DOC_TYPES = [
  { key:'passport',         label:'Passport Photo',      required:true  },
  { key:'nin_slip',         label:'NIN Slip',             required:false },
  { key:'bank_statement',   label:'Bank Statement',       required:false },
  { key:'business_photo',   label:'Business/Shop Photo',  required:false },
  { key:'proof_of_address', label:'Proof of Address',     required:false },
  { key:'cac_document',     label:'CAC / Business Reg',   required:false },
]

export default function AgentApply() {
  const { profile } = useAuthStore()
  const navigate    = useNavigate()
  const [searchParams] = useSearchParams()
  const [flash, setFlash] = useState(null)
  const [docs, setDocs]   = useState({}) // { doc_type: File }
  const [form, setForm]   = useState({
    client_id: searchParams.get('client_id') || '',
    amount: '', duration_type: 'daily', duration_value: '',
    purpose: '', bank_account_number: '', bank_account_name: '', bank_name: '',
    guarantor_name: '', guarantor_phone: '', guarantor_relationship: '',
    guarantor2_name: '', guarantor2_phone: '', guarantor2_relationship: '',
    agent_notes: '',
  })
  const [calc, setCalc] = useState(null)
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  const { data: clients } = useQuery({
    queryKey: ['agent-clients-list', profile?.id],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id,zone_id').eq('user_id', profile.id).single()
      if (!agent) return []
      let allClients = []
      if (agent.zone_id) {
        const { data: zc } = await supabase.from('users').select('id,first_name,last_name,phone')
          .eq('role','client').eq('zone_id', agent.zone_id)
        allClients = zc || []
      } else {
        const { data: ac } = await supabase.from('users').select('id,first_name,last_name,phone')
          .eq('role','client').limit(100)
        allClients = ac || []
      }
      const { data: loans } = await supabase.from('loans').select('user_id').eq('agent_id', agent.id)
      const loanIds = new Set(loans?.map(l => l.user_id)||[])
      const seen = new Set(allClients.map(c => c.id))
      if (loanIds.size > 0) {
        const missing = [...loanIds].filter(id => !seen.has(id))
        if (missing.length) {
          const { data: extra } = await supabase.from('users').select('id,first_name,last_name,phone').in('id', missing)
          extra?.forEach(c => allClients.push(c))
        }
      }
      return allClients
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
    } else { setCalc(null) }
  }, [form.amount, form.duration_value, form.duration_type, settings])

  const handleDocChange = (key, file) => {
    if (file) setDocs(d => ({ ...d, [key]: file }))
    else { const n = {...docs}; delete n[key]; setDocs(n) }
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.client_id) throw new Error('Select a client')
      if (!form.amount)    throw new Error('Enter loan amount')
      if (!form.duration_value) throw new Error('Enter number of instalments')

      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      if (!agent) throw new Error('Agent record not found')

      const months = form.duration_type === 'monthly' ? Number(form.duration_value)
        : form.duration_type === 'weekly' ? Number(form.duration_value) / 4
        : Number(form.duration_value) / 30
      const rate     = Number(settings?.interest_rate || 7)
      const adminPct = Number(settings?.admin_charge_pct || 1)
      const c        = calcLoan(Number(form.amount), Math.max(1, months), rate, adminPct)

      // Create loan
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
        agent_notes:         form.agent_notes,
        status:           'under_review',
        agent_decision_at: new Date().toISOString(),
      }).select().single()
      if (error) throw error

      // Add guarantors
      if (form.guarantor_name) {
        await supabase.from('guarantors').insert({
          loan_id: loan.id, name: form.guarantor_name,
          phone: form.guarantor_phone, relationship: form.guarantor_relationship,
        })
      }
      if (form.guarantor2_name) {
        await supabase.from('guarantors').insert({
          loan_id: loan.id, name: form.guarantor2_name,
          phone: form.guarantor2_phone, relationship: form.guarantor2_relationship,
        })
      }

      // Upload documents to Supabase Storage
      for (const [docType, file] of Object.entries(docs)) {
        try {
          const ext  = file.name.split('.').pop()
          const path = `documents/${loan.id}/${docType}_${Date.now()}.${ext}`
          const { error: uploadErr } = await supabase.storage
            .from('ftiloan-docs')
            .upload(path, file, { contentType: file.type })

          if (!uploadErr) {
            await supabase.from('kyc_documents').insert({
              user_id:   form.client_id,
              loan_id:   loan.id,
              doc_type:  docType,
              file_name: file.name,
              file_path: path,
            })
          }
        } catch (e) { console.error('Doc upload error:', e) }
      }

      return loan
    },
    onSuccess: (loan) => {
      setFlash({ type:'success', msg:`Loan application ${loan.loan_ref} submitted. Manager will be notified for review.` })
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
        {/* Client & Loan */}
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
            <Input label="Purpose *" value={form.purpose} onChange={e => set('purpose', e.target.value)} placeholder="Business capital, equipment…"/>
            <Input label="Agent Notes" value={form.agent_notes} onChange={e => set('agent_notes', e.target.value)} placeholder="Any additional notes for manager/admin…"/>
          </CardBody>
        </Card>

        {/* Loan Calculator */}
        {calc && (
          <Card>
            <CardHeader><div className="font-bold flex items-center gap-2"><Calculator size={16}/> Loan Summary</div></CardHeader>
            <CardBody>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {[
                  ['Principal',       formatNaira(calc.principal)],
                  ['Admin Fee',       formatNaira(calc.adminCharge)],
                  ['Amount Disbursed',formatNaira(calc.disbursed)],
                  ['Interest',        `${calc.totalRate}% total`],
                  ['Total Repayment', formatNaira(calc.totalRepay)],
                  ['Per Instalment',  formatNaira(calc.totalRepay / Number(form.duration_value || 1))],
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

        {/* Bank Details */}
        <Card>
          <CardHeader><div className="font-bold">Bank Account Details</div></CardHeader>
          <CardBody>
            <Input label="Bank Name *" value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="e.g. GTBank"/>
            <Input label="Account Number *" value={form.bank_account_number} onChange={e => set('bank_account_number', e.target.value)} placeholder="10-digit account number" maxLength={10}/>
            <Input label="Account Name *" value={form.bank_account_name} onChange={e => set('bank_account_name', e.target.value)} placeholder="Account holder name"/>
          </CardBody>
        </Card>

        {/* KYC Documents */}
        <Card>
          <CardHeader>
            <div className="font-bold flex items-center gap-2"><Upload size={16}/> KYC Documents</div>
            <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">Passport Photo required</div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {DOC_TYPES.map(({ key, label, required }) => {
                const file = docs[key]
                return (
                  <div key={key} className={`border-2 rounded-xl p-3 transition-all ${
                    file ? 'border-brand-400 bg-brand-50' :
                    required ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">
                        {label} {required && <span className="text-red-500">*</span>}
                      </span>
                      {file && (
                        <button onClick={() => handleDocChange(key, null)} className="text-red-400 hover:text-red-600">
                          <X size={14}/>
                        </button>
                      )}
                    </div>
                    {file ? (
                      <div className="flex items-center gap-2 text-xs text-brand-600">
                        <CheckCircle size={14}/>
                        <span className="truncate">{file.name}</span>
                      </div>
                    ) : (
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-500 hover:text-brand-600 transition-colors">
                        <Upload size={14}/>
                        <span>Click to upload</span>
                        <input type="file" className="hidden"
                          accept="image/*,application/pdf"
                          onChange={e => handleDocChange(key, e.target.files?.[0] || null)}/>
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-3">Accepted: JPG, PNG, PDF. Max 5MB per file.</p>
          </CardBody>
        </Card>

        {/* Guarantor 1 */}
        <Card>
          <CardHeader><div className="font-bold">Guarantor 1</div></CardHeader>
          <CardBody>
            <Input label="Full Name" value={form.guarantor_name} onChange={e => set('guarantor_name', e.target.value)} placeholder="Full name"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Input label="Phone" value={form.guarantor_phone} onChange={e => set('guarantor_phone', e.target.value)} placeholder="08012345678"/>
              <Input label="Relationship" value={form.guarantor_relationship} onChange={e => set('guarantor_relationship', e.target.value)} placeholder="e.g. Spouse"/>
            </div>
          </CardBody>
        </Card>

        {/* Guarantor 2 */}
        <Card>
          <CardHeader><div className="font-bold">Guarantor 2 <span className="text-gray-400 text-xs font-normal">(optional)</span></div></CardHeader>
          <CardBody>
            <Input label="Full Name" value={form.guarantor2_name} onChange={e => set('guarantor2_name', e.target.value)} placeholder="Full name"/>
            <div className="grid grid-cols-2 gap-x-4">
              <Input label="Phone" value={form.guarantor2_phone} onChange={e => set('guarantor2_phone', e.target.value)} placeholder="08012345678"/>
              <Input label="Relationship" value={form.guarantor2_relationship} onChange={e => set('guarantor2_relationship', e.target.value)} placeholder="e.g. Sibling"/>
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
