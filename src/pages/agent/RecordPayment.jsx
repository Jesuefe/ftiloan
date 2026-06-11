import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira } from '@/lib/utils'
import { CreditCard } from 'lucide-react'

export default function AgentRecordPayment() {
  const { profile } = useAuthStore()
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({ loan_id:'', amount:'', payment_date: new Date().toISOString().slice(0,10), payment_method:'bank_transfer', notes:'' })
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  const { data: loans } = useQuery({
    queryKey: ['agent-active-loans', profile?.id],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      if (!agent) return []
      const { data } = await supabase.from('loans')
        .select(`id,loan_ref,outstanding,users!loans_user_id_fkey(first_name,last_name)`)
        .eq('agent_id', agent.id)
        .in('status', ['active','disbursed'])
        .order('created_at', { ascending: false })
      return data || []
    },
    enabled: !!profile?.id,
  })

  const selectedLoan = loans?.find(l => String(l.id) === String(form.loan_id))

  const submit = useMutation({
    mutationFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      const loan = loans?.find(l => String(l.id) === String(form.loan_id))
      if (!loan) throw new Error('Select a loan')
      const { error } = await supabase.from('payments').insert({
        loan_id:        Number(form.loan_id),
        user_id:        loan.users?.id || profile.id,
        agent_id:       agent?.id,
        amount:         Number(form.amount),
        payment_date:   form.payment_date,
        payment_method: form.payment_method,
        notes:          form.notes,
        status:         'pending',
      })
      if (error) throw error
    },
    onSuccess: () => {
      setFlash({ type:'success', msg:'Payment recorded. Awaiting confirmation.' })
      setForm({ loan_id:'', amount:'', payment_date: new Date().toISOString().slice(0,10), payment_method:'bank_transfer', notes:'' })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <CreditCard size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Record Payment</h1>
          <p className="text-sm text-gray-500">Record a client payment for confirmation</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <Card>
        <CardHeader><div className="font-bold">Payment Details</div></CardHeader>
        <CardBody>
          <Select label="Select Loan *" value={form.loan_id} onChange={e => set('loan_id', e.target.value)}>
            <option value="">— Select active loan —</option>
            {loans?.map(l => (
              <option key={l.id} value={l.id}>
                {l.users?.first_name} {l.users?.last_name} — {l.loan_ref} (Outstanding: {formatNaira(l.outstanding)})
              </option>
            ))}
          </Select>

          {selectedLoan && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm mb-4">
              <span className="text-amber-700 font-semibold">Outstanding: </span>
              <span className="font-bold text-amber-800">{formatNaira(selectedLoan.outstanding)}</span>
            </div>
          )}

          <Input label="Amount (₦) *" type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00"/>
          <Input label="Payment Date *" type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)}/>
          <Select label="Payment Method" value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="cash">Cash</option>
            <option value="opay">OPay</option>
            <option value="pos">POS</option>
          </Select>
          <Input label="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional notes…"/>

          <Button loading={submit.isPending} onClick={() => submit.mutate()} className="w-full justify-center">
            Record Payment
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
