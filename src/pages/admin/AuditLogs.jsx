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
      let q = supabase.from('audit_logs')
        .select(`*, users(first_name,last_name,role)`)
        .order('created_at', { ascending: false }).limit(100)
      if (search) q = q.ilike('action', `%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const actionColor = (action) => {
    if (action?.includes('REJECT') || action?.includes('FAIL') || action?.includes('BLOCK')) return 'text-red-600 bg-red-50'
    if (action?.includes('APPROVE') || action?.includes('SUCCESS') || action?.includes('CREATE')) return 'text-green-600 bg-green-50'
    if (action?.includes('LOGIN') || action?.includes('UPDATE')) return 'text-blue-600 bg-blue-50'
    return 'text-gray-600 bg-gray-50'
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-sm text-gray-500">All system activity</p>
      </div>

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={15} className="text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search action…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Module</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IP</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {logs?.map(log => (
                <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="px-4 py-2 text-xs">
                    {log.users ? <div><div className="font-medium">{log.users.first_name} {log.users.last_name}</div><div className="text-gray-400 capitalize">{log.users.role?.replace('_',' ')}</div></div> : <span className="text-gray-400">System</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded ${actionColor(log.action)}`}>{log.action}</span>
                  </td>
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
