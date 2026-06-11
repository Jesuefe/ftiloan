import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'

export default function SecurityReports() {
  const { data: summary } = useQuery({
    queryKey: ['security-summary'],
    queryFn: async () => {
      const [blocked, sessions, events] = await Promise.all([
        supabase.from('blocked_ips').select('id',{count:'exact'}).eq('is_active',true),
        supabase.from('active_sessions').select('id',{count:'exact'}),
        supabase.from('security_events').select('risk_level').order('created_at',{ascending:false}).limit(100),
      ])
      const threatMap = {}
      events.data?.forEach(e => { threatMap[e.risk_level] = (threatMap[e.risk_level]||0)+1 })
      return { blockedIPs: blocked.count||0, activeSessions: sessions.count||0, threatMap }
    },
  })

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold">Security Reports</h1><p className="text-sm text-gray-500">System security overview</p></div>
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><CardBody>
          <div className="text-2xl font-bold text-red-600">{summary?.blockedIPs||0}</div>
          <div className="text-sm text-gray-500 mt-1">Blocked IPs</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-2xl font-bold text-green-600">{summary?.activeSessions||0}</div>
          <div className="text-sm text-gray-500 mt-1">Active Sessions</div>
        </CardBody></Card>
        <Card><CardBody>
          <div className="text-2xl font-bold text-amber-600">{summary?.threatMap?.high_risk||0}</div>
          <div className="text-sm text-gray-500 mt-1">High Risk Events</div>
        </CardBody></Card>
      </div>
      <Card>
        <CardHeader><div className="font-bold">Threat Breakdown (last 100 events)</div></CardHeader>
        <CardBody>
          {Object.entries(summary?.threatMap||{}).map(([level, count]) => (
            <div key={level} className="flex items-center justify-between mb-3">
              <Badge color={level==='high_risk'?'red':level==='suspicious'?'amber':'gray'} className="capitalize">
                {level.replace('_',' ')}
              </Badge>
              <span className="font-bold">{count}</span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  )
}
