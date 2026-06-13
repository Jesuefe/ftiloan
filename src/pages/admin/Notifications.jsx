import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Bell, Send, Users, User } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function AdminNotifications() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [flash, setFlash] = useState(null)
  const [form, setForm] = useState({ title: '', message: '', type: 'info', target: 'all', role: 'client', user_id: '' })
  const set = (k,v) => setForm(f => ({...f,[k]:v}))

  const { data: recent } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: async () => {
      const { data } = await supabase.from('notifications')
        .select('*, users!notifications_user_id_fkey(first_name,last_name)')
        .order('created_at', { ascending: false }).limit(30)
      return data || []
    },
  })

  const send = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.message) throw new Error('Title and message are required')

      let userIds = []

      if (form.target === 'all') {
        const { data } = await supabase.from('users').select('id').eq('status','active')
        userIds = data?.map(u => u.id) || []
      } else if (form.target === 'role') {
        const { data } = await supabase.from('users').select('id').eq('role', form.role).eq('status','active')
        userIds = data?.map(u => u.id) || []
      } else if (form.target === 'user') {
        if (!form.user_id) throw new Error('Enter a user ID')
        userIds = [form.user_id]
      }

      if (!userIds.length) throw new Error('No users found for selected target')

      const rows = userIds.map(uid => ({
        user_id: uid,
        title: form.title,
        message: form.message,
        type: form.type,
        is_read: false,
        created_by: profile.id,
      }))

      const { error } = await supabase.from('notifications').insert(rows)
      if (error) throw error
      return userIds.length
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ['admin-notifications'] })
      setFlash({ type: 'success', msg: `✅ Notification sent to ${count} user${count !== 1 ? 's' : ''}.` })
      setForm({ title: '', message: '', type: 'info', target: 'all', role: 'client', user_id: '' })
    },
    onError: e => setFlash({ type: 'danger', msg: e.message }),
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Bell size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold">Notifications</h1>
          <p className="text-sm text-gray-500">Broadcast messages to users</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Compose */}
        <Card>
          <CardHeader><div className="font-bold flex items-center gap-2"><Send size={15}/> Send Notification</div></CardHeader>
          <CardBody>
            <Input label="Title *" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Payment Reminder"/>
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Message *</label>
              <textarea value={form.message} onChange={e => set('message', e.target.value)}
                rows={4} placeholder="Write your notification message…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"/>
            </div>
            <Select label="Type" value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="info">ℹ️ Info</option>
              <option value="success">✅ Success</option>
              <option value="warning">⚠️ Warning</option>
              <option value="danger">🔴 Alert</option>
            </Select>
            <Select label="Send To" value={form.target} onChange={e => set('target', e.target.value)}>
              <option value="all">👥 Everyone</option>
              <option value="role">🎯 By Role</option>
              <option value="user">👤 Specific User</option>
            </Select>
            {form.target === 'role' && (
              <Select label="Role" value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="client">Clients</option>
                <option value="agent">Agents</option>
                <option value="manager">Managers</option>
                <option value="operator">Operators</option>
                <option value="auditor">Auditors</option>
              </Select>
            )}
            {form.target === 'user' && (
              <Input label="User ID" value={form.user_id} onChange={e => set('user_id', e.target.value)} placeholder="Paste the user's UUID"/>
            )}
            <Button loading={send.isPending} onClick={() => send.mutate()} className="w-full justify-center gap-2 mt-2">
              <Send size={14}/> Send Notification
            </Button>
          </CardBody>
        </Card>

        {/* Recent */}
        <Card>
          <CardHeader><div className="font-bold">Recent Broadcasts</div></CardHeader>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {recent?.map(n => (
              <div key={n.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 truncate">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      To: {n.users?.first_name} {n.users?.last_name} · {formatDateTime(n.created_at)}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                    n.type === 'success' ? 'bg-green-100 text-green-700' :
                    n.type === 'danger'  ? 'bg-red-100 text-red-700' :
                    n.type === 'warning' ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-100 text-blue-700'}`}>{n.type}</span>
                </div>
              </div>
            ))}
            {!recent?.length && <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications sent yet</div>}
          </div>
        </Card>
      </div>
    </div>
  )
}
