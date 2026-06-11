import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { Search, Eye, Shield, ShieldOff } from 'lucide-react'

export default function AdminClients() {
  const [search, setSearch] = useState('')

  const { data: clients, isLoading } = useQuery({
    queryKey: ['admin-clients', search],
    queryFn: async () => {
      let q = supabase
        .from('users')
        .select('id,first_name,last_name,email,phone,status,kyc_verified,kyc_flagged,blacklisted,created_at,bvn_number,nin_number')
        .eq('role', 'client')
        .order('created_at', { ascending: false })
        .limit(100)
      if (search.trim()) {
        q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">{clients?.length || 0} registered clients</p>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 mb-4 max-w-sm">
        <Search size={15} className="text-gray-400"/>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search name, email, phone…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">KYC</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {!isLoading && clients?.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs flex-shrink-0">
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <div>
                        <div className="font-medium">{c.first_name} {c.last_name}</div>
                        <div className="text-xs text-gray-400">{c.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {c.kyc_verified
                        ? <Badge color="green">Verified</Badge>
                        : <Badge color="gray">Unverified</Badge>}
                      {c.kyc_flagged && <Badge color="red">Flagged</Badge>}
                      {c.blacklisted && <Badge color="red">Blacklisted</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color={c.status==='active'?'green':c.status==='suspended'?'red':'gray'}>
                      {c.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/clients/${c.id}`}>
                      <Button variant="outline" size="sm"><Eye size={12}/></Button>
                    </Link>
                  </td>
                </tr>
              ))}
              {!isLoading && !clients?.length && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No clients found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
