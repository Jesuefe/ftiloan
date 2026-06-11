import { useAuthStore } from '@/store/authStore'
import { useLoans } from '@/hooks/useLoans'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatNaira, formatDate, loanStatusColor, loanStatusLabel } from '@/lib/utils'

export default function Dashboard() {
  const { profile } = useAuthStore()
  const { data: loans } = useLoans({ userId: profile?.id, limit: 5 })

  return (
    <div>
      <div className="page-hdr">
        <div>
          <div className="page-title">Welcome, {profile?.first_name}</div>
          <div className="page-sub capitalize">{profile?.role?.replace(/_/g,' ')} Dashboard</div>
        </div>
      </div>
      <Card>
        <CardHeader><div className="font-bold">Recent Activity</div></CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {loans?.map(loan => (
                <tr key={loan.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs">{loan.loan_ref}</td>
                  <td className="px-4 py-3 font-semibold">{formatNaira(loan.amount)}</td>
                  <td className="px-4 py-3"><Badge color={loanStatusColor(loan.status)}>{loanStatusLabel(loan.status)}</Badge></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(loan.created_at)}</td>
                </tr>
              ))}
              {!loans?.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">No activity yet</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
