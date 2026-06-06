import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const apiBase = (process.env.AW_API_BASE_URL ?? '').replace(/\/$/, '')
  if (!apiBase) return NextResponse.json({ success: false, error: 'AW_API_BASE_URL is not configured' }, { status: 500 })

  const body = await request.text()

  let res: Response
  try {
    res = await fetch(`${apiBase}/embed`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: `Embed request failed: ${(err as Error).message}` }, { status: 502 })
  }

  const json = await res.json()
  return NextResponse.json(json, { status: res.status })
}
