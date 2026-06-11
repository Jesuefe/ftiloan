import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatNaira } from '@/lib/utils'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

export default function AuditorReports() {
  const { data: summary } = useQuery({
    queryKey: ['auditor-summary'],
    queryFn: async () => {
      const [loans, payments, clients] = await Promise.all([
        supabase.from('loans').select('id,status,amount,outstanding'),
        supabase.from('payments').select('amount,status'),
        supabase.from('users').select('id',{count:'exact'}).eq('role','client'),
      ])
      const totalDisbursed = loans.data?.filter(l => ['active','disbursed','completed'].includes(l.status)).reduce((s,l)=>s+Number(l.amount),0)||0
      const totalOutstanding = loans.data?.reduce((s,l)=>s+Number(l.outstanding),0)||0
      const totalCollected = payments.data?.filter(p=>p.status==='confirmed').reduce((s,p)=>s+Number(p.amount),0)||0
      const statusMap = {}
      loans.data?.forEach(l => { statusMap[l.status] = (statusMap[l.status]||0)+1 })
      return { totalDisbursed, totalOutstanding, totalCollected, statusMap, totalClients: clients.count||0, totalLoans: loans.data?.length||0 }
    },
  })

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold">Audit Reports</h1><p className="text-sm text-gray-500">Portfolio summary</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {[
          ['Total Clients',    summary?.totalClients||0,              'text-blue-600'],
          ['Total Loans',      summary?.totalLoans||0,                'text-purple-600'],
          ['Total Disbursed',  formatNaira(summary?.totalDisbursed||0), 'text-green-600'],
          ['Outstanding',      formatNaira(summary?.totalOutstanding||0),'text-amber-600'],
          ['Total Collected',  formatNaira(summary?.totalCollected||0), 'text-green-600'],
          ['Active Loans',     summary?.statusMap?.active||0,          'text-green-600'],
        ].map(([l,v,cls]) => (
          <Card key={l}><CardBody>
            <div className={`text-2xl font-bold font-display ${cls}`}>{v}</div>
            <div className="text-sm text-gray-500 mt-1">{l}</div>
          </CardBody></Card>
        ))}
      </div>
      <Card>
        <CardHeader><div className="font-bold">Loan Status Breakdown</div></CardHeader>
        <CardBody>
          <div className="space-y-3">
            {Object.entries(summary?.statusMap||{}).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between">
                <span className="text-sm capitalize text-gray-600">{status.replace(/_/g,' ')}</span>
                <div className="flex items-center gap-3">
                  <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full"
                      style={{width:`${Math.round(count/(summary?.totalLoans||1)*100)}%`}}/>
                  </div>
                  <span className="text-sm font-bold w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
