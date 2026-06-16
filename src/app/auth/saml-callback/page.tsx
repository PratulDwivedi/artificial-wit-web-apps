'use client'
import { useEffect } from 'react'
import { HttpHelper } from '@/lib/http'
import { getProductConfig } from '@/lib/productConfig'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'

const product = getProductConfig()
const BASE = process.env.NEXT_PUBLIC_AW_API_BASE_URL!

function setRefreshCookie(value: string) {
  document.cookie = `aw_refresh=${encodeURIComponent(value)}; path=/; SameSite=Lax`
}

function redirectToLoginError(error: string, message?: string) {
  const params = new URLSearchParams({ error })
  if (message) params.set('message', message)
  window.location.href = `/login?${params}`
}

export default function SamlCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash  = params.get('token_hash')
    const type        = params.get('type')
    const tenant_code = params.get('tenant_code')
    const return_url  = params.get('return_url') || '/dashboard'

    if (!token_hash || type !== 'magiclink') {
      redirectToLoginError('invalid_callback')
      return
    }

    ;(async () => {
      let res: Response
      try {
        res = await fetch(`${BASE}/auth/saml/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token_hash, type }),
        })
      } catch (err) {
        redirectToLoginError('session_error', (err as Error).message)
        return
      }

      let json: Record<string, unknown> = {}
      try { json = await res.json() } catch { /* ignore */ }

      if (!res.ok) {
        const msg = (json.message ?? json.error ?? `HTTP ${res.status}`) as string
        redirectToLoginError('session_error', msg)
        return
      }

      const access_token  = json.access_token  as string | undefined
      const refresh_token = json.refresh_token as string | undefined

      if (!access_token) {
        redirectToLoginError('session_error', 'No session returned')
        return
      }

      HttpHelper.setToken(access_token)
      if (refresh_token) setRefreshCookie(refresh_token)
      if (tenant_code)   localStorage.setItem('tenant_code', tenant_code)

      window.location.href = return_url
    })()
  }, [])

  return (
    <div className="h-full flex items-center justify-center px-6 py-16" style={{ background: 'var(--c-base)' }}>
      <div className="w-full max-w-[420px]">

        {/* Brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm shrink-0">
            <Image src={product.logo} alt={product.appName} width={40} height={40} className="w-full h-full object-cover" priority />
          </div>
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>{product.appName}</p>
            <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>{product.appTagline}</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-2xl shadow-lg p-8 md:p-10 border flex flex-col items-center text-center"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
            style={{ background: 'var(--c-primary-light)' }}>
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--c-primary)' }} />
          </div>

          <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--c-t1)' }}>
            Signing you in…
          </h2>
          <p className="text-[14px] leading-relaxed" style={{ color: 'var(--c-t4)' }}>
            Verifying your SSO session. You'll be redirected shortly.
          </p>

        </div>
      </div>
    </div>
  )
}
