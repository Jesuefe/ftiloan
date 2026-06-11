import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Alert'
import { formatNaira, formatDate, formatDateTime } from '@/lib/utils'
import { ArrowLeft, CheckCircle, Clock, AlertCircle, CreditCard } from 'lucide-react'

export default function AdminRepaymentHistory() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [flash, setFlash] = useState(null)

  const { data: loan } = useQuery({
    queryKey: ['loan-repayment', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('loans')
        .select(`*, users!loans_user_id_fkey(first_name,last_name,phone,email)`)
        .eq('id', id).single()
      if (error) throw error
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
        .select(`*, users!payments_user_id_fkey(first_name,last_name)`)
        .eq('loan_id', id).order('created_at', { ascending: false })
      return data || []
    },
  })

  const paid    = schedule?.filter(s => s.status === 'paid').length || 0
  const overdue = schedule?.filter(s => s.status === 'overdue').length || 0
  const pending = schedule?.filter(s => s.status === 'pending').length || 0
  const partial = schedule?.filter(s => s.status === 'partial').length || 0
  const total   = schedule?.length || 0

  const progress = total > 0 ? Math.round((paid / total) * 100) : 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft size={18} className="text-gray-600"/>
        </button>
        <div>
          <h1 className="text-xl font-bold">{loan?.loan_ref} — Repayment History</h1>
          <p className="text-sm text-gray-500">{loan?.users?.first_name} {loan?.users?.last_name}</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          ['Total',   total,   'gray',  Clock],
          ['Paid',    paid,    'green', CheckCircle],
          ['Pending', pending, 'gray',  Clock],
          ['Partial', partial, 'amber', Clock],
          ['Overdue', overdue, 'red',   AlertCircle],
        ].map(([l,v,c,Icon]) => (
          <div key={l} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold font-display ${c==='green'?'text-green-600':c==='red'?'text-red-600':c==='amber'?'text-amber-600':'text-gray-900'}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-semibold">Repayment Progress</span>
          <span className="font-bold text-brand-600">{progress}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-brand-500 rounded-full transition-all" style={{ width:`${progress}%` }}/>
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-2">
          <span>Paid: {formatNaira(loan?.amount_paid || 0)}</span>
          <span>Outstanding: {formatNaira(loan?.outstanding || 0)}</span>
          <span>Total: {formatNaira(loan?.total_repayment || 0)}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Repayment Schedule */}
        <Card>
          <CardHeader><div className="font-bold">Repayment Schedule ({total} instalments)</div></CardHeader>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">#</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Due Date</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Due</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Paid</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody>
                {schedule?.map((r,i) => (
                  <tr key={r.id} className={`border-b border-gray-100 ${r.status==='overdue'?'bg-red-50':r.status==='paid'?'bg-green-50/50':''}`}>
                    <td className="px-3 py-2 text-gray-400 text-xs">{i+1}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(r.due_date)}</td>
                    <td className="px-3 py-2 font-medium text-xs">{formatNaira(r.amount_due)}</td>
                    <td className="px-3 py-2 text-xs">{formatNaira(r.amount_paid)}</td>
                    <td className="px-3 py-2">
                      <Badge color={r.status==='paid'?'green':r.status==='overdue'?'red':r.status==='partial'?'amber':'gray'} className="text-xs">
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Payment Records */}
        <Card>
          <CardHeader>
            <div className="font-bold flex items-center gap-2"><CreditCard size={16}/> Payment Records</div>
            <span className="text-xs text-gray-500">{payments?.length || 0} payments</span>
          </CardHeader>
          <div className="overflow-y-auto max-h-96">
            {payments?.map(p => (
              <div key={p.id} className={`px-4 py-3 border-b border-gray-100 ${p.status==='confirmed'?'':'opacity-70'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-semibold text-sm">{formatNaira(p.actual_amount || p.amount)}</div>
                    <div className="text-xs text-gray-400">{formatDateTime(p.created_at)}</div>
                    <div className="text-xs text-gray-400 capitalize">{p.payment_method?.replace('_',' ')}</div>
                  </div>
                  <Badge color={p.status==='confirmed'?'green':p.status==='rejected'?'red':'amber'}>
                    {p.status}
                  </Badge>
                </div>
                {p.slip_file && (
                  <a href={`https://ftiloan.b-cdn.net/slips/${p.slip_file}`} target="_blank" rel="noreferrer"
                    className="text-xs text-brand-600 mt-1 inline-block">View slip →</a>
                )}
              </div>
            ))}
            {!payments?.length && <p className="text-sm text-gray-400 text-center py-8">No payments recorded</p>}
          </div>
        </Card>
      </div>
    </div>
  )
}
