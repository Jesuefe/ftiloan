import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Send, MessageCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

export default function ClientChat() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [error, setError] = useState(null)
  const bottomRef = useRef(null)

  // Find this client's agent via their loans
  const { data: agentInfo } = useQuery({
    queryKey: ['client-agent', profile?.id],
    queryFn: async () => {
      const { data: loan } = await supabase
        .from('loans')
        .select('agents!loans_agent_id_fkey(id, user_id, users!agents_user_id_fkey(first_name,last_name))')
        .eq('user_id', profile.id)
        .not('agent_id', 'is', null)
        .limit(1)
        .maybeSingle()
      if (!loan?.agents) return null
      return {
        userId: loan.agents.user_id,
        name: `${loan.agents.users?.first_name || ''} ${loan.agents.users?.last_name || ''}`.trim(),
      }
    },
    enabled: !!profile?.id,
  })

  const { data: messages, isLoading: msgsLoading } = useQuery({
    queryKey: ['chat-msgs', profile?.id, agentInfo?.userId],
    queryFn: async () => {
      if (!agentInfo?.userId) return []
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id,sender_id,receiver_id,message,created_at')
        .or(`and(sender_id.eq.${profile.id},receiver_id.eq.${agentInfo.userId}),and(sender_id.eq.${agentInfo.userId},receiver_id.eq.${profile.id})`)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data || []
    },
    enabled: !!agentInfo?.userId,
    refetchInterval: 5000,
  })

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMsg = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error('Message is empty')
      if (!agentInfo?.userId) throw new Error('No agent assigned')
      const { error } = await supabase.from('chat_messages').insert({
        sender_id:   profile.id,
        receiver_id: agentInfo.userId,
        message:     text.trim(),
        is_read:     false,
      })
      if (error) throw error
    },
    onSuccess: () => {
      setText('')
      setError(null)
      qc.invalidateQueries({ queryKey: ['chat-msgs'] })
    },
    onError: (e) => setError(e.message),
  })

  const handleSend = () => { if (text.trim()) sendMsg.mutate() }
  const handleKey  = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 9rem)' }}>
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <MessageCircle size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Chat</h1>
          <p className="text-sm text-gray-500">
            {agentInfo ? `With ${agentInfo.name}` : 'No agent assigned yet'}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex-shrink-0">
          {error}
        </div>
      )}

      {!agentInfo && !msgsLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center px-4">
            <MessageCircle size={40} className="text-gray-200 mx-auto mb-3"/>
            <div className="font-semibold text-gray-600 mb-1">No agent assigned yet</div>
            <p className="text-sm text-gray-400">Once you apply for a loan, an agent will be assigned and you can chat here.</p>
          </div>
        </div>
      )}

      {agentInfo && (
        <>
          <div className="flex-1 overflow-y-auto bg-gray-50 rounded-2xl p-3 space-y-2 mb-3">
            {msgsLoading && <div className="text-center text-sm text-gray-400 py-8">Loading messages…</div>}
            {messages?.map(msg => {
              const isMe = msg.sender_id === profile.id
              return (
                <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                    isMe ? 'bg-brand-600 text-white rounded-br-sm' : 'bg-white border border-gray-200 text-gray-900 rounded-bl-sm'
                  }`}>
                    <div className="leading-relaxed">{msg.message}</div>
                    <div className={`text-xs mt-1 ${isMe ? 'text-brand-200' : 'text-gray-400'}`}>
                      {formatDateTime(msg.created_at)}
                    </div>
                  </div>
                </div>
              )
            })}
            {!msgsLoading && !messages?.length && (
              <div className="text-center text-sm text-gray-400 py-8">
                Say hello to {agentInfo.name}!
              </div>
            )}
            <div ref={bottomRef}/>
          </div>

          <div className="flex gap-2 flex-shrink-0">
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKey}
              placeholder={`Message ${agentInfo.name}…`}
              rows={1}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sendMsg.isPending}
              className="w-11 h-11 bg-brand-600 rounded-xl flex items-center justify-center text-white hover:bg-brand-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <Send size={16}/>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
