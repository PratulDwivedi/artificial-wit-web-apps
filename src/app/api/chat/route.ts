import { NextRequest } from 'next/server'

// Edge runtime: native fetch with proper HTTPS + streaming support
export const runtime = 'edge'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization') ?? ''
  const body       = await req.text()

  const apiBase = process.env.NEXT_PUBLIC_AW_API_BASE_URL ?? 'https://api.artificialwit.com'

  let upstream: Response
  try {
    upstream = await fetch(`${apiBase}/chat`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': authHeader,
      },
      body,
    })
  } catch (err) {
    const detail = err instanceof Error
      ? `${err.message}${(err as NodeJS.ErrnoException).cause ? ` | ${(err as NodeJS.ErrnoException).cause}` : ''}`
      : String(err)
    return new Response(
      JSON.stringify({ error: 'Upstream unreachable', detail }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (!upstream.ok) {
    const text = await upstream.text()
    return new Response(
      JSON.stringify({ error: `Upstream error ${upstream.status}`, detail: text }),
      { status: upstream.status, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Pipe the SSE stream straight through
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'Content-Type':      upstream.headers.get('Content-Type') ?? 'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
