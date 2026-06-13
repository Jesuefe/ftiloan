import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { Search, UserPlus, ChevronRight } from 'lucide-react'

export default function AgentClients() {
  const { profile } = useAuthStore()
  const [search, setSearch] = useState('')

  const { data: clients, isLoading } = useQuery({
    queryKey: ['agent-clients', profile?.id, search],
    queryFn: async () => {
      // Get agent record
      const { data: agent } = await supabase
        .from('agents')
        .select('id,zone_id')
        .eq('user_id', profile.id)
        .single()

      // Collect client IDs from two sources:
      // 1. Clients who have loans assigned to this agent
      // 2. Clients in the same zone as the agent
      let clientIds = new Set()

      // From loans
      const { data: loans } = await supabase
        .from('loans')
        .select('user_id')
        .eq('agent_id', agent?.id)
      loans?.forEach(l => clientIds.add(l.user_id))

      // From same zone (clients the agent may have created)
      if (agent?.zone_id) {
        const { data: zoneClients } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'client')
          .eq('zone_id', agent.zone_id)
        zoneClients?.forEach(c => clientIds.add(c.id))
      }

      // Also get ALL clients if no zone is set (fallback — show all clients)
      if (!agent?.zone_id && clientIds.size === 0) {
        const { data: allClients } = await supabase
          .from('users')
          .select('id')
          .eq('role', 'client')
          .limit(100)
        allClients?.forEach(c => clientIds.add(c.id))
      }

      if (clientIds.size === 0) return []

      let q = supabase
        .from('users')
        .select('id,first_name,last_name,phone,email,kyc_verified,kyc_flagged,status,created_at,zone_id')
        .in('id', [...clientIds])
        .order('created_at', { ascending: false })

      if (search.trim()) {
        q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`)
      }

      const { data, error } = await q
      if (error) throw error
      return data || []
    },
    enabled: !!profile?.id,
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Clients</h1>
          <p className="text-sm text-gray-500">{clients?.length || 0} clients</p>
        </div>
        <Link to="/agent/create-client">
          <Button className="gap-2"><UserPlus size={15}/> New Client</Button>
        </Link>
      </div>

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={15} className="text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search clients…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && <div className="col-span-3 py-8 text-center text-gray-400">Loading…</div>}
        {clients?.map(c => (
          <Link key={c.id} to={`/agent/clients/${c.id}`} className="block bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:border-brand-400 hover:shadow-md transition-all">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold flex-shrink-0">
                {c.first_name?.[0]}{c.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-gray-400 truncate">{c.phone || c.email}</div>
              </div>
              <Badge color={c.kyc_verified ? 'green' : 'gray'} className="text-xs flex-shrink-0">
                {c.kyc_verified ? 'KYC ✓' : 'No KYC'}
              </Badge>
            </div>
            <div className="text-xs text-gray-400 mb-3">Joined {formatDate(c.created_at)}</div>
            <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
              <span className="text-xs text-gray-400">Tap to view loans & record payments</span>
              <ChevronRight size={14} className="text-gray-400"/>
            </div>
          </Link>
        ))}
        {!isLoading && !clients?.length && (
          <div className="col-span-3 py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No clients yet.{' '}
            <Link to="/agent/create-client" className="text-brand-600 font-medium">Create one</Link>
          </div>
        )}
      </div>
    </div>
  )
}
