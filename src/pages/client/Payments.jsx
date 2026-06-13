import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Modal } from '@/components/ui/Modal'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils'
import { CreditCard, Upload, PlusCircle, Building2, Copy, Check } from 'lucide-react'

export default function ClientPayments() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [modal, setModal]   = useState(false)
  const [flash, setFlash]   = useState(null)
  const [slip,  setSlip]    = useState(null)
  const [copied, setCopied] = useState(null)
  const [form,  setForm]    = useState({
    loan_id:'', amount:'', payment_method:'bank_transfer',
    payment_date: new Date().toISOString().slice(0,10)
  })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const { data: loans } = useQuery({
    queryKey: ['client-active-loans', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('loans').select('id,loan_ref,outstanding')
        .eq('user_id', profile.id).in('status',['active','disbursed'])
      return data || []
    },
    enabled: !!profile?.id,
  })

  const { data: payments, isLoading } = useQuery({
    queryKey: ['client-payments', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('payments')
        .select('*, loans(loan_ref)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!profile?.id,
  })

  // Company accounts for payment instructions
  const { data: companyAccounts } = useQuery({
    queryKey: ['company-accounts-active'],
    queryFn: async () => {
      const { data } = await supabase.from('company_accounts').select('*').eq('is_active', true)
      return data || []
    },
  })

  const totalPaid = payments?.filter(p => p.status==='confirmed').reduce((s,p) => s+Number(p.actual_amount||p.amount),0) || 0
  const pending   = payments?.filter(p => p.status==='pending').length || 0

  const copyAcct = (num) => {
    navigator.clipboard.writeText(num)
    setCopied(num)
    setTimeout(() => setCopied(null), 2000)
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!form.loan_id) throw new Error('Select a loan')
      if (!form.amount)  throw new Error('Enter amount')

      let slipPath = null
      if (slip) {
        const ext  = slip.name.split('.').pop()
        const path = `slips/${profile.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('ftiloan-docs').upload(path, slip, { contentType: slip.type })
        if (!upErr) slipPath = path
      }

      const { error } = await supabase.from('payments').insert({
        loan_id:        Number(form.loan_id),
        user_id:        profile.id,
        amount:         Number(form.amount),
        payment_date:   form.payment_date,
        payment_method: form.payment_method,
        slip_file:      slipPath,
        status:         'pending',
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey:['client-payments'] })
      setModal(false); setSlip(null)
      setForm({ loan_id:'', amount:'', payment_method:'bank_transfer', payment_date: new Date().toISOString().slice(0,10) })
      setFlash({ type:'success', msg:'Payment submitted. Your agent will confirm it.' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard size={20} className="text-brand-600"/> My Payments
          </h1>
          <p className="text-sm text-gray-500">{payments?.length || 0} records</p>
        </div>
        <Button onClick={() => setModal(true)} className="gap-1.5 text-sm px-3 py-2">
          <PlusCircle size={14}/> Submit
        </Button>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Stats — fixed layout, no overflow */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">Confirmed</div>
          <div className="text-sm font-bold text-green-600 leading-tight break-all">{formatNaira(totalPaid)}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">Pending</div>
          <div className="text-xl font-bold text-amber-600">{pending}</div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-3 text-center">
          <div className="text-xs text-gray-400 mb-1">Total</div>
          <div className="text-xl font-bold text-gray-900">{payments?.length || 0}</div>
        </div>
      </div>

      {/* Company pay-to accounts */}
      {companyAccounts?.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Building2 size={12}/> Pay Into These Accounts
          </div>
          <div className="space-y-2">
            {companyAccounts.map(a => (
              <div key={a.id} className="bg-brand-50 border border-brand-200 rounded-2xl px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="text-xs text-brand-700 font-semibold">{a.bank_name}</div>
                  <div className="font-mono text-base font-bold text-brand-900 mt-0.5">{a.account_number}</div>
                  <div className="text-xs text-brand-600">{a.account_name}</div>
                </div>
                <button onClick={() => copyAcct(a.account_number)} className="p-2 rounded-lg hover:bg-brand-100 text-brand-600 transition-colors">
                  {copied === a.account_number ? <Check size={16} className="text-green-600"/> : <Copy size={16}/>}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment list */}
      <div className="space-y-3">
        {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}
        {payments?.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold text-lg text-gray-900">{formatNaira(p.amount)}</div>
                {p.actual_amount && Number(p.actual_amount) !== Number(p.amount) && (
                  <div className="text-xs text-gray-400">Confirmed: {formatNaira(p.actual_amount)}</div>
                )}
              </div>
              <Badge color={p.status==='confirmed'?'green':p.status==='rejected'?'red':'amber'}>
                {p.status}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-gray-500">
              <span>Loan: <span className="font-mono text-brand-600">{p.loans?.loan_ref}</span></span>
              <span className="capitalize">{p.payment_method?.replace('_',' ')}</span>
              <span>{formatDate(p.payment_date)}</span>
            </div>
            {p.slip_file && (
              <a href={`https://ftiloan.b-cdn.net/${p.slip_file}`} target="_blank" rel="noreferrer"
                className="text-xs text-brand-600 mt-2 inline-flex items-center gap-1">
                <Upload size={11}/> View Payment Slip
              </a>
            )}
            {p.status === 'confirmed' && p.confirmed_at && (
              <div className="mt-2 text-xs text-green-600">Confirmed {formatDateTime(p.confirmed_at)}</div>
            )}
          </div>
        ))}
        {!isLoading && !payments?.length && (
          <div className="py-16 text-center bg-white rounded-2xl border border-gray-200">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background:"rgba(27,42,107,0.08)" }}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1B2A6B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg></div>
            <div className="font-semibold text-gray-700 mb-1">No payments yet</div>
            <p className="text-sm text-gray-400 mb-4">You need an active loan before you can make payments.</p>
            <a href="/client/apply" className="inline-flex items-center gap-2 bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-colors">
              Apply for a Loan
            </a>
          </div>
        )}
      </div>

      {/* Submit payment modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="Submit Payment" size="md">
        {companyAccounts?.length > 0 && (
          <div className="mb-4 p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-700">
            <div className="font-bold mb-1">Pay into:</div>
            {companyAccounts.map(a => (
              <div key={a.id}>{a.bank_name} — <span className="font-mono font-bold">{a.account_number}</span> ({a.account_name})</div>
            ))}
          </div>
        )}
        <Select label="Select Loan *" value={form.loan_id} onChange={e => set('loan_id',e.target.value)}>
          <option value="">— Select loan —</option>
          {loans?.map(l => <option key={l.id} value={l.id}>{l.loan_ref} — Outstanding: {formatNaira(l.outstanding)}</option>)}
        </Select>
        <Input label="Amount Paid (₦) *" type="number" value={form.amount} onChange={e => set('amount',e.target.value)} placeholder="0.00"/>
        <Input label="Payment Date" type="date" value={form.payment_date} onChange={e => set('payment_date',e.target.value)}/>
        <Select label="Payment Method" value={form.payment_method} onChange={e => set('payment_method',e.target.value)}>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="cash">Cash</option>
          <option value="opay">OPay</option>
          <option value="pos">POS</option>
        </Select>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Slip <span className="text-gray-400 font-normal">(optional)</span></label>
          {slip ? (
            <div className="flex items-center gap-2 p-3 bg-brand-50 border border-brand-300 rounded-lg text-sm">
              <Upload size={14} className="text-brand-600"/>
              <span className="flex-1 truncate text-brand-700">{slip.name}</span>
              <button onClick={() => setSlip(null)} className="text-red-400 text-xs">Remove</button>
            </div>
          ) : (
            <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-brand-400 transition-colors text-sm text-gray-500">
              <Upload size={16}/>
              <span>Upload bank screenshot / receipt</span>
              <input type="file" className="hidden" accept="image/*,application/pdf" onChange={e => setSlip(e.target.files?.[0]||null)}/>
            </label>
          )}
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setModal(false)}>Cancel</Button>
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>Submit Payment</Button>
        </div>
      </Modal>
    </div>
  )
}
