import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

  const apiBase = (process.env.AW_API_BASE_URL ?? '').replace(/\/$/, '')
  if (!apiBase) return NextResponse.json({ success: false, error: 'AW_API_BASE_URL is not configured' }, { status: 500 })

  let incomingForm: FormData
  try {
    incomingForm = await request.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid form data' }, { status: 400 })
  }

  const file = incomingForm.get('file') as File | null
  if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 })

  const upstream = new FormData()
  upstream.append('file', file, file.name)

  const uploadUrl = `${apiBase}/file/upload/files`
  let res: Response
  try {
    res = await fetch(uploadUrl, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
      body:    upstream,
      signal:  AbortSignal.timeout(30_000),
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: `Upload request failed: ${(err as Error).message}` }, { status: 502 })
  }

  const raw = await res.text()
  if (!res.ok) {
    return NextResponse.json({ success: false, error: `Upstream ${res.status}`, detail: raw }, { status: 502 })
  }

  let json: Record<string, unknown>
  try { json = JSON.parse(raw) } catch {
    return NextResponse.json({ success: false, error: 'Upload API returned non-JSON response', detail: raw }, { status: 502 })
  }

  if (!json.is_success) {
    return NextResponse.json({ success: false, error: json.message ?? 'Upload failed', detail: raw }, { status: 502 })
  }

  const fileRecord = (json.data as Record<string, unknown>[])?.[0]
  const storedFilename = fileRecord?.stored_filename as string | undefined
  if (!storedFilename) {
    return NextResponse.json({ success: false, error: 'Upload response missing stored_filename', detail: raw }, { status: 502 })
  }

  return NextResponse.json({
    success:           true,
    url:               storedFilename,
    stored_filename:   storedFilename,
    original_filename: fileRecord.original_filename,
    file_size_bytes:   fileRecord.file_size_bytes,
  })
}
