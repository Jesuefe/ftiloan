import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { method, number, first_name, last_name } = await req.json()

    // Get API key from Supabase settings table
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: keyRow } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'prembly_api_key')
      .single()

    const apiKey = keyRow?.setting_value || Deno.env.get('PREMBLY_API_KEY') || ''
    if (!apiKey) throw new Error('Prembly API key not configured')

    // Choose endpoint
    const endpoints: Record<string, string> = {
      bvn:   'https://api.prembly.com/identitypass/verification/bvn',
      nin:   'https://api.prembly.com/identitypass/verification/nin',
      phone: 'https://api.prembly.com/identitypass/verification/phone_number',
    }

    const url = endpoints[method]
    if (!url) throw new Error('Invalid verification method')

    const body: Record<string, string> = { number }
    if (method !== 'phone' && first_name) body.firstName = first_name
    if (method !== 'phone' && last_name)  body.lastName  = last_name

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    // Normalise Prembly response
    const success =
      data?.status === true ||
      data?.response_code === '00' ||
      data?.verification?.status === 'VERIFIED' ||
      data?.data?.status === 'VERIFIED'

    return new Response(JSON.stringify({
      success,
      message: success ? 'Identity verified successfully' : (data?.detail || data?.message || 'Verification failed'),
      data: data?.data || data?.detail || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })

  } catch (e) {
    return new Response(JSON.stringify({ success: false, message: e.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // always 200 so client gets the error message
    })
  }
})
