import { NextRequest, NextResponse } from 'next/server'
import { getMcpCredentials } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return NextResponse.json({ is_success: false, error: 'Unauthorized' }, { status: 401 })

  const creds = await getMcpCredentials(token)
  if (!creds.ok) return NextResponse.json({ is_success: false, error: creds.error }, { status: creds.status })

  const { apiKey, mcpUrl } = creds
  const { tool: rawTool, args } = await request.json()

  if (!rawTool) return NextResponse.json({ is_success: false, error: 'Missing tool name.' }, { status: 400 })

  // Strip mcp__<uuid>__ prefix — artifact HTML uses namespaced names, MCP server expects bare names
  const tool = rawTool.replace(/^mcp__[^_]+__/, '')

  try {
    const res = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id:      1,
        method:  'tools/call',
        params:  { name: tool, arguments: args ?? {} },
      }),
      signal: AbortSignal.timeout(30_000),
    })

    const body = await res.json()

    if (Array.isArray(body?.result?.content)) {
      for (const block of body.result.content) {
        if (block.type === 'text' && block.text) {
          try { return NextResponse.json(JSON.parse(block.text)) }
          catch { return NextResponse.json(block.text) }
        }
      }
    }

    return NextResponse.json(body)
  } catch (err) {
    return NextResponse.json({ is_success: false, error: (err as Error).message }, { status: 502 })
  }
}
