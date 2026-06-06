// Server-side helper used by Next.js route handlers.
// Replaces the Supabase-based lib/supabase/api-auth.ts.

export type CredentialsResult =
  | { ok: true;  apiKey: string; mcpUrl: string }
  | { ok: false; status: number; error: string }

interface KeyRow {
  x_api_key: string | null
  has_key:   boolean
}

export async function getMcpCredentials(token: string): Promise<CredentialsResult> {
  const apiBase = (process.env.AW_API_BASE_URL ?? '').replace(/\/$/, '')
  const mcpUrl  = process.env.AW_MCP_BASE_URL

  if (!mcpUrl) {
    return { ok: false, status: 400, error: 'AW_MCP_BASE_URL is not set.' }
  }

  let res: Response
  try {
    res = await fetch(`${apiBase}/rest/fn_get_api_key`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })
  } catch (err) {
    return { ok: false, status: 502, error: (err as Error).message }
  }

  let json: { is_success: boolean; data: KeyRow[]; message: string }
  try { json = await res.json() } catch { return { ok: false, status: 502, error: 'Invalid JSON from api key endpoint' } }

  if (!res.ok || !json.is_success || !Array.isArray(json.data) || json.data.length === 0) {
    return { ok: false, status: 404, error: json?.message ?? 'API key not found' }
  }

  const apiKey = json.data[0].x_api_key
  if (!apiKey) {
    return { ok: false, status: 400, error: 'No API key found for this user.' }
  }

  return { ok: true, apiKey, mcpUrl }
}
