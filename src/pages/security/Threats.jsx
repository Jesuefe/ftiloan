import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'
import { AlertCircle } from 'lucide-react'

export default function SecurityThreats() {
  const [level, setLevel] = useState('all')

  const { data: events, isLoading } = useQuery({
    queryKey: ['security-events', level],
    queryFn: async () => {
      let q = supabase.from('security_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)
      if (level !== 'all') q = q.eq('risk_level', level)
      const { data } = await q
      return data || []
    },
  })

  const levelColor = l => ({ high_risk:'red', suspicious:'amber', normal:'gray' }[l] || 'gray')

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AlertCircle size={20} className="text-red-600"/>
        <div>
          <h1 className="text-xl font-bold">Security Threats</h1>
          <p className="text-sm text-gray-500">{events?.length || 0} events</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {['all','high_risk','suspicious'].map(l => (
          <button key={l} onClick={() => setLevel(l)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${level===l?'bg-brand-600 text-white':'bg-white text-gray-600 border border-gray-200'}`}>
            {l === 'all' ? 'All' : l.replace('_',' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {['Time','IP','Threat','Score','Level','URL'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {events?.map(e => (
              <tr key={e.id} className={`border-b border-gray-100 hover:bg-gray-50 ${e.risk_level==='high_risk'?'bg-red-50':''}`}>
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(e.created_at)}</td>
                <td className="px-4 py-2 font-mono text-xs">{e.ip_address}</td>
                <td className="px-4 py-2"><span className="text-xs font-semibold text-red-600">{e.threat_type}</span></td>
                <td className="px-4 py-2"><span className={`font-bold ${e.risk_score>=70?'text-red-600':e.risk_score>=31?'text-amber-600':'text-gray-500'}`}>{e.risk_score}</span></td>
                <td className="px-4 py-2"><Badge color={levelColor(e.risk_level)} className="text-xs capitalize">{e.risk_level?.replace('_',' ')}</Badge></td>
                <td className="px-4 py-2 text-xs text-gray-400 max-w-xs truncate">{e.request_url}</td>
              </tr>
            ))}
            {!isLoading && !events?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No threat events</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
