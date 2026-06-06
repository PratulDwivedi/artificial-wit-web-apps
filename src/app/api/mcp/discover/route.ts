import { NextRequest, NextResponse } from 'next/server'
import { getMcpCredentials } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const creds = await getMcpCredentials(token)
  if (!creds.ok) return NextResponse.json({ success: false, error: creds.error }, { status: creds.status })

  const { apiKey, mcpUrl } = creds

  try {
    const res = await fetch(mcpUrl, {
      method:  'HEAD',
      headers: { 'x-api-key': apiKey },
      signal:  AbortSignal.timeout(8000),
    })

    if (res.ok || res.status === 405 || res.status === 429) {
      return NextResponse.json({ success: true, status: res.status }, { headers: { 'Cache-Control': 'private, max-age=30' } })
    }

    let body = ''
    try { body = await res.text() } catch { /* ignore */ }
    return NextResponse.json({ success: false, error: `Server returned HTTP ${res.status}`, detail: body }, { status: 502 })
  } catch (err) {
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 502 })
  }
}
