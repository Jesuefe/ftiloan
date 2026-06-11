import { useState, useRef, useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Sidebar } from './Sidebar'
import { useAuthStore } from '@/store/authStore'
import { Bell, Menu, X, CheckCheck } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

function NotificationPanel({ open, onClose, profile }) {
  const qc = useQueryClient()

  const { data: notifications } = useQuery({
    queryKey: ['notifications', profile?.id],
    queryFn: async () => {
      const { data } = await supabase.from('notifications')
        .select('*').eq('user_id', profile.id)
        .order('created_at', { ascending: false }).limit(20)
      return data || []
    },
    enabled: !!profile?.id && open,
    refetchInterval: open ? 15000 : false,
  })

  const markAll = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').update({ is_read: true })
        .eq('user_id', profile.id).eq('is_read', false)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const typeColor = t => ({ success:'border-green-400 bg-green-50', danger:'border-red-400 bg-red-50', warning:'border-amber-400 bg-amber-50', info:'border-blue-400 bg-blue-50' }[t] || 'border-gray-300 bg-gray-50')
  const typeIcon  = t => ({ success:'✅', danger:'🔴', warning:'⚠️', info:'ℹ️' }[t] || '🔔')

  if (!open) return null

  return (
    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="font-bold text-sm text-gray-900">Notifications</span>
        <div className="flex items-center gap-2">
          <button onClick={() => markAll.mutate()} className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1">
            <CheckCheck size={12}/> Mark all read
          </button>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16}/></button>
        </div>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications?.map(n => (
          <div key={n.id} className={`px-4 py-3 border-b border-gray-100 border-l-4 ${typeColor(n.type)} ${!n.is_read ? 'font-medium' : 'opacity-70'}`}>
            <div className="flex items-start gap-2">
              <span className="text-sm mt-0.5 flex-shrink-0">{typeIcon(n.type)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-900 truncate">{n.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>
                <div className="text-xs text-gray-400 mt-1">{formatDateTime(n.created_at)}</div>
              </div>
              {!n.is_read && <div className="w-2 h-2 bg-brand-500 rounded-full mt-1 flex-shrink-0"/>}
            </div>
          </div>
        ))}
        {!notifications?.length && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No notifications</div>
        )}
      </div>
    </div>
  )
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notifOpen, setNotifOpen]     = useState(false)
  const notifRef = useRef(null)
  const { profile } = useAuthStore()
  const qc = useQueryClient()

  // Unread count
  const { data: unreadCount } = useQuery({
    queryKey: ['unread-count', profile?.id],
    queryFn: async () => {
      const { count } = await supabase.from('notifications')
        .select('id', { count:'exact', head:true })
        .eq('user_id', profile.id).eq('is_read', false)
      return count || 0
    },
    enabled: !!profile?.id,
    refetchInterval: 30000,
  })

  // Close notif panel on outside click
  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openNotif = () => {
    setNotifOpen(v => !v)
    // Mark as read after viewing
    if (!notifOpen) {
      setTimeout(() => {
        supabase.from('notifications').update({ is_read: true })
          .eq('user_id', profile.id).eq('is_read', false)
          .then(() => qc.invalidateQueries({ queryKey: ['unread-count'] }))
      }, 3000)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)}/>

      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 lg:px-6 h-14 flex items-center gap-4">
          <button onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-600">
            <Menu size={20}/>
          </button>

          <div className="flex-1 max-w-sm hidden md:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-1.5">
            <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
            <input placeholder="Search…" className="bg-transparent text-sm outline-none w-full placeholder:text-gray-400"/>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notification bell */}
            <div className="relative" ref={notifRef}>
              <button onClick={openNotif}
                className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600 transition-colors">
                <Bell size={18}/>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center leading-none">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              <NotificationPanel open={notifOpen} onClose={() => setNotifOpen(false)} profile={profile}/>
            </div>

            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold select-none">
              {profile?.first_name?.[0]}{profile?.last_name?.[0]}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet/>
        </main>
      </div>
    </div>
  )
}
