'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HttpHelper } from '@/lib/http'
import { resolveStartupRoute } from '@/lib/store'
import Image from 'next/image'
import { Loader2, Eye, EyeOff, MessageCircle, Library, Plug, Settings2, File } from 'lucide-react'

const FEATURES = [
  { icon: File,         title: 'Asset Management', description: 'IT Asset Management' },
  { icon: File,         title: 'Ticket Management', description: 'IT Ticket Management' },
]

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await HttpHelper.login(email, password)
    if (err) {
      setError(err)
      setLoading(false)
      return
    }
    // Fetch profile to resolve the startup route configured for this user
    try {
      const { data } = await HttpHelper.rpc('fn_get_profile')
      const env   = data as unknown as { is_success: boolean; data: Array<{ data?: { route_name_web?: string | Record<string, string> } }> }
      const route = resolveStartupRoute(env?.data?.[0]?.data?.route_name_web)
      router.push(route ? `/${route}` : '/')
    } catch {
      router.push('/')
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--c-base)' }}>
      <div className="flex flex-col md:flex-row md:min-h-full">

        {/* ── Left: feature showcase (desktop only) ────────────── */}
        <div className="hidden md:flex flex-col justify-center px-16 py-16 flex-1 max-w-[680px]">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-sm shrink-0">
              <Image src="/logo.png" alt="AW" width={48} height={48} className="w-full h-full object-cover" priority />
            </div>
            <div>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>Artificial Wit Apps</p>
              <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Your Intelligent Enterprise Assistant</p>
            </div>
          </div>

          <h1 className="text-[40px] font-bold leading-tight mb-3" style={{ color: 'var(--c-t1)' }}>
            Everything your business needs
          </h1>
          <p className="text-[15px] mb-10 leading-relaxed max-w-md" style={{ color: 'var(--c-t4)' }}>
            A workspace for AI-powered features, knowledge and operations.
          </p>

          <div className="flex flex-col gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--c-primary-light)' }}>
                  <Icon size={18} style={{ color: 'var(--c-primary)' }} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>{title}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-t4)' }}>{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: form + mobile extras ──────────────────────── */}
        <div className="flex-1 flex flex-col items-center px-6 pt-10 pb-12 md:justify-center md:px-8 md:py-16">

          {/* Brand — mobile only */}
          <div className="md:hidden w-full max-w-[420px] flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm shrink-0">
              <Image src="/logo.png" alt="AW" width={40} height={40} className="w-full h-full object-cover" priority />
            </div>
            <div>
              <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>Artificial Wit Apps</p>
              <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>Your Intelligent Enterprise Assistant</p>
            </div>
          </div>

          {/* Card */}
          <div className="w-full max-w-[420px] rounded-2xl shadow-lg p-8 md:p-10 border"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

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
                  <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--c-t2)' }}>Password</label>
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
          </div>

          {/* Features — mobile only, below the card */}
          <div className="md:hidden w-full max-w-[420px] mt-10 flex flex-col gap-5">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--c-primary-light)' }}>
                  <Icon size={18} style={{ color: 'var(--c-primary)' }} />
                </div>
                <div>
                  <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>{title}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--c-t4)' }}>{description}</p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
