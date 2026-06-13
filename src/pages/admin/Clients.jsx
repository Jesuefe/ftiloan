import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Alert'
import { formatDate } from '@/lib/utils'
import { Search, Eye, Trash2, AlertTriangle } from 'lucide-react'

export default function AdminClients() {
  const [search, setSearch]       = useState('')
  const [delTarget, setDelTarget] = useState(null)
  const [confirmText, setConfirmText] = useState('')
  const [flash, setFlash]         = useState(null)
  const qc = useQueryClient()

  const { data: clients, isLoading } = useQuery({
    queryKey: ['admin-clients', search],
    queryFn: async () => {
      let q = supabase.from('users')
        .select('id,first_name,last_name,email,phone,status,kyc_verified,kyc_flagged,blacklisted,created_at,bvn_number,nin_number')
        .eq('role', 'client').order('created_at', { ascending: false }).limit(100)
      if (search.trim()) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
      const { data, error } = await q
      if (error) throw error
      return data || []
    },
  })

  const deleteUser = useMutation({
    mutationFn: async (userId) => {
      // Get all loan IDs first
      const { data: userLoans } = await supabase.from('loans').select('id').eq('user_id', userId)
      const loanIds = userLoans?.map(l => l.id) || []

      // Delete repayment schedule rows
      if (loanIds.length) {
        await supabase.from('repayment_schedule').delete().in('loan_id', loanIds)
      }

      // Delete payment records
      await supabase.from('payments').delete().eq('user_id', userId)

      // Delete guarantors
      if (loanIds.length) {
        await supabase.from('guarantors').delete().in('loan_id', loanIds)
      }

      // Delete loans
      await supabase.from('loans').delete().eq('user_id', userId)

      // Delete notifications
      await supabase.from('notifications').delete().eq('user_id', userId)

      // Delete chat messages
      try {
        await supabase.from('chat_messages').delete().eq('sender_id', userId)
        await supabase.from('chat_messages').delete().eq('receiver_id', userId)
      } catch(e) { /* chat_messages may not exist */ }

      // Finally delete user
      const { error } = await supabase.from('users').delete().eq('id', userId)
      if (error) throw new Error('Delete failed: ' + error.message)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-clients'] })
      setDelTarget(null)
      setConfirmText('')
      setFlash({ type: 'success', msg: 'User and all records permanently deleted.' })
    },
    onError: e => setFlash({ type: 'danger', msg: e.message }),
  })

  const canDelete = confirmText === 'DELETE'

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500">{clients?.length || 0} registered</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2.5 mb-4">
        <Search size={15} className="text-gray-400 flex-shrink-0"/>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, email, phone…"
          className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
      </div>

      {/* Mobile */}
      <div className="space-y-2 lg:hidden">
        {isLoading && <div className="py-8 text-center text-sm text-gray-400">Loading…</div>}
        {clients?.map(c => (
          <div key={c.id} className="bg-white rounded-2xl border border-gray-200 px-4 py-3">
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-sm text-gray-900">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-gray-400">{c.email}</div>
                <div className="text-xs text-gray-400 mt-0.5">{c.phone || '—'} · {formatDate(c.created_at)}</div>
                <div className="flex gap-1.5 mt-1.5">
                  <Badge color={c.status==='active'?'green':'red'}>{c.status}</Badge>
                  {c.kyc_verified ? <Badge color="green">KYC ✓</Badge> : <Badge color="gray">No KYC</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Link to={`/admin/clients/${c.id}`}>
                  <Button variant="outline" size="sm"><Eye size={13}/></Button>
                </Link>
                <button onClick={() => { setDelTarget(c); setConfirmText('') }}
                  className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                  <Trash2 size={13}/>
                </button>
              </div>
            </div>
          </div>
        ))}
        {!isLoading && !clients?.length && <div className="py-12 text-center text-sm text-gray-400 bg-white rounded-2xl border border-gray-200">No clients found</div>}
      </div>

      {/* Desktop */}
      <div className="hidden lg:block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 border-b border-gray-200">
              {['Client','Phone','KYC','Status','Joined',''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>}
              {clients?.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xs flex-shrink-0">
                        {c.first_name?.[0]}{c.last_name?.[0]}
                      </div>
                      <div><div className="font-medium">{c.first_name} {c.last_name}</div><div className="text-xs text-gray-400">{c.email}</div></div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {c.kyc_verified ? <Badge color="green">Verified</Badge> : <Badge color="gray">Unverified</Badge>}
                      {c.kyc_flagged && <Badge color="red">Flagged</Badge>}
                      {c.blacklisted && <Badge color="red">Blacklisted</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge color={c.status==='active'?'green':'red'}>{c.status}</Badge></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link to={`/admin/clients/${c.id}`}><Button variant="outline" size="sm"><Eye size={12}/></Button></Link>
                      <button onClick={() => { setDelTarget(c); setConfirmText('') }}
                        className="p-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                        <Trash2 size={14}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !clients?.length && <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No clients found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      <Modal open={!!delTarget} onClose={() => setDelTarget(null)} title="⚠️ Delete User — Dangerous Operation">
        <div className="mb-4 p-4 bg-red-50 border border-red-300 rounded-xl flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-600 flex-shrink-0 mt-0.5"/>
          <div className="text-sm text-red-800">
            <div className="font-bold mb-1">This action is permanent and cannot be undone.</div>
            <div>Deleting <strong>{delTarget?.first_name} {delTarget?.last_name}</strong> will permanently remove:</div>
            <ul className="list-disc ml-4 mt-1 space-y-0.5">
              <li>Their account and all personal data</li>
              <li>All their loan applications</li>
              <li>All payment records</li>
              <li>All repayment schedule rows</li>
              <li>All notifications and chat messages</li>
            </ul>
          </div>
        </div>
        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-700 mb-1">
            Type <span className="font-mono bg-gray-100 px-1 rounded">DELETE</span> to confirm
          </label>
          <input
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-400"
          />
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setDelTarget(null)}>Cancel</Button>
          <button
            onClick={() => deleteUser.mutate(delTarget.id)}
            disabled={!canDelete || deleteUser.isPending}
            className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-40 transition-colors"
          >
            {deleteUser.isPending ? 'Deleting…' : 'Permanently Delete'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
