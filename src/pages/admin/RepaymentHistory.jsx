import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils'
import { ArrowLeft, CheckCircle, Clock, AlertCircle, CreditCard, Calendar } from 'lucide-react'

export default function AdminRepaymentHistory() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: loan } = useQuery({
    queryKey: ['loan-repayment', id],
    queryFn: async () => {
      const { data } = await supabase.from('loans')
        .select(`*, users!loans_user_id_fkey(first_name,last_name,phone,email)`)
        .eq('id', id).single()
      return data
    },
  })

  const { data: schedule } = useQuery({
    queryKey: ['repayment-schedule', id],
    queryFn: async () => {
      const { data } = await supabase.from('repayment_schedule')
        .select('*').eq('loan_id', id).order('due_date', { ascending: true })
      return data || []
    },
  })

  const { data: payments } = useQuery({
    queryKey: ['loan-payments', id],
    queryFn: async () => {
      const { data } = await supabase.from('payments')
        .select(`*`).eq('loan_id', id).order('created_at', { ascending: false })
      return data || []
    },
  })

  const paid      = schedule?.filter(s => s.status === 'paid').length || 0
  const overdue   = schedule?.filter(s => s.status === 'overdue').length || 0
  const pending   = schedule?.filter(s => s.status === 'pending').length || 0
  const partial   = schedule?.filter(s => s.status === 'partial').length || 0
  const total     = schedule?.length || 0
  const progress  = total > 0 ? Math.round((paid / total) * 100) : 0
  const perInst   = total > 0 ? Number(loan?.total_repayment || 0) / total : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600"/>
        </button>
        <div>
          <h1 className="text-xl font-bold">{loan?.loan_ref} — Repayment History</h1>
          <p className="text-sm text-gray-500">{loan?.users?.first_name} {loan?.users?.last_name} — {loan?.users?.phone}</p>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          ['Per Instalment',   formatNaira(perInst),                 'brand'],
          ['Total Repayment',  formatNaira(loan?.total_repayment||0),'gray'],
          ['Amount Paid',      formatNaira(loan?.amount_paid||0),    'green'],
          ['Outstanding',      formatNaira(loan?.outstanding||0),    'amber'],
        ].map(([l,v,c]) => (
          <div key={l} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div className={`text-lg font-bold font-display ${c==='green'?'text-green-600':c==='amber'?'text-amber-600':c==='brand'?'text-brand-600':'text-gray-900'}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-0.5">{l}</div>
          </div>
        ))}
      </div>

      {/* Schedule stats */}
      <div className="grid grid-cols-5 gap-2 mb-4">
        {[['Total',total,'gray'],['Paid',paid,'green'],['Pending',pending,'gray'],['Partial',partial,'amber'],['Overdue',overdue,'red']].map(([l,v,c]) => (
          <div key={l} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${c==='green'?'text-green-600':c==='red'?'text-red-600':c==='amber'?'text-amber-600':'text-gray-700'}`}>{v}</div>
            <div className="text-xs text-gray-400">{l}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex justify-between text-sm font-semibold mb-2">
          <span>Progress</span>
          <span className="text-brand-600">{progress}% ({paid}/{total} paid)</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width:`${progress}%` }}/>
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
          <Calendar size={11}/>
          <span className="capitalize">{loan?.duration_value} {loan?.duration_type} instalments @ {formatNaira(perInst)} each</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Schedule */}
        <Card>
          <CardHeader><div className="font-bold">Repayment Schedule ({total})</div></CardHeader>
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50">
                <tr className="border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Due</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Amount</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Paid</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule?.map((r,i) => (
                  <tr key={r.id} className={`border-b border-gray-100 ${r.status==='overdue'?'bg-red-50':r.status==='paid'?'bg-green-50/30':''}`}>
                    <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(r.due_date)}</td>
                    <td className="px-3 py-2 font-medium text-xs">{formatNaira(r.amount_due)}</td>
                    <td className="px-3 py-2 text-xs text-green-600">{Number(r.amount_paid)>0?formatNaira(r.amount_paid):'—'}</td>
                    <td className="px-3 py-2">
                      <Badge color={r.status==='paid'?'green':r.status==='overdue'?'red':r.status==='partial'?'amber':'gray'} className="text-xs">
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!schedule?.length && <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-400 text-xs">No schedule generated yet</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <div className="font-bold flex items-center gap-2"><CreditCard size={15}/> Payment Records</div>
            <span className="text-xs text-gray-500">{payments?.length||0} records</span>
          </CardHeader>
          <div className="overflow-y-auto max-h-80">
            {payments?.map(p => (
              <div key={p.id} className="px-4 py-3 border-b border-gray-100">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm">{formatNaira(p.actual_amount||p.amount)}</div>
                    <div className="text-xs text-gray-400">{formatDateTime(p.created_at)}</div>
                    <div className="text-xs text-gray-400 capitalize">{p.payment_method?.replace('_',' ')}</div>
                  </div>
                  <Badge color={p.status==='confirmed'?'green':p.status==='rejected'?'red':'amber'}>{p.status}</Badge>
                </div>
                {p.slip_file && (
                  <a href={`https://ftiloan.b-cdn.net/${p.slip_file}`} target="_blank" rel="noreferrer"
                    className="text-xs text-brand-600 mt-1 inline-block">View slip →</a>
                )}
              </div>
            ))}
            {!payments?.length && <p className="px-4 py-8 text-center text-sm text-gray-400">No payments</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
