'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HttpHelper } from '@/lib/http'
import { resolveStartupRoute } from '@/lib/store'
import { getProductConfig } from '@/lib/productConfig'
import Image from 'next/image'
import { Loader2, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react'

const product = getProductConfig()

function FeatureList({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      {product.features.map(({ icon: Icon, title, description }) => (
        <div key={title} className="flex items-start gap-4">
          <div className={`${compact ? 'w-9 h-9' : 'w-10 h-10'} rounded-xl flex items-center justify-center shrink-0`}
            style={{ background: 'var(--c-primary-light)' }}>
            <Icon size={compact ? 16 : 18} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div>
            <p className={`${compact ? 'text-[13px]' : 'text-[14px]'} font-semibold`} style={{ color: 'var(--c-t1)' }}>{title}</p>
            <p className={`${compact ? 'text-[12px]' : 'text-[13px]'} mt-0.5`} style={{ color: 'var(--c-t4)' }}>{description}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

type View = 'login' | 'forgot' | 'forgot-sent'

export default function LoginPage() {
  const router = useRouter()
  const [view, setView] = useState<View>('login')

  // Login state
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  // Forgot password state
  const [forgotEmail, setForgotEmail]     = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotError, setForgotError]     = useState<string | null>(null)

  const login = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await HttpHelper.login(email, password)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    try {
      const { data } = await HttpHelper.rpc('fn_get_profile')
      const env   = data as unknown as { is_success: boolean; data: Array<{ data?: { route_name_web?: string | Record<string, string> } }> }
      const route = resolveStartupRoute(env?.data?.[0]?.data?.route_name_web)
      router.push(route ? `/${route}` : '/')
    } catch {
      router.push('/')
    }
  }

  const sendResetLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setForgotError(null)
    setForgotLoading(true)
    const { error: err } = await HttpHelper.forgotPassword(forgotEmail)
    setForgotLoading(false)
    if (err) {
      setForgotError(err)
      return
    }
    setView('forgot-sent')
  }

  const goToForgot = () => {
    setForgotEmail(email)
    setForgotError(null)
    setView('forgot')
  }

  const goToLogin = () => {
    setError(null)
    setView('login')
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--c-base)' }}>
      <div className="flex flex-col md:flex-row md:min-h-full">

        {/* ── Left: feature showcase (desktop only) ────────────── */}
        <div className="hidden md:flex flex-col justify-center px-16 py-16 flex-1 max-w-[680px]">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm shrink-0">
              <Image src={product.logo} alt={product.appName} width={48} height={48} className="w-full h-full object-cover" priority />
            </div>
            <div>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>{product.appName}</p>
              <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>{product.appTagline}</p>
            </div>
          </div>

          <h1 className="text-[40px] font-bold leading-tight mb-3" style={{ color: 'var(--c-t1)' }}>
            {product.headline}
          </h1>
          <p className="text-[15px] mb-10 leading-relaxed max-w-md" style={{ color: 'var(--c-t4)' }}>
            {product.subheadline}
          </p>

          <FeatureList />
        </div>

        {/* ── Right: form + mobile extras ──────────────────────── */}
        <div className="flex-1 flex flex-col items-center px-6 pt-10 pb-12 md:justify-center md:px-8 md:py-16">

          {/* Brand — mobile only */}
          <div className="md:hidden w-full max-w-[420px] flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm shrink-0">
              <Image src={product.logo} alt={product.appName} width={40} height={40} className="w-full h-full object-cover" priority />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>{product.appName}</p>
              <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>{product.appTagline}</p>
            </div>
          </div>

          {/* Card */}
          <div className="w-full max-w-[420px] rounded-2xl shadow-lg p-8 md:p-10 border"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

            {/* ── Login view ── */}
            {view === 'login' && (
              <>
                <h2 className="text-[28px] font-bold mb-1" style={{ color: 'var(--c-t1)' }}>Sign in</h2>
                <p className="text-[14px] mb-8" style={{ color: 'var(--c-t4)' }}>
                  Welcome back. Enter your credentials to continue.
                </p>

                <form onSubmit={login} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--c-t2)' }}>Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@artificialwit.com" required autoFocus
                      className="input-primary w-full rounded-xl px-4 py-3 text-[14px] border transition-all"
                      style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-[13px] font-medium" style={{ color: 'var(--c-t2)' }}>Password</label>
                      <button type="button" onClick={goToForgot}
                        className="text-[12px] font-medium transition-opacity hover:opacity-70"
                        style={{ color: 'var(--c-primary)' }}>
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <input type={showPw ? 'text' : 'password'} value={password}
                        onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                        className="input-primary w-full rounded-xl px-4 py-3 pr-11 text-[14px] border transition-all"
                        style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: 'var(--c-t4)' }}>
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                        className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--c-primary)' }} />
                      <span className="text-[13px]" style={{ color: 'var(--c-t3)' }}>Remember me</span>
                    </label>
                  </div>

                  {error && (
                    <div className="rounded-xl px-4 py-3 text-[13px]"
                      style={{ background: 'var(--c-primary-light)', border: '1px solid var(--c-primary)', color: 'var(--c-primary)' }}>
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={loading}
                    className="btn-primary w-full py-3.5 rounded-xl text-[15px] font-semibold transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? 'Signing in…' : 'Sign In'}
                  </button>
                </form>
              </>
            )}

            {/* ── Forgot password view ── */}
            {view === 'forgot' && (
              <>
                <button type="button" onClick={goToLogin}
                  className="flex items-center gap-1.5 text-[13px] font-medium mb-6 transition-opacity hover:opacity-70"
                  style={{ color: 'var(--c-t3)' }}>
                  <ArrowLeft size={14} />
                  Back to sign in
                </button>

                <h2 className="text-[28px] font-bold mb-1" style={{ color: 'var(--c-t1)' }}>Reset password</h2>
                <p className="text-[14px] mb-8" style={{ color: 'var(--c-t4)' }}>
                  Enter your email and we'll send you a link to reset your password.
                </p>

                <form onSubmit={sendResetLink} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--c-t2)' }}>Email</label>
                    <input type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      placeholder="you@artificialwit.com" required autoFocus
                      className="input-primary w-full rounded-xl px-4 py-3 text-[14px] border transition-all"
                      style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
                  </div>

                  {forgotError && (
                    <div className="rounded-xl px-4 py-3 text-[13px]"
                      style={{ background: 'var(--c-primary-light)', border: '1px solid var(--c-primary)', color: 'var(--c-primary)' }}>
                      {forgotError}
                    </div>
                  )}

                  <button type="submit" disabled={forgotLoading}
                    className="btn-primary w-full py-3.5 rounded-xl text-[15px] font-semibold transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                    {forgotLoading && <Loader2 size={16} className="animate-spin" />}
                    {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                  </button>
                </form>
              </>
            )}

            {/* ── Forgot password sent view ── */}
            {view === 'forgot-sent' && (
              <>
                <div className="flex flex-col items-center text-center py-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                    style={{ background: 'var(--c-primary-light)' }}>
                    <CheckCircle2 size={28} style={{ color: 'var(--c-primary)' }} />
                  </div>
                  <h2 className="text-[24px] font-bold mb-2" style={{ color: 'var(--c-t1)' }}>Check your inbox</h2>
                  <p className="text-[14px] leading-relaxed mb-2" style={{ color: 'var(--c-t4)' }}>
                    We sent a password reset link to
                  </p>
                  <p className="text-[14px] font-semibold mb-8" style={{ color: 'var(--c-t1)' }}>
                    {forgotEmail}
                  </p>
                  <p className="text-[13px] mb-8" style={{ color: 'var(--c-t4)' }}>
                    Didn't receive it? Check your spam folder or{' '}
                    <button type="button" onClick={() => setView('forgot')}
                      className="font-medium transition-opacity hover:opacity-70"
                      style={{ color: 'var(--c-primary)' }}>
                      try again
                    </button>.
                  </p>
                  <button type="button" onClick={goToLogin}
                    className="flex items-center gap-1.5 text-[13px] font-medium transition-opacity hover:opacity-70"
                    style={{ color: 'var(--c-t3)' }}>
                    <ArrowLeft size={14} />
                    Back to sign in
                  </button>
                </div>
              </>
            )}

          </div>

          {/* Features — mobile only, below the card */}
          <div className="md:hidden w-full max-w-[420px] mt-10">
            <FeatureList compact />
          </div>

        </div>
      </div>
    </div>
  )
}
