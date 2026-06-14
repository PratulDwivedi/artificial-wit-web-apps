const BASE           = process.env.NEXT_PUBLIC_AW_API_BASE_URL!
const ACCESS_COOKIE  = 'aw_token'
const REFRESH_COOKIE = 'aw_refresh'

// ── RPC deduplication cache ───────────────────────────────────────────────────
// Collapses concurrent identical calls into one request and caches SUCCESSFUL
// results for RPC_TTL_MS. Errors are never cached so the next call always retries.
const RPC_TTL_MS = 3_000

type RpcCached = {
  pending?: Promise<RpcAny>
  result?:  RpcAny
  at?:      number
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RpcAny = { data: any; error: string | null }

const rpcCache = new Map<string, RpcCached>()

function rpcKey(fn: string, params: Record<string, unknown>): string {
  return `${fn}\x00${JSON.stringify(params)}`
}

// Deduplicates concurrent token-refresh calls so only one refresh runs at a time.
let refreshPromise: Promise<boolean> | null = null

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function setCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
}

export class HttpHelper {
  static getToken(): string | null {
    return getCookie(ACCESS_COOKIE)
  }

  static setToken(token: string): void {
    setCookie(ACCESS_COOKIE, token)
  }

  static clearToken(): void {
    clearCookie(ACCESS_COOKIE)
  }

  static logout(): void {
    clearCookie(ACCESS_COOKIE)
    clearCookie(REFRESH_COOKIE)
    if (typeof window !== 'undefined') window.location.href = '/login'
  }

  // Attempts a silent token refresh. Returns true if a new access token was obtained.
  // Concurrent calls share the same in-flight refresh so only one request is made.
  static tryRefresh(): Promise<boolean> {
    if (refreshPromise) return refreshPromise
    const refreshToken = getCookie(REFRESH_COOKIE)
    if (!refreshToken) return Promise.resolve(false)
    refreshPromise = fetch(`${BASE}/auth/refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
      .then(async res => {
        if (!res.ok) return false
        const json = await res.json()
        if (json.access_token)  setCookie(ACCESS_COOKIE,  json.access_token)
        if (json.refresh_token) setCookie(REFRESH_COOKIE, json.refresh_token)
        return !!json.access_token
      })
      .catch(() => false)
      .finally(() => { refreshPromise = null })
    return refreshPromise
  }

  static async login(
    email: string,
    password: string
  ): Promise<{ data: { access_token: string } | null; error: string | null }> {
    let res: Response
    try {
      res = await fetch(`${BASE}/auth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
    } catch (err) {
      return { data: null, error: (err as Error).message }
    }

    let json: Record<string, unknown>
    try { json = await res.json() } catch { return { data: null, error: `HTTP ${res.status}` } }

    if (!res.ok) {
      return { data: null, error: (json.message ?? json.error ?? `HTTP ${res.status}`) as string }
    }

    const token        = json.access_token  as string | undefined
    const refreshToken = json.refresh_token as string | undefined
    if (token)        setCookie(ACCESS_COOKIE,  token)
    if (refreshToken) setCookie(REFRESH_COOKIE, refreshToken)
    return { data: json as { access_token: string }, error: null }
  }

  // Calls POST /rest/{fn} and returns the raw {is_success, data, message} envelope.
  // Automatically refreshes the access token on 401 and retries once.
  // Identical calls within RPC_TTL_MS are deduplicated: concurrent calls share one
  // in-flight promise; calls after resolution get the cached result immediately.
  static rpc<T = unknown>(
    fn: string,
    params: Record<string, unknown> = {}
  ): Promise<{ data: { is_success: boolean; data: T; message: string } | null; error: string | null }> {
    const key   = rpcKey(fn, params)
    const entry = rpcCache.get(key)

    // Return in-flight promise (deduplicates concurrent calls)
    if (entry?.pending) return entry.pending

    // Return cached result if still within TTL
    if (entry?.result !== undefined && entry.at !== undefined && Date.now() - entry.at < RPC_TTL_MS) {
      return Promise.resolve(entry.result)
    }

    const doRequest = () => {
      const token = HttpHelper.getToken()
      return fetch(`${BASE}/rest/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(Object.fromEntries(Object.entries(params).filter(([, v]) => v !== null && v !== undefined))),
      })
    }

    const pending: Promise<RpcAny> = (async () => {
      let res: Response
      try {
        res = await doRequest()
      } catch (err) {
        return { data: null, error: (err as Error).message }
      }

      if (res.status === 401) {
        const refreshed = await HttpHelper.tryRefresh()
        if (!refreshed) {
          HttpHelper.logout()
          return { data: null, error: 'Session expired. Please log in again.' }
        }
        try {
          res = await doRequest()
        } catch (err) {
          return { data: null, error: (err as Error).message }
        }
      }

      let json: { is_success: boolean; data: T; message: string }
      try { json = await res.json() } catch { return { data: null, error: `HTTP ${res.status}` } }

      if (!res.ok) {
        return { data: null, error: (json as { message?: string })?.message ?? `HTTP ${res.status}` }
      }

      return { data: json, error: null }
    })().then(result => {
      // Only cache HTTP-level successes — auth failures and network errors must not be
      // cached so the next call retries rather than returning a stale failure.
      if (result.error === null) {
        rpcCache.set(key, { result, at: Date.now() })
      } else {
        rpcCache.delete(key)
      }
      return result
    }).catch(err => {
      rpcCache.delete(key)
      throw err
    })

    rpcCache.set(key, { pending })
    return pending
  }

  // Explicitly evict a cached RPC result (call after any mutation for that resource)
  static rpcInvalidate(fn: string, params: Record<string, unknown> = {}): void {
    rpcCache.delete(rpcKey(fn, params))
  }

  static async post<T = unknown>(
    path: string,
    body: Record<string, unknown>
  ): Promise<{ data: T | null; error: string | null }> {
    const token = HttpHelper.getToken()
    let res: Response
    try {
      res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      })
    } catch (err) {
      return { data: null, error: (err as Error).message }
    }
    let json: Record<string, unknown> = {}
    try { json = await res.json() } catch { /* ignore */ }
    if (!res.ok) {
      return { data: null, error: (json.message ?? json.error ?? `HTTP ${res.status}`) as string }
    }
    return { data: json as T, error: null }
  }

  static async forgotPassword(email: string): Promise<{ error: string | null }> {
    const redirectTo = `${process.env.NEXT_PUBLIC_AW_APP_BASE_URL}/reset-password`
    let res: Response
    try {
      res = await fetch(`${BASE}/auth/forgot_password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirect_to: redirectTo }),
      })
    } catch (err) {
      return { error: (err as Error).message }
    }
    if (!res.ok) {
      let json: Record<string, unknown> = {}
      try { json = await res.json() } catch { /* ignore */ }
      return { error: (json.message ?? json.error ?? `HTTP ${res.status}`) as string }
    }
    return { error: null }
  }

  static async resetPassword(accessToken: string, password: string): Promise<{ error: string | null }> {
    let res: Response
    try {
      res = await fetch(`${BASE}/auth/reset_password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ password }),
      })
    } catch (err) {
      return { error: (err as Error).message }
    }
    if (!res.ok) {
      let json: Record<string, unknown> = {}
      try { json = await res.json() } catch { /* ignore */ }
      return { error: (json.message ?? json.error ?? `HTTP ${res.status}`) as string }
    }
    return { error: null }
  }
}
