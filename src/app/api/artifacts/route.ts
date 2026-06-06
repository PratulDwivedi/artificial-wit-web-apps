import { NextRequest, NextResponse } from 'next/server'
import { getMcpCredentials } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const creds = await getMcpCredentials(token)
  if (!creds.ok) return NextResponse.json({ success: false, error: creds.error }, { status: creds.status })

  const { apiKey, mcpUrl } = creds
  const mcpBase     = mcpUrl.trim().replace(/\/$/, '')
  const manifestUrl = `${mcpBase}/artifacts`

  let res: Response
  try {
    res = await fetch(manifestUrl, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      signal:  AbortSignal.timeout(10_000),
      cache:   'no-store',
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: `Cannot reach MCP server: ${(err as Error).message}` }, { status: 502 })
  }

  if (!res.ok) {
    let detail = ''
    try { detail = await res.text() } catch { /* ignore */ }
    return NextResponse.json({ success: false, error: `MCP server returned HTTP ${res.status}`, detail }, { status: 502 })
  }

  try {
    const body = await res.json()
    const rows = Array.isArray(body.data) ? body.data : []

    const artifacts = rows
      .filter((a: Record<string, unknown>) => a.is_active !== false)
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        ((a.sort_order as number) ?? 0) - ((b.sort_order as number) ?? 0)
      )
      .map((a: Record<string, unknown>) => ({
        id:      a.name  || String(a.id),
        title:   a.title || a.name,
        icon:    a.icon  || '📄',
        section: a.section || 'Dashboards',
        url: typeof a.url === 'string' && a.url.startsWith('http')
          ? a.url
          : `${mcpBase}/artifacts/${a.url}`,
      }))

    return NextResponse.json({ success: true, artifacts, baseUrl: mcpBase })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'MCP server returned invalid JSON' }, { status: 502 })
  }
}
