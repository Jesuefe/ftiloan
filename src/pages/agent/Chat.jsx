import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Send, MessageCircle, Search } from 'lucide-react'
import { formatDateTime, formatDate } from '@/lib/utils'

export default function AgentChat() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [selectedClient, setSelectedClient] = useState(null)
  const [text, setText] = useState('')
  const [search, setSearch] = useState('')
  const bottomRef = useRef(null)

  // Get agent's clients
  const { data: clients } = useQuery({
    queryKey: ['agent-chat-clients', profile?.id],
    queryFn: async () => {
      const { data: agent } = await supabase.from('agents').select('id').eq('user_id', profile.id).single()
      if (!agent) return []
      const { data: loans } = await supabase.from('loans')
        .select('user_id, users!loans_user_id_fkey(id,first_name,last_name,phone)')
        .eq('agent_id', agent.id)
      // Deduplicate by user_id
      const seen = new Set()
      return (loans || []).filter(l => {
        if (seen.has(l.user_id)) return false
        seen.add(l.user_id); return true
      }).map(l => l.users).filter(Boolean)
    },
    enabled: !!profile?.id,
  })

  const filtered = clients?.filter(c =>
    `${c.first_name} ${c.last_name}`.toLowerCase().includes(search.toLowerCase())
  ) || []

  // Get messages with selected client
  const { data: messages } = useQuery({
    queryKey: ['agent-chat-msgs', profile?.id, selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient) return []
      const { data } = await supabase.from('chat_messages')
        .select('*')
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${selectedClient.id}),and(sender_id.eq.${selectedClient.id},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true })
      return data || []
    },
    enabled: !!selectedClient,
    refetchInterval: 5000,
  })

  // Unread counts per client
  const { data: unreadMap } = useQuery({
    queryKey: ['agent-unread', profile?.id],
    queryFn: async () => {
      if (!clients?.length) return {}
      const { data } = await supabase.from('chat_messages')
        .select('sender_id')
        .eq('receiver_id', profile.id)
        .eq('is_read', false)
      const map = {}
      data?.forEach(m => { map[m.sender_id] = (map[m.sender_id] || 0) + 1 })
      return map
    },
    enabled: !!clients?.length,
    refetchInterval: 10000,
  })

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const sendMsg = useMutation({
    mutationFn: async () => {
      if (!text.trim() || !selectedClient) return
      const { error } = await supabase.from('chat_messages').insert({
        sender_id:   profile.id,
        receiver_id: selectedClient.id,
        message:     text.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => { setText(''); qc.invalidateQueries({ queryKey: ['agent-chat-msgs'] }) },
  })

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg.mutate() } }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3">
      {/* Client list — hidden on mobile when chat open */}
      <div className={`${selectedClient ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-64 flex-shrink-0`}>
        <div className="font-bold text-gray-900 mb-3 flex items-center gap-2">
          <MessageCircle size={18} className="text-brand-600"/> My Clients
        </div>
        <div className="flex items-center gap-2 bg-gray-100 rounded-xl px-3 py-2 mb-3">
          <Search size={13} className="text-gray-400"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients…"
            className="bg-transparent text-sm outline-none w-full"/>
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {filtered.map(c => (
            <button key={c.id} onClick={() => setSelectedClient(c)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${selectedClient?.id === c.id ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50'}`}>
              <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {c.first_name?.[0]}{c.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-gray-400">{c.phone}</div>
              </div>
              {unreadMap?.[c.id] > 0 && (
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {unreadMap[c.id]}
                </div>
              )}
            </button>
          ))}
          {!filtered.length && <div className="text-center text-sm text-gray-400 py-8">No clients yet</div>}
        </div>
      </div>

      {/* Chat window */}
      {selectedClient ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center gap-3 mb-3 flex-shrink-0">
            <button onClick={() => setSelectedClient(null)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">←</button>
            <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold">
              {selectedClient.first_name?.[0]}{selectedClient.last_name?.[0]}
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm">{selectedClient.first_name} {selectedClient.last_name}</div>
              <div className="text-xs text-gray-400">{selectedClient.phone}</div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl p-4 space-y-3 mb-3">
            {messages?.map(msg => {
              const isMe = msg.sender_id === profile.id
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'}`}>
                    <div className="text-sm leading-relaxed">{msg.message}</div>
                    <div className={`text-xs mt-1 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>{formatDateTime(msg.created_at)}</div>
                  </div>
                </div>
              )
            })}
            {!messages?.length && (
              <div className="text-center text-sm text-gray-400 py-8">No messages with {selectedClient.first_name} yet</div>
            )}
            <div ref={bottomRef}/>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <textarea value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKey}
              placeholder={`Message ${selectedClient.first_name}…`} rows={1}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"/>
            <button onClick={() => sendMsg.mutate()} disabled={!text.trim()}
              className="w-11 h-11 bg-brand-600 rounded-xl flex items-center justify-center text-white hover:bg-brand-700 disabled:opacity-50 transition-colors flex-shrink-0">
              <Send size={16}/>
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center">
          <div className="text-center">
            <MessageCircle size={40} className="text-gray-200 mx-auto mb-3"/>
            <div className="font-medium text-gray-500">Select a client to start chatting</div>
          </div>
        </div>
      )}
    </div>
  )
}
