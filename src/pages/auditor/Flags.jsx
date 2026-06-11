import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Badge } from '@/components/ui/Badge'
import { formatDateTime } from '@/lib/utils'
import { AlertTriangle } from 'lucide-react'

export default function AuditorFlags() {
  const { data: flags, isLoading } = useQuery({
    queryKey: ['audit-flags'],
    queryFn: async () => {
      const { data } = await supabase.from('users')
        .select('id,first_name,last_name,email,phone,kyc_flagged,kyc_message,fraud_flag,fraud_notes,blacklisted,blacklist_note,dup_bvn_flag,kyc_checked_at')
        .eq('role','client')
        .or('kyc_flagged.eq.true,fraud_flag.eq.true,blacklisted.eq.true,dup_bvn_flag.eq.true')
        .order('kyc_checked_at', { ascending:false })
      return data || []
    },
  })

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle size={20} className="text-amber-600"/>
        <div>
          <h1 className="text-xl font-bold">KYC & Fraud Flags</h1>
          <p className="text-sm text-gray-500">{flags?.length||0} flagged clients</p>
        </div>
      </div>
      <div className="space-y-3">
        {isLoading && <div className="py-8 text-center text-gray-400">Loading…</div>}
        {flags?.map(c => (
          <div key={c.id} className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="font-bold">{c.first_name} {c.last_name}</div>
                <div className="text-xs text-gray-400">{c.email} — {c.phone}</div>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {c.kyc_flagged    && <Badge color="amber">KYC Flagged</Badge>}
                {c.fraud_flag     && <Badge color="red">Fraud Flag</Badge>}
                {c.blacklisted    && <Badge color="red">Blacklisted</Badge>}
                {c.dup_bvn_flag   && <Badge color="amber">Duplicate BVN</Badge>}
              </div>
            </div>
            {c.kyc_message   && <p className="text-xs text-amber-700 mt-1">KYC: {c.kyc_message}</p>}
            {c.fraud_notes   && <p className="text-xs text-red-700 mt-1">Fraud: {c.fraud_notes}</p>}
            {c.blacklist_note && <p className="text-xs text-red-700 mt-1">Blacklist: {c.blacklist_note}</p>}
            {c.kyc_checked_at && <p className="text-xs text-gray-400 mt-1">Checked: {formatDateTime(c.kyc_checked_at)}</p>}
          </div>
        ))}
        {!isLoading && !flags?.length && (
          <div className="py-12 text-center text-gray-400 bg-white rounded-xl border border-gray-200">
            No flagged clients.
          </div>
        )}
      </div>
    </div>
  )
}
