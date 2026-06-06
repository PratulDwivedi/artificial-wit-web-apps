import { NextRequest, NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'

function base64url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

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

  const connectorId = request.nextUrl.searchParams.get('connector_id')
  if (!connectorId) return NextResponse.json({ error: 'Missing connector_id' }, { status: 400 })

  // Get connector URL
  const listResult = await rpc(token, 'fn_get_connectors', {})
  const connectors: { id: number; url: string | null }[] = listResult?.data ?? []
  const connector = connectors.find(c => c.id === parseInt(connectorId))
  if (!connector?.url) {
    return NextResponse.json({ error: 'Connector not found or has no URL' }, { status: 404 })
  }

  const mcpBase = connector.url.replace(/\/$/, '')
  const appBase = (process.env.AW_APP_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const redirectUri = `${appBase}/auth/callback`

  // RFC 8414 — OAuth Authorization Server Metadata discovery
  // Try path-level first, then fall back to origin root (MCP spec §2.3.2)
  type OAuthMeta = {
    issuer?: string
    authorization_endpoint: string
    token_endpoint: string
    registration_endpoint?: string
  }
  let meta: OAuthMeta | null = null

  const origin = new URL(mcpBase).origin
  const candidates = [
    `${mcpBase}/.well-known/oauth-authorization-server`,
    `${origin}/.well-known/oauth-authorization-server`,
  ]

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      if (res.ok) { meta = await res.json(); break }
    } catch { /* try next */ }
  }

  if (!meta) {
    return NextResponse.json(
      { error: `OAuth discovery failed: no metadata found at ${candidates.join(' or ')}` },
      { status: 502 }
    )
  }

  // Dynamic Client Registration (RFC 7591)
  let clientId = new URL(appBase).hostname
  let clientSecret = ''
  if (meta.registration_endpoint) {
    try {
      const regRes = await fetch(meta.registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name:                 'Artificial Wit',
          redirect_uris:               [redirectUri],
          grant_types:                 ['authorization_code'],
          response_types:              ['code'],
          token_endpoint_auth_method:  'none',
        }),
        signal: AbortSignal.timeout(8000),
      })
      if (!regRes.ok) throw new Error(`HTTP ${regRes.status}`)
      const reg = await regRes.json()
      clientId     = reg.client_id
      clientSecret = reg.client_secret ?? ''
    } catch (err) {
      return NextResponse.json({ error: `Client registration failed: ${(err as Error).message}` }, { status: 502 })
    }
  }

  // PKCE (RFC 7636)
  const codeVerifier  = base64url(randomBytes(32))
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
  const state         = base64url(randomBytes(16))

  // Persist OAuth state
  await rpc(token, 'fn_save_connector_oauth_state', {
    p_connector_id:           parseInt(connectorId),
    p_authorization_server:   meta.issuer ?? mcpBase,
    p_authorization_endpoint: meta.authorization_endpoint,
    p_token_endpoint:         meta.token_endpoint,
    p_registration_endpoint:  meta.registration_endpoint ?? '',
    p_client_id:              clientId,
    p_client_secret:          clientSecret,
    p_redirect_uri:           redirectUri,
    p_code_verifier:          codeVerifier,
    p_state:                  state,
  })

  // Redirect user to authorization endpoint
  const authUrl = new URL(meta.authorization_endpoint)
  authUrl.searchParams.set('response_type',          'code')
  authUrl.searchParams.set('client_id',              clientId)
  authUrl.searchParams.set('redirect_uri',           redirectUri)
  authUrl.searchParams.set('state',                  state)
  authUrl.searchParams.set('code_challenge',         codeChallenge)
  authUrl.searchParams.set('code_challenge_method',  'S256')

  return NextResponse.redirect(authUrl.toString())
}
