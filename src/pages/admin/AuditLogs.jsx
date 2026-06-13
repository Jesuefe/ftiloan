import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatDateTime } from '@/lib/utils'
import { Search } from 'lucide-react'

export default function AdminAuditLogs() {
  const [search, setSearch] = useState('')

  const { data: logs, isLoading } = useQuery({
    queryKey: ['audit-logs', search],
    queryFn: async () => {
      let q = supabase.from('audit_logs').select('*, users(first_name,last_name,role)')
        .order('created_at', { ascending: false }).limit(100)
      if (search) q = q.ilike('action', `%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const actionColor = (a) => {
    if (a?.includes('REJECT')||a?.includes('FAIL')||a?.includes('BLOCK')) return 'text-red-600 bg-red-50'
    if (a?.includes('APPROVE')||a?.includes('SUCCESS')||a?.includes('CREATE')) return 'text-green-600 bg-green-50'
    if (a?.includes('LOGIN')||a?.includes('UPDATE')) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Audit Logs</h1>
        <p className="text-sm text-gray-500">All system activity</p>
      </div>

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-4">
        <Search size={15} className="text-gray-400 flex-shrink-0"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action…"
          className="bg-transparent text-sm outline-none w-full"/>
      </div>

      {/* Mobile */}
      <div className="space-y-2 lg:hidden">
        {isLoading && <div className="py-8 text-center text-sm text-gray-400">Loading…</div>}
        {logs?.map(log => (
          <div key={log.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start justify-between mb-2">
              <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${actionColor(log.action)}`}>{log.action}</span>
              <span className="text-xs text-gray-400">{formatDateTime(log.created_at)}</span>
            </div>
            <div className="text-sm font-medium text-gray-900">{log.users ? `${log.users.first_name} ${log.users.last_name}` : 'System'}</div>
            {log.module && <div className="text-xs text-gray-400 mt-0.5">{log.module}</div>}
            {log.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{log.description}</div>}
          </div>
        ))}
        {!isLoading && !logs?.length && <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-200">No logs found</div>}
      </div>

      {/* Desktop */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['Time','User','Action','Module','Details','IP'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {logs?.map(log => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-2 text-xs">{log.users ? <div><div className="font-medium">{log.users.first_name} {log.users.last_name}</div><div className="text-gray-400 capitalize">{log.users.role?.replace('_',' ')}</div></div> : <span className="text-gray-400">System</span>}</td>
                  <td className="px-4 py-2"><span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${actionColor(log.action)}`}>{log.action}</span></td>
                  <td className="px-4 py-2 text-xs text-gray-500">{log.module}</td>
                  <td className="px-4 py-2 text-xs text-gray-500 max-w-xs truncate">{log.description}</td>
                  <td className="px-4 py-2 text-xs font-mono text-gray-400">{log.ip_address}</td>
                </tr>
              ))}
              {!isLoading && !logs?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No logs found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
