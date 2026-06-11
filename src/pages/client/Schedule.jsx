import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { formatNaira, formatDate } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'

export default function ClientSchedule() {
  const { profile } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['client-schedule', profile?.id],
    queryFn: async () => {
      const { data: loans } = await supabase.from('loans')
        .select('id,loan_ref').eq('user_id', profile.id).in('status', ['active','disbursed'])
      if (!loans?.length) return []
      const ids = loans.map(l => l.id)
      const { data: schedule } = await supabase.from('repayment_schedule')
        .select('*, loans(loan_ref)').in('loan_id', ids).order('due_date', { ascending: true })
      return schedule || []
    },
    enabled: !!profile?.id,
  })

  const paid    = data?.filter(r => r.status === 'paid').length || 0
  const overdue = data?.filter(r => r.status === 'overdue').length || 0
  const pending = data?.filter(r => r.status === 'pending').length || 0

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <CalendarDays size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Repayment Schedule</h1>
          <p className="text-sm text-gray-500">{data?.length || 0} instalments</p>
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        {[['Paid', paid, 'bg-green-100 text-green-700'], ['Pending', pending, 'bg-gray-100 text-gray-600'], ['Overdue', overdue, 'bg-red-100 text-red-700']].map(([l,v,cls]) => (
          <div key={l} className={`rounded-xl px-4 py-3 ${cls}`}>
            <div className="text-xl font-bold">{v}</div>
            <div className="text-xs font-medium">{l}</div>
          </div>
        ))}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Loan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount Due</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {data?.map((r,i) => (
                <tr key={r.id} className={`border-b border-gray-100 ${r.status==='overdue'?'bg-red-50':''}`}>
                  <td className="px-4 py-3 text-gray-500">{i+1}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.loans?.loan_ref}</td>
                  <td className="px-4 py-3">{formatDate(r.due_date)}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(r.amount_due)}</td>
                  <td className="px-4 py-3">{formatNaira(r.amount_paid)}</td>
                  <td className="px-4 py-3">
                    <Badge color={r.status==='paid'?'green':r.status==='overdue'?'red':r.status==='partial'?'amber':'gray'}>
                      {r.status}
                    </Badge>
                  </td>
                </tr>
              ))}
              {!isLoading && !data?.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No schedule yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
