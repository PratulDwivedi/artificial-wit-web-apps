import { NextRequest, NextResponse } from 'next/server'

async function rpc(token: string, fn: string, params: Record<string, unknown>) {
  const base = (process.env.AW_API_BASE_URL ?? '').replace(/\/$/, '')
  const res = await fetch(`${base}/rest/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  return res.json()
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value
  if (!token) return NextResponse.redirect(new URL('/login', request.url))

  const { searchParams } = request.nextUrl
  const code  = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError || !code || !state) {
    const msg = oauthError ?? 'OAuth cancelled'
    return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(msg)}`, request.url))
  }

  // Retrieve persisted OAuth state
  const stateResult = await rpc(token, 'fn_get_connector_oauth_by_state', { p_state: state })
  const row = stateResult?.data?.[0]
  if (!row) {
    return NextResponse.redirect(new URL('/connectors?error=invalid_state', request.url))
  }

  const {
    connector_id, token_endpoint, client_id, client_secret,
    redirect_uri, code_verifier, authorization_server,
  } = row

  // Exchange authorization code for access token
  let tokenData: {
    access_token: string
    refresh_token?: string
    token_type?: string
    scope?: string
    expires_in?: number
  }
  try {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri,
      client_id,
      code_verifier,
    })
    if (client_secret) body.set('client_secret', client_secret)

    const tokenRes = await fetch(token_endpoint, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
      signal:  AbortSignal.timeout(10000),
    })
    if (!tokenRes.ok) {
      const detail = await tokenRes.text()
      throw new Error(`${tokenRes.status}: ${detail}`)
    }
    tokenData = await tokenRes.json()
  } catch (err) {
    const msg = `Token exchange failed: ${(err as Error).message}`
    return NextResponse.redirect(new URL(`/connectors?error=${encodeURIComponent(msg)}`, request.url))
  }

  // Persist access token — also marks connector status = 'connected'
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : new Date(Date.now() + 3600 * 1000).toISOString()

  await rpc(token, 'fn_save_connector_oauth_token', {
    p_connector_id: connector_id,
    p_access_token:  tokenData.access_token,
    p_refresh_token: tokenData.refresh_token ?? null,
    p_token_type:    tokenData.token_type ?? 'Bearer',
    p_scope:         tokenData.scope ?? null,
    p_expires_at:    expiresAt,
  })

  // Discover and save MCP tools (non-critical — best effort)
  try {
    const mcpBase = (authorization_server as string).replace(/\/$/, '')
    const toolsRes = await fetch(mcpBase, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body:   JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1, params: {} }),
      signal: AbortSignal.timeout(8000),
    })
    if (toolsRes.ok) {
      const toolsJson = await toolsRes.json()
      const tools: unknown[] = toolsJson?.result?.tools ?? toolsJson?.tools ?? []
      if (tools.length > 0) {
        await rpc(token, 'fn_save_connector_tools', {
          p_connector_id: connector_id,
          p_tools:        tools,
        })
      }
    }
  } catch { /* tools discovery is non-critical */ }

  return NextResponse.redirect(new URL('/connectors', request.url))
}
