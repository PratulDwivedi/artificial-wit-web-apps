'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HttpHelper } from '@/lib/http'
import { getProductConfig } from '@/lib/productConfig'
import Image from 'next/image'
import { Loader2, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'

const product = getProductConfig()

export default function ResetPasswordPage() {
  const router = useRouter()

  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [tokenError, setTokenError]   = useState(false)

  const [password, setPassword]         = useState('')
  const [confirm, setConfirm]           = useState('')
  const [showPw, setShowPw]             = useState(false)
  const [showConfirm, setShowConfirm]   = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [done, setDone]                 = useState(false)

  useEffect(() => {
    const hash   = window.location.hash.slice(1)
    const params = new URLSearchParams(hash)
    const token  = params.get('access_token')
    const type   = params.get('type')
    if (token && type === 'recovery') {
      setAccessToken(token)
    } else {
      setTokenError(true)
    }
  }, [])

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setError(null)
    setLoading(true)
    const { error: err } = await HttpHelper.resetPassword(accessToken!, password)
    setLoading(false)
    if (err) {
      setError(err)
      return
    }
    setDone(true)
  }

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center px-6 py-16" style={{ background: 'var(--c-base)' }}>
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
        <div className="rounded-2xl shadow-lg p-8 md:p-10 border"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

          {/* Invalid / missing token */}
          {tokenError && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'var(--c-primary-light)' }}>
                <AlertCircle size={28} style={{ color: 'var(--c-primary)' }} />
              </div>
              <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--c-t1)' }}>Link invalid or expired</h2>
              <p className="text-[14px] leading-relaxed mb-8" style={{ color: 'var(--c-t4)' }}>
                This password reset link is no longer valid. Please request a new one.
              </p>
              <button type="button" onClick={() => router.push('/login')}
                className="btn-primary w-full py-3.5 rounded-xl text-[15px] font-semibold transition-opacity">
                Back to Sign In
              </button>
            </div>
          )}

          {/* Success */}
          {done && (
            <div className="flex flex-col items-center text-center py-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'var(--c-primary-light)' }}>
                <CheckCircle2 size={28} style={{ color: 'var(--c-primary)' }} />
              </div>
              <h2 className="text-[22px] font-bold mb-2" style={{ color: 'var(--c-t1)' }}>Password updated</h2>
              <p className="text-[14px] leading-relaxed mb-8" style={{ color: 'var(--c-t4)' }}>
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button type="button" onClick={() => router.push('/login')}
                className="btn-primary w-full py-3.5 rounded-xl text-[15px] font-semibold transition-opacity">
                Sign In
              </button>
            </div>
          )}

          {/* Form */}
          {!tokenError && !done && (
            <>
              <h2 className="text-[28px] font-bold mb-1" style={{ color: 'var(--c-t1)' }}>Set new password</h2>
              <p className="text-[14px] mb-8" style={{ color: 'var(--c-t4)' }}>
                Choose a strong password for your account.
              </p>

              <form onSubmit={submit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--c-t2)' }}>New Password</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoFocus
                      className="input-primary w-full rounded-xl px-4 py-3 pr-11 text-[14px] border transition-all"
                      style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'var(--c-t4)' }}>
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[13px] font-medium mb-1.5" style={{ color: 'var(--c-t2)' }}>Confirm Password</label>
                  <div className="relative">
                    <input type={showConfirm ? 'text' : 'password'} value={confirm}
                      onChange={e => setConfirm(e.target.value)} placeholder="••••••••" required
                      className="input-primary w-full rounded-xl px-4 py-3 pr-11 text-[14px] border transition-all"
                      style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                      style={{ color: 'var(--c-t4)' }}>
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="rounded-xl px-4 py-3 text-[13px]"
                    style={{ background: 'var(--c-primary-light)', border: '1px solid var(--c-primary)', color: 'var(--c-primary)' }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading || !accessToken}
                  className="btn-primary w-full py-3.5 rounded-xl text-[15px] font-semibold transition-opacity disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {loading ? 'Updating…' : 'Update Password'}
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
