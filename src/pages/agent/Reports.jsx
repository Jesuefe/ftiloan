import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatNaira } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

export default function AgentReports() {
  const { profile } = useAuthStore()

  const { data: stats } = useQuery({
    queryKey: ['agent-report', profile?.id],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      if (!agent) return null

      const [loans, payments] = await Promise.all([
        supabase.from('loans').select('id,amount,status,created_at').eq('agent_id', agent.id),
        supabase.from('payments').select('amount,status,created_at').eq('agent_id', agent.id).eq('status','confirmed'),
      ])

      const statusMap = {}
      loans.data?.forEach(l => { statusMap[l.status] = (statusMap[l.status]||0)+1 })

      const monthly = {}
      payments.data?.forEach(p => {
        const m = new Date(p.created_at).toLocaleString('default',{month:'short'})
        monthly[m] = (monthly[m]||0) + Number(p.amount)
      })

      return {
        totalLoans:    loans.data?.length || 0,
        totalCollected: payments.data?.reduce((s,p) => s+Number(p.amount),0) || 0,
        activeLoans:   statusMap.active || 0,
        completedLoans: statusMap.completed || 0,
        defaultedLoans: statusMap.defaulted || 0,
        monthlyData:   Object.entries(monthly).map(([month,amount]) => ({ month, amount })).slice(-6),
      }
    },
    enabled: !!profile?.id,
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">My Reports</h1>
        <p className="text-sm text-gray-500">Performance summary</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          ['Total Loans',   stats?.totalLoans||0,       'text-gray-900'],
          ['Active',        stats?.activeLoans||0,      'text-green-600'],
          ['Completed',     stats?.completedLoans||0,   'text-blue-600'],
          ['Defaulted',     stats?.defaultedLoans||0,   'text-red-600'],
        ].map(([l,v,cls]) => (
          <div key={l} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={`text-2xl font-bold font-display ${cls}`}>{v}</div>
            <div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><div className="font-bold">Total Collections</div></CardHeader>
          <CardBody>
            <div className="text-3xl font-bold font-display text-green-600 mb-1">{formatNaira(stats?.totalCollected||0)}</div>
            <div className="text-sm text-gray-500">Total payments confirmed</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-bold">Monthly Collections</div></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats?.monthlyData||[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="month" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:10}} tickFormatter={v => '₦'+Number(v/1000).toFixed(0)+'k'}/>
                <Tooltip formatter={v => formatNaira(v)}/>
                <Bar dataKey="amount" fill="#4BB543" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
