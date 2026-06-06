import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return new NextResponse('Unauthorized', { status: 401 })

  const filename = request.nextUrl.searchParams.get('filename')
  if (!filename) return new NextResponse('Missing filename', { status: 400 })

  const apiBase = (process.env.AW_API_BASE_URL ?? '').replace(/\/$/, '')
  if (!apiBase) return new NextResponse('AW_API_BASE_URL not configured', { status: 500 })

  const url = `${apiBase}/file/download/files?filename=${encodeURIComponent(filename)}`

  let res: Response
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal:  AbortSignal.timeout(15_000),
    })
  } catch (err) {
    return new NextResponse(`Fetch failed: ${(err as Error).message}`, { status: 502 })
  }

  if (!res.ok) return new NextResponse(`Upstream ${res.status}`, { status: 502 })

  const contentType = res.headers.get('content-type') ?? 'application/octet-stream'
  const buffer = await res.arrayBuffer()

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type':  contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
