import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils'
import { Shield } from 'lucide-react'

export default function AdminBlacklist() {
  const qc = useQueryClient()
  const [flash, setFlash] = useState(null)

  const { data: clients, isLoading } = useQuery({
    queryKey: ['blacklisted'],
    queryFn: async () => {
      const { data } = await supabase.from('users').select('id,first_name,last_name,email,phone,blacklisted,blacklist_note,bvn_number,created_at')
        .eq('role','client').eq('blacklisted',true).order('created_at',{ascending:false})
      return data || []
    },
  })

  const remove = useMutation({
    mutationFn: async (id) => { await supabase.from('users').update({ blacklisted:false, blacklist_note:null }).eq('id',id) },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['blacklisted'] }); setFlash({ type:'success', msg:'Removed from blacklist.' }) },
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Shield size={20} className="text-red-600"/>
        <div><h1 className="text-xl font-bold">Blacklist</h1><p className="text-sm text-gray-500">{clients?.length||0} blacklisted clients</p></div>
      </div>
      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="bg-gray-50 border-b border-gray-200">
            {['Client','Phone','BVN','Reason','Blacklisted',''].map(h => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
            {clients?.map(c => (
              <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3"><div className="font-medium">{c.first_name} {c.last_name}</div><div className="text-xs text-gray-400">{c.email}</div></td>
                <td className="px-4 py-3">{c.phone}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.bvn_number ? c.bvn_number.slice(0,4)+'*******':'—'}</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{c.blacklist_note||'—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.created_at)}</td>
                <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => remove.mutate(c.id)}>Remove</Button></td>
              </tr>
            ))}
            {!isLoading && !clients?.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No blacklisted clients</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
