import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Settings as SettingsIcon, Mail, Key, DollarSign, Shield } from 'lucide-react'

export default function AdminSettings() {
  const qc = useQueryClient()
  const [flash, setFlash] = useState(null)
  const [tab, setTab]     = useState('general')

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await supabase.from('system_settings').select('*')
      const m = {}; data?.forEach(r => { m[r.setting_key] = r.setting_value }); return m
    },
  })

  const save = useMutation({
    mutationFn: async (updates) => {
      const upserts = Object.entries(updates).map(([setting_key, setting_value]) => ({ setting_key, setting_value: String(setting_value) }))
      const { error } = await supabase.from('system_settings').upsert(upserts, { onConflict: 'setting_key' })
      if (error) throw error
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey:['settings'] }); setFlash({ type:'success', msg:'Settings saved.' }) },
    onError: e => setFlash({ type:'danger', msg: e.message }),
  })

  const [form, setForm] = useState({})
  const s = key => form[key] !== undefined ? form[key] : (settings?.[key] || '')
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  const tabs = [
    { id:'general', label:'General', icon: SettingsIcon },
    { id:'loan',    label:'Loan',    icon: DollarSign },
    { id:'email',   label:'Email',   icon: Mail },
    { id:'kyc',     label:'KYC/API', icon: Key },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Configure your FTI Loan platform</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all
                ${tab===t.id ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              <Icon size={15}/> {t.label}
            </button>
          )
        })}
      </div>

      {tab === 'general' && (
        <Card>
          <CardHeader><div className="font-bold">General Settings</div></CardHeader>
          <CardBody>
            <Input label="Site Name" value={s('site_name')} onChange={e => set('site_name', e.target.value)}/>
            <Input label="Site Email" type="email" value={s('site_email')} onChange={e => set('site_email', e.target.value)}/>
            <Input label="Site Phone" value={s('site_phone')} onChange={e => set('site_phone', e.target.value)}/>
            <Input label="Site Address" value={s('site_address')} onChange={e => set('site_address', e.target.value)}/>
            <Button loading={save.isPending} onClick={() => save.mutate({ site_name: s('site_name'), site_email: s('site_email'), site_phone: s('site_phone'), site_address: s('site_address') })}>
              Save General Settings
            </Button>
          </CardBody>
        </Card>
      )}

      {tab === 'loan' && (
        <Card>
          <CardHeader><div className="font-bold">Loan Settings</div></CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-x-4">
              <Input label="Interest Rate (% per month)" type="number" value={s('interest_rate')} onChange={e => set('interest_rate', e.target.value)}/>
              <Input label="Admin Charge (%)" type="number" value={s('admin_charge_pct')} onChange={e => set('admin_charge_pct', e.target.value)}/>
              <Input label="Min Loan Amount (₦)" type="number" value={s('min_loan')} onChange={e => set('min_loan', e.target.value)}/>
              <Input label="Max Loan Amount (₦)" type="number" value={s('max_loan')} onChange={e => set('max_loan', e.target.value)}/>
              <Input label="Asset Interest Rate (%)" type="number" value={s('asset_interest_pct')} onChange={e => set('asset_interest_pct', e.target.value)}/>
              <Input label="Restructure Fee (%)" type="number" value={s('restructure_fee_pct')} onChange={e => set('restructure_fee_pct', e.target.value)}/>
            </div>
            <Button loading={save.isPending} onClick={() => save.mutate({
              interest_rate: s('interest_rate'), admin_charge_pct: s('admin_charge_pct'),
              min_loan: s('min_loan'), max_loan: s('max_loan'),
              asset_interest_pct: s('asset_interest_pct'), restructure_fee_pct: s('restructure_fee_pct'),
            })}>Save Loan Settings</Button>
          </CardBody>
        </Card>
      )}

      {tab === 'email' && (
        <Card>
          <CardHeader><div className="font-bold">Gmail SMTP Settings</div></CardHeader>
          <CardBody>
            <Alert type="info" className="mb-4 text-xs">
              Gmail App Password required. Go to myaccount.google.com → Security → 2-Step Verification → App passwords.
            </Alert>
            <Input label="Gmail Address" type="email" value={s('gmail_address')} onChange={e => set('gmail_address', e.target.value)} placeholder="yourname@gmail.com"/>
            <Input label="App Password" value={s('gmail_app_password')} onChange={e => set('gmail_app_password', e.target.value)} placeholder="xxxx xxxx xxxx xxxx" style={{ fontFamily:'monospace', letterSpacing:'.08em' }}/>
            <Button loading={save.isPending} onClick={() => save.mutate({ gmail_address: s('gmail_address'), gmail_app_password: s('gmail_app_password') })}>
              Save Email Settings
            </Button>
          </CardBody>
        </Card>
      )}

      {tab === 'kyc' && (
        <Card>
          <CardHeader><div className="font-bold">Prembly API Keys</div></CardHeader>
          <CardBody>
            <Input label="API Key (Secret)" value={s('prembly_api_key')} onChange={e => set('prembly_api_key', e.target.value)} style={{ fontFamily:'monospace' }}/>
            <Input label="App ID (Public)" value={s('prembly_app_id')} onChange={e => set('prembly_app_id', e.target.value)} style={{ fontFamily:'monospace' }}/>
            <div className="text-xs text-gray-400 mb-4">
              {s('prembly_api_key')?.startsWith('live_sk') ? '✅ Live mode' : '⚠ Sandbox mode'}
            </div>
            <Button loading={save.isPending} onClick={() => save.mutate({ prembly_api_key: s('prembly_api_key'), prembly_app_id: s('prembly_app_id') })}>
              Save API Settings
            </Button>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
