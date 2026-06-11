import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { formatNaira } from '@/lib/utils'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const COLORS = ['#4BB543','#2E7D32','#f59e0b','#ef4444','#3b82f6','#8b5cf6']

export default function AdminAnalytics() {
  const { data } = useQuery({
    queryKey: ['analytics'],
    queryFn: async () => {
      const [loans, payments] = await Promise.all([
        supabase.from('loans').select('amount,status,created_at,loan_type'),
        supabase.from('payments').select('amount,created_at,status').eq('status','confirmed'),
      ])

      // Status breakdown
      const statusMap = {}
      loans.data?.forEach(l => { statusMap[l.status] = (statusMap[l.status]||0)+1 })
      const statusData = Object.entries(statusMap).map(([name,value]) => ({ name: name.replace(/_/g,' '), value }))

      // Monthly disbursements (last 6 months)
      const monthly = {}
      payments.data?.forEach(p => {
        const m = new Date(p.created_at).toLocaleString('default',{month:'short'})
        monthly[m] = (monthly[m]||0) + Number(p.amount)
      })
      const monthlyData = Object.entries(monthly).map(([month,amount]) => ({ month, amount })).slice(-6)

      // Loan type breakdown
      const typeMap = {}
      loans.data?.forEach(l => { typeMap[l.loan_type||'cash'] = (typeMap[l.loan_type||'cash']||0)+1 })
      const typeData = Object.entries(typeMap).map(([name,value]) => ({ name: name.charAt(0).toUpperCase()+name.slice(1)+' Loans', value }))

      return { statusData, monthlyData, typeData,
        totalLoans: loans.data?.length || 0,
        totalPaid:  payments.data?.reduce((s,p) => s+Number(p.amount),0) || 0,
      }
    },
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500">Platform performance overview</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-2xl font-bold font-display">{data?.totalLoans || 0}</div>
          <div className="text-sm text-gray-500">Total Loan Applications</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-2xl font-bold font-display text-green-600">{formatNaira(data?.totalPaid||0)}</div>
          <div className="text-sm text-gray-500">Total Payments Collected</div>
        </CardBody></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><div className="font-bold">Monthly Collections</div></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={data?.monthlyData||[]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
                <XAxis dataKey="month" tick={{ fontSize:12 }}/>
                <YAxis tick={{ fontSize:11 }} tickFormatter={v => '₦'+Number(v/1000).toFixed(0)+'k'}/>
                <Tooltip formatter={v => formatNaira(v)}/>
                <Area type="monotone" dataKey="amount" stroke="#4BB543" fill="#f0faf0" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-bold">Loan Status Breakdown</div></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={data?.statusData||[]} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name,percent }) => `${name} ${(percent*100).toFixed(0)}%`}>
                  {data?.statusData?.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                </Pie>
                <Tooltip/>
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><div className="font-bold">Loan Type Distribution</div></CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data?.typeData||[]}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0"/>
              <XAxis dataKey="name" tick={{ fontSize:12 }}/>
              <YAxis tick={{ fontSize:11 }}/>
              <Tooltip/>
              <Bar dataKey="value" fill="#4BB543" radius={[4,4,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>
    </div>
  )
}
