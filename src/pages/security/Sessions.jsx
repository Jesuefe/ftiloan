import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDateTime } from '@/lib/utils'
import { Users, Trash2 } from 'lucide-react'

export default function SecuritySessions() {
  const qc = useQueryClient()

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['active-sessions'],
    queryFn: async () => {
      const { data } = await supabase.from('active_sessions')
        .select(`*, users(first_name,last_name,role,email)`)
        .order('last_activity', { ascending: false })
        .limit(50)
      return data || []
    },
    refetchInterval: 30000, // refresh every 30s
  })

  const terminate = useMutation({
    mutationFn: async (id) => {
      await supabase.from('active_sessions').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-sessions'] }),
  })

  const terminateAll = useMutation({
    mutationFn: async () => {
      await supabase.from('active_sessions').delete().neq('id', 0)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['active-sessions'] }),
  })

  const roleColor = r => ({ super_admin:'purple',manager:'blue',agent:'green',client:'gray',operator:'amber',auditor:'amber',security_officer:'red' }[r] || 'gray')

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><Users size={20} className="text-brand-600"/> Active Sessions</h1>
          <p className="text-sm text-gray-500">{sessions?.length || 0} active sessions</p>
        </div>
        <Button variant="danger" size="sm" onClick={() => terminateAll.mutate()} loading={terminateAll.isPending}>
          Terminate All
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {['User','Role','IP Address','Last Active',''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {sessions?.map(s => (
              <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium">{s.users?.first_name} {s.users?.last_name}</div>
                  <div className="text-xs text-gray-400">{s.users?.email}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge color={roleColor(s.users?.role)} className="capitalize text-xs">
                    {s.users?.role?.replace(/_/g,' ')}
                  </Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{s.ip_address}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDateTime(s.last_activity)}</td>
                <td className="px-4 py-3">
                  <Button size="sm" variant="danger" onClick={() => terminate.mutate(s.id)}>
                    <Trash2 size={12}/>
                  </Button>
                </td>
              </tr>
            ))}
            {!isLoading && !sessions?.length && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No active sessions</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
