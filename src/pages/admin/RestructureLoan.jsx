import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'
import { ArrowLeft, RotateCcw } from 'lucide-react'

export default function AdminRestructureLoan() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [flash, setFlash] = useState(null)
  const [form, setForm]   = useState({ new_duration_type:'daily', new_duration_value:'', reason:'' })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const { data: loan } = useQuery({
    queryKey: ['loan-restructure', id],
    queryFn: async () => {
      const { data } = await supabase.from('loans')
        .select(`*, users!loans_user_id_fkey(first_name,last_name,phone)`)
        .eq('id', id).single()
      return data
    },
  })

  // Preview calculation
  const restructureFee = 0.5 // 0.5%
  const outstanding    = Number(loan?.outstanding || 0)
  const fee            = form.new_duration_value ? Math.round(outstanding * restructureFee / 100 * 100) / 100 : 0
  const newOutstanding = outstanding + fee
  const perInstalment  = form.new_duration_value ? Math.round(newOutstanding / Number(form.new_duration_value) * 100) / 100 : 0

  const restructure = useMutation({
    mutationFn: async () => {
      if (!form.new_duration_value || !form.reason) throw new Error('Duration and reason are required')
      if (!['active','disbursed'].includes(loan?.status)) throw new Error('Only active loans can be restructured')

      // Log restructure
      await supabase.from('loan_restructures').insert({
        loan_id:           Number(id),
        restructured_by:   profile.id,
        old_duration_type: loan.duration_type,
        old_duration_value:loan.duration_value,
        old_outstanding:   outstanding,
        new_duration_type: form.new_duration_type,
        new_duration_value:Number(form.new_duration_value),
        new_outstanding:   newOutstanding,
        restructure_fee:   fee,
        reason:            form.reason,
      })

      // Update loan
      await supabase.from('loans').update({
        outstanding:       newOutstanding,
        total_repayment:   Number(loan.total_repayment) + fee,
        duration_type:     form.new_duration_type,
        duration_value:    Number(form.new_duration_value),
        restructure_count: (loan.restructure_count || 0) + 1,
      }).eq('id', id)

      // Delete old pending schedule entries
      await supabase.from('repayment_schedule')
        .delete().eq('loan_id', id).in('status',['pending','overdue','partial'])

      // Generate new schedule
      const schedule = []
      const due = new Date()
      for (let i = 1; i <= Number(form.new_duration_value); i++) {
        if (form.new_duration_type === 'daily') {
          due.setDate(due.getDate() + 1)
        } else {
          due.setDate(due.getDate() + 7)
        }
        schedule.push({
          loan_id:    Number(id),
          due_date:   due.toISOString().slice(0,10),
          amount_due: perInstalment,
          status:     'pending',
        })
      }
      await supabase.from('repayment_schedule').insert(schedule)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loan-restructure', id] })
      setFlash({ type:'success', msg:'Loan restructured successfully. New schedule generated.' })
      setTimeout(() => navigate(`/admin/loans/${id}`), 2000)
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18}/>
        </button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><RotateCcw size={18} className="text-brand-600"/> Restructure Loan</h1>
          <p className="text-sm text-gray-500">{loan?.loan_ref} — {loan?.users?.first_name} {loan?.users?.last_name}</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {loan && !['active','disbursed'].includes(loan.status) && (
        <Alert type="warning" className="mb-4">Only active loans can be restructured. This loan is <strong>{loan.status}</strong>.</Alert>
      )}

      <div className="grid grid-cols-2 gap-3 mb-4">
        {[
          ['Current Outstanding', formatNaira(outstanding)],
          ['Restructure Fee (0.5%)', formatNaira(fee)],
          ['New Outstanding', formatNaira(newOutstanding)],
          ['Per Instalment', form.new_duration_value ? formatNaira(perInstalment) : '—'],
        ].map(([k,v]) => (
          <div key={k} className="bg-white border border-gray-200 rounded-xl p-3">
            <div className="text-xs text-gray-400 mb-0.5">{k}</div>
            <div className="font-bold">{v}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader><div className="font-bold">New Repayment Terms</div></CardHeader>
        <CardBody>
          <div className="grid grid-cols-2 gap-x-4">
            <Select label="Duration Type" value={form.new_duration_type} onChange={e => set('new_duration_type', e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
            <Input label="Number of Instalments" type="number" value={form.new_duration_value} onChange={e => set('new_duration_value', e.target.value)} placeholder="e.g. 30"/>
          </div>
          <Input label="Reason for Restructure *" value={form.reason} onChange={e => set('reason', e.target.value)} placeholder="Client request, financial hardship…"/>
          <Button loading={restructure.isPending} onClick={() => restructure.mutate()} className="w-full justify-center"
            disabled={!['active','disbursed'].includes(loan?.status)}>
            <RotateCcw size={15}/> Restructure Loan
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
