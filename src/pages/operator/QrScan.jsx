import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatNaira } from '@/lib/utils'
import { Search, QrCode } from 'lucide-react'

export default function OperatorQrScan() {
  const { profile } = useAuthStore()
  const qc = useQueryClient()
  const [code, setCode]   = useState('')
  const [result, setResult] = useState(null)
  const [flash, setFlash] = useState(null)

  const lookup = useMutation({
    mutationFn: async (code) => {
      const { data, error } = await supabase.from('form_codes')
        .select(`*, agents(id, users!agents_user_id_fkey(first_name,last_name)),
          loans(id,loan_ref,amount,status,disbursed_amount,bank_name,bank_account_number,bank_account_name,
            users!loans_user_id_fkey(first_name,last_name,phone))`)
        .eq('code', code.trim().toUpperCase())
        .single()
      if (error || !data) throw new Error('Form code not found')
      return data
    },
    onSuccess: (data) => {
      setResult(data)
      setFlash(null)
    },
    onError: e => { setFlash({ type:'danger', msg: e.message }); setResult(null) },
  })

  const disburse = useMutation({
    mutationFn: async (formCode) => {
      if (!formCode.loan_id) throw new Error('No loan linked to this form code')
      const loan = formCode.loans
      if (!['admin_approved'].includes(loan?.status)) throw new Error('Loan is not approved for disbursement')

      // Mark loan disbursed
      await supabase.from('loans').update({
        status: 'disbursed',
        disbursed_at: new Date().toISOString(),
      }).eq('id', formCode.loan_id)

      // Mark form code used
      await supabase.from('form_codes').update({
        status: 'approved', reviewed_by: profile.id, reviewed_at: new Date().toISOString()
      }).eq('id', formCode.id)
    },
    onSuccess: () => {
      setFlash({ type:'success', msg:'Loan marked as disbursed successfully.' })
      setResult(null); setCode('')
      qc.invalidateQueries({ queryKey: ['operator-disburse'] })
    },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <QrCode size={20} className="text-brand-600"/>
        <div>
          <h1 className="text-xl font-bold text-gray-900">QR Code / Form Lookup</h1>
          <p className="text-sm text-gray-500">Look up a form code to verify and disburse</p>
        </div>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <Card className="mb-4">
        <CardBody>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Enter Form Code</label>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && lookup.mutate(code)}
              placeholder="e.g. FTI-FORM-BATCH001-001"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <Button loading={lookup.isPending} onClick={() => lookup.mutate(code)} className="gap-2 flex-shrink-0">
              <Search size={15}/> Look Up
            </Button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Scan QR code or type the form code manually</p>
        </CardBody>
      </Card>

      {result && (
        <Card style={{ border: `2px solid ${result.status === 'unused' ? '#4BB543' : '#94a3b8'}` }}>
          <CardHeader>
            <div className="font-bold font-mono">{result.code}</div>
            <Badge color={result.status==='unused'?'green':result.status==='approved'?'blue':'gray'}>
              {result.status}
            </Badge>
          </CardHeader>
          <CardBody>
            <div className="space-y-3 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-gray-500">Agent</span>
                <span className="font-medium">{result.agents?.users?.first_name} {result.agents?.users?.last_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Batch</span>
                <span className="font-mono">{result.batch_ref}</span>
              </div>
            </div>

            {result.loans && (
              <>
                <div className="border-t border-gray-100 pt-3 mb-3">
                  <div className="font-semibold text-sm mb-2">Linked Loan</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Client</span>
                      <span className="font-medium">{result.loans.users?.first_name} {result.loans.users?.last_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Reference</span>
                      <span className="font-mono text-xs text-brand-600">{result.loans.loan_ref}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Disburse Amount</span>
                      <span className="font-bold text-green-600">{formatNaira(result.loans.disbursed_amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bank</span>
                      <span className="font-medium">{result.loans.bank_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account</span>
                      <span className="font-mono">{result.loans.bank_account_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Name</span>
                      <span className="font-medium">{result.loans.bank_account_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status</span>
                      <Badge color={result.loans.status==='admin_approved'?'green':'gray'}>
                        {result.loans.status?.replace(/_/g,' ')}
                      </Badge>
                    </div>
                  </div>
                </div>

                {result.loans.status === 'admin_approved' && result.status === 'unused' && (
                  <Button
                    className="w-full justify-center"
                    loading={disburse.isPending}
                    onClick={() => disburse.mutate(result)}>
                    Confirm Disbursement
                  </Button>
                )}

                {result.loans.status !== 'admin_approved' && (
                  <Alert type="warning" className="text-xs">
                    This loan is not yet approved for disbursement. Current status: {result.loans.status?.replace(/_/g,' ')}.
                  </Alert>
                )}

                {result.status !== 'unused' && (
                  <Alert type="info" className="text-xs">
                    This form code has already been used.
                  </Alert>
                )}
              </>
            )}

            {!result.loans && (
              <Alert type="warning" className="text-xs">No loan linked to this form code yet.</Alert>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
