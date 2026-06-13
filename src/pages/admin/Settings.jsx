import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Alert'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Settings as SettingsIcon, Mail, Key, DollarSign, PenTool, Upload, RefreshCw, Eye } from 'lucide-react'
import { generateLoanAgreement, downloadAgreement } from '@/lib/generateAgreement'

export default function AdminSettings() {
  const qc = useQueryClient()
  const [flash, setFlash] = useState(null)
  const [tab, setTab]     = useState('general')
  const [stampFile, setStampFile] = useState(null)
  const [sigFile,   setSigFile]   = useState(null)
  const [stampPreview, setStampPreview] = useState(null)
  const [sigPreview,   setSigPreview]   = useState(null)
  const [generating, setGenerating] = useState(false)
  const stampRef = useRef()
  const sigRef   = useRef()

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
  const s   = key => form[key] !== undefined ? form[key] : (settings?.[key] || '')
  const set = (k,v) => setForm(f => ({ ...f, [k]: v }))

  // Convert file to base64
  const fileToBase64 = (file) => new Promise((res, rej) => {
    const r = new FileReader()
    r.onload  = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })

  const handleStampUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setStampFile(file)
    const b64 = await fileToBase64(file)
    setStampPreview(b64)
    // Save to Supabase storage + settings
    const path = `signatures/stamp-${Date.now()}.${file.name.split('.').pop()}`
    await supabase.storage.from('ftiloan-docs').upload(path, file, { contentType: file.type, upsert: true })
    await save.mutateAsync({ stamp_image_path: path, stamp_image_data: b64 })
    setFlash({ type:'success', msg:'Stamp uploaded and saved.' })
  }

  const handleSigUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSigFile(file)
    const b64 = await fileToBase64(file)
    setSigPreview(b64)
    const path = `signatures/sig-${Date.now()}.${file.name.split('.').pop()}`
    await supabase.storage.from('ftiloan-docs').upload(path, file, { contentType: file.type, upsert: true })
    await save.mutateAsync({ sig_image_path: path, sig_image_data: b64 })
    setFlash({ type:'success', msg:'Signature uploaded and saved.' })
  }

  // Generate digital stamp/sig from director name using canvas
  const generateDigital = async () => {
    const directorName = s('director_name') || 'The Director'
    const companyName  = s('site_name') || 'FTI Loan Services'
    setGenerating(true)

    try {
      // Generate stamp on canvas
      const stampCanvas = document.createElement('canvas')
      stampCanvas.width = 200; stampCanvas.height = 200
      const sc = stampCanvas.getContext('2d')
      sc.clearRect(0,0,200,200)
      // outer circle
      sc.strokeStyle = '#00641e'; sc.lineWidth = 6
      sc.beginPath(); sc.arc(100,100,90,0,Math.PI*2); sc.stroke()
      sc.lineWidth = 2
      sc.beginPath(); sc.arc(100,100,80,0,Math.PI*2); sc.stroke()
      // company name arc top
      sc.font = 'bold 14px Arial'
      sc.fillStyle = '#00641e'
      sc.textAlign = 'center'
      const short = companyName.length > 22 ? companyName.slice(0,22) : companyName
      sc.fillText(short.toUpperCase(), 100, 40)
      // center star
      sc.font = 'bold 36px Arial'
      sc.fillText('★', 100, 115)
      // director name bottom
      sc.font = 'bold 11px Arial'
      sc.fillText(directorName.toUpperCase(), 100, 170)
      // date
      sc.font = '10px Arial'
      sc.fillStyle = '#005010'
      sc.fillText(new Date().getFullYear().toString(), 100, 148)
      const stampDataUrl = stampCanvas.toDataURL('image/png')
      setStampPreview(stampDataUrl)

      // Generate signature on canvas
      const sigCanvas = document.createElement('canvas')
      sigCanvas.width = 300; sigCanvas.height = 80
      const sigCtx = sigCanvas.getContext('2d')
      sigCtx.clearRect(0,0,300,80)
      sigCtx.font = 'bold italic 36px Georgia, serif'
      sigCtx.fillStyle = '#00288c'
      // Draw initials in stylised form
      const parts = directorName.trim().split(' ')
      const sigText = parts.map(p => p[0]).join('. ') + '.'
      sigCtx.fillText(sigText, 10, 48)
      // Underline
      sigCtx.strokeStyle = '#00288c'; sigCtx.lineWidth = 2
      sigCtx.beginPath(); sigCtx.moveTo(10, 56); sigCtx.lineTo(240, 56); sigCtx.stroke()
      // Full name below
      sigCtx.font = '14px Arial'
      sigCtx.fillStyle = '#444'
      sigCtx.fillText(directorName, 10, 74)
      const sigDataUrl = sigCanvas.toDataURL('image/png')
      setSigPreview(sigDataUrl)

      await save.mutateAsync({
        stamp_image_data: stampDataUrl,
        sig_image_data:   sigDataUrl,
        director_name:    directorName,
      })
      setFlash({ type:'success', msg:'Digital stamp & signature generated from director name.' })
    } catch(e) {
      setFlash({ type:'danger', msg: e.message })
    }
    setGenerating(false)
  }

  // Preview agreement
  const previewAgreement = async () => {
    const mockLoan = {
      loan_ref: 'FTI-PREVIEW-001', loan_type: 'cash', amount: 200000,
      disbursed_amount: 196000, admin_charge: 4000, interest_rate: 7,
      total_repayment: 214000, outstanding: 214000, duration_value: 6,
      duration_type: 'monthly', purpose: 'Business capital',
      bank_name: 'Access Bank', bank_account_number: '0123456789', bank_account_name: 'John Doe',
      created_at: new Date().toISOString(), repayment_schedule: [],
    }
    const mockClient = {
      first_name: 'John', last_name: 'Doe', phone: '08012345678',
      residential_address: 'No. 5, Wuse Zone 3, Abuja',
      bvn_number: '22345678901', nin_number: '12345678901',
    }
    const currentSettings = {
      ...settings,
      director_name: s('director_name') || settings?.director_name,
      site_name: s('site_name') || settings?.site_name,
    }
    const doc = await generateLoanAgreement({
      loan: mockLoan, client: mockClient, settings: currentSettings,
      guarantor: null,
      stampDataUrl: stampPreview || settings?.stamp_image_data,
      sigDataUrl:   sigPreview   || settings?.sig_image_data,
    })
    downloadAgreement(doc, 'PREVIEW')
  }

  const tabs = [
    { id:'general',   label:'General',   icon: SettingsIcon },
    { id:'loan',      label:'Loan',      icon: DollarSign },
    { id:'email',     label:'Email',     icon: Mail },
    { id:'kyc',       label:'KYC/API',   icon: Key },
    { id:'signature', label:'Signature', icon: PenTool },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Configure your FTI Loan platform</p>
      </div>

      {flash && <Alert type={flash.type} className="mb-4">{flash.msg}</Alert>}

      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {tabs.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-all whitespace-nowrap
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

      {tab === 'signature' && (
        <div className="space-y-4">
          {/* Director info */}
          <Card>
            <CardHeader><div className="font-bold">Director / Authorised Signatory</div></CardHeader>
            <CardBody>
              <Input
                label="Director Full Name"
                value={s('director_name')}
                onChange={e => set('director_name', e.target.value)}
                placeholder="e.g. Abdullahi Mohammed"
              />
              <Input
                label="Director Title / Position"
                value={s('director_title')}
                onChange={e => set('director_title', e.target.value)}
                placeholder="e.g. Managing Director"
              />
              <div className="flex gap-2">
                <Button loading={save.isPending} onClick={() => save.mutate({ director_name: s('director_name'), director_title: s('director_title') })}>
                  Save
                </Button>
                <Button variant="outline" loading={generating} onClick={generateDigital} className="gap-2">
                  <RefreshCw size={14}/> Generate Digital Stamp & Signature
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                "Generate Digital" creates a stamp and signature automatically from the director name above. Or upload your own below.
              </p>
            </CardBody>
          </Card>

          {/* Upload stamp */}
          <Card>
            <CardHeader><div className="font-bold">Company Stamp</div></CardHeader>
            <CardBody>
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-3">Upload a PNG/JPG of your company stamp. Use a transparent background for best results.</p>
                  <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-400 transition-colors text-sm text-gray-500">
                    <Upload size={16}/>
                    <span>Upload stamp image (PNG recommended)</span>
                    <input ref={stampRef} type="file" className="hidden" accept="image/*" onChange={handleStampUpload}/>
                  </label>
                </div>
                <div className="w-28 h-28 border border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 flex-shrink-0 overflow-hidden">
                  {(stampPreview || settings?.stamp_image_data) ? (
                    <img src={stampPreview || settings?.stamp_image_data} alt="Stamp preview" className="w-full h-full object-contain p-1"/>
                  ) : (
                    <div className="text-xs text-gray-400 text-center p-2">No stamp yet</div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Upload signature */}
          <Card>
            <CardHeader><div className="font-bold">Director Signature</div></CardHeader>
            <CardBody>
              <div className="flex items-start gap-6">
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-3">Upload a PNG/JPG of the director's signature. Transparent or white background works best.</p>
                  <label className="flex items-center gap-2 p-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-brand-400 transition-colors text-sm text-gray-500">
                    <Upload size={16}/>
                    <span>Upload signature image (PNG recommended)</span>
                    <input ref={sigRef} type="file" className="hidden" accept="image/*" onChange={handleSigUpload}/>
                  </label>
                </div>
                <div className="w-40 h-20 border border-gray-200 rounded-xl flex items-center justify-center bg-gray-50 flex-shrink-0 overflow-hidden">
                  {(sigPreview || settings?.sig_image_data) ? (
                    <img src={sigPreview || settings?.sig_image_data} alt="Signature preview" className="w-full h-full object-contain p-2"/>
                  ) : (
                    <div className="text-xs text-gray-400 text-center p-2">No signature yet</div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>

          {/* Preview agreement */}
          <Card>
            <CardHeader><div className="font-bold">Preview Agreement PDF</div></CardHeader>
            <CardBody>
              <p className="text-sm text-gray-500 mb-3">Download a sample agreement PDF to see how it will look with your stamp and signature.</p>
              <Button onClick={previewAgreement} className="gap-2" variant="outline">
                <Eye size={15}/> Download Sample Agreement
              </Button>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
