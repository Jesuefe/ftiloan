import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'

export default function AuditorLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['auditor-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('audit_logs')
        .select(`*, users(first_name,last_name,role)`)
        .order('created_at', { ascending:false }).limit(100)
      return data || []
    },
  })

  return (
    <div>
      <div className="mb-6"><h1 className="text-xl font-bold">Audit Logs</h1><p className="text-sm text-gray-500">System activity</p></div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {['Time','User','Action','Module','Details'].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {logs?.map(log => (
              <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                <td className="px-4 py-2 text-xs font-medium">{log.users ? `${log.users.first_name} ${log.users.last_name}` : 'System'}</td>
                <td className="px-4 py-2"><span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded">{log.action}</span></td>
                <td className="px-4 py-2 text-xs text-gray-500">{log.module}</td>
                <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">{log.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
