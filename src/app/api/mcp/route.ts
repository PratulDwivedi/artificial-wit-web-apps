import { NextRequest } from 'next/server'
import { getMcpCredentials } from '@/lib/api-auth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = req.cookies.get('aw_token')?.value
  const body  = await req.text()

  let apiKey = ''
  if (token) {
    try {
      const creds = await getMcpCredentials(token)
      if (creds.ok) apiKey = creds.apiKey
    } catch (err) {
      console.error('[mcp proxy] getMcpCredentials failed:', err)
    }
  }

  const mcpBase = process.env.NEXT_PUBLIC_AW_MCP_BASE_URL ?? 'https://api.artificialwit.com/mcp'

  let upstream: Response
  try {
    upstream = await fetch(mcpBase, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body,
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'MCP server unreachable', detail: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const responseData = await upstream.json()
  return Response.json(responseData, { status: upstream.status })
}
