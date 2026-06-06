import { NextRequest, NextResponse } from 'next/server'
import { getMcpCredentials } from '@/lib/api-auth'

interface GlobalVar { name: string; value: string }

function resolveVars(str: string, vars: GlobalVar[]): string {
  return vars.reduce((s, v) => s.replaceAll(`{{${v.name}}}`, v.value ?? ''), str)
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const { url: rawUrl, method, headers: extraHeaders, body: rawBody } = await request.json() as {
    url:      string
    method:   string
    headers?: Record<string, string>
    body?:    string
  }

  if (!rawUrl) return NextResponse.json({ success: false, error: 'url is required' }, { status: 400 })

  // Load global variables to resolve {{TOKEN}} placeholders server-side
  const apiBase = (process.env.AW_API_BASE_URL ?? '').replace(/\/$/, '')
  let globalVars: GlobalVar[] = []
  try {
    const res = await fetch(`${apiBase}/rest/fn_get_global_variables`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ p_id: null, p_search: null }),
    })
    const json = await res.json()
    if (json?.is_success) globalVars = json.data ?? []
  } catch { /* degrade: no variable substitution */ }

  const url  = resolveVars(rawUrl,         globalVars)
  const body = rawBody ? resolveVars(rawBody, globalVars) : undefined

  const resolvedHeaders: Record<string, string> = {}
  Object.entries(extraHeaders ?? {}).forEach(([k, v]) => {
    resolvedHeaders[k] = resolveVars(v, globalVars)
  })

  const creds = await getMcpCredentials(token)
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
    ...resolvedHeaders,
  }
  if (creds.ok) reqHeaders['x-api-key'] = creds.apiKey

  const start = Date.now()
  let upstream: Response
  try {
    upstream = await fetch(url, {
      method:  method.toUpperCase(),
      headers: reqHeaders,
      body:    body && method.toUpperCase() !== 'GET' ? body : undefined,
      signal:  AbortSignal.timeout(30_000),
      cache:   'no-store',
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 502 })
  }

  const time = Date.now() - start
  const responseHeaders: Record<string, string> = {}
  upstream.headers.forEach((v, k) => { responseHeaders[k] = v })
  const text = await upstream.text()

  return NextResponse.json({ success: true, data: text, status: upstream.status, time, headers: responseHeaders })
}
