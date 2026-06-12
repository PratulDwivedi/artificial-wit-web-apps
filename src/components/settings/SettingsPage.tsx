'use client'

import { useState, useEffect } from 'react'
import {
  Settings2, KeyRound, Link2, Loader2, Eye, EyeOff,
  Copy, Check, RefreshCw, X,
} from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

// ── Types ──────────────────────────────────────────────────────────────────────

type Tab = 'apikey' | 'connections'

const TABS: { id: Tab; label: string }[] = [
  { id: 'apikey',      label: 'API Key'     },
  { id: 'connections', label: 'Connections' },
]

// ── Shared input style ─────────────────────────────────────────────────────────

const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition'
const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

// ── Alert ─────────────────────────────────────────────────────────────────────

function Alert({ msg, ok }: { msg: string; ok?: boolean }) {
  return (
    <div className="text-[12px] rounded-lg px-4 py-3 border"
      style={ok
        ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.3)' }
        : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
      {msg}
    </div>
  )
}

// ── Copy button ────────────────────────────────────────────────────────────────

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <button onClick={copy} title="Copy"
      className="p-2.5 rounded-xl border transition flex-shrink-0"
      style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', color: 'var(--c-t4)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
      {copied ? <Check size={14} style={{ color: '#16a34a' }} /> : <Copy size={14} />}
    </button>
  )
}

// ── Tab: API Key ───────────────────────────────────────────────────────────────

function ApiKeyTab() {
  const [masked,       setMasked]       = useState<string | null>(null)
  const [show,         setShow]         = useState(false)
  const [full,         setFull]         = useState<string | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [resetting,    setResetting]    = useState(false)
  const [msg,          setMsg]          = useState<{ text: string; ok: boolean } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const load = async () => {
    setLoading(true)
    const { data } = await HttpHelper.rpc('fn_get_api_key_masked')
    const env = data as { is_success: boolean; data: { x_api_key_masked: string }[] }
    if (env?.is_success) setMasked(env.data?.[0]?.x_api_key_masked ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleReveal = async () => {
    if (full) { setShow(s => !s); return }
    const { data } = await HttpHelper.rpc('fn_get_api_key')
    const env = data as { is_success: boolean; data: { x_api_key: string }[] }
    if (env?.is_success) { setFull(env.data?.[0]?.x_api_key ?? null); setShow(true) }
  }

  const handleReset = async () => {
    setResetting(true); setMsg(null)
    try {
      const { data, error } = await HttpHelper.rpc('fn_reset_api_key')
      if (error) throw error
      const env = data as { is_success: boolean; message: string }
      setMsg({ text: env?.message ?? 'API key reset', ok: env?.is_success ?? true })
      setFull(null); setShow(false)
      await load()
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Reset failed', ok: false })
    } finally {
      setResetting(false)
    }
  }

  const displayKey = show && full ? full : (masked ?? '—')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound size={16} style={{ color: 'var(--c-t3)' }} />
        <div>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>API key (x-api-key)</p>
          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
            Use this key in the <code className="font-mono text-[11px]">x-api-key</code> header to call the API on your behalf. Treat it like a password.
          </p>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
          style={{ color: 'var(--c-t4)' }}>Your key</label>
        {loading ? (
          <div className="flex items-center gap-2 py-3" style={{ color: 'var(--c-t5)' }}>
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : (
          <div className="relative">
            <input readOnly value={displayKey} type={show ? 'text' : 'password'}
              className={`${inputCls} pr-10 font-mono`} style={inputStyle} />
            <button onClick={handleReveal}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition"
              style={{ color: 'var(--c-t4)' }} title={show ? 'Hide' : 'Show'}>
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        )}
      </div>

      {msg && <Alert msg={msg.text} ok={msg.ok} />}

      <div>
        <button onClick={() => setConfirmReset(true)} disabled={resetting}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-[13px] font-medium transition disabled:opacity-60"
          style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
          {resetting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Reset API key
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset API key"
        message="The old key will stop working immediately. Any integrations using it will need to be updated."
        confirmLabel="Reset"
        variant="warning"
        onConfirm={() => { setConfirmReset(false); handleReset() }}
        onCancel={() => setConfirmReset(false)}
      />
    </div>
  )
}

// ── Tab: Connections ───────────────────────────────────────────────────────────

function ConnectionsTab() {
  const mcpUrl  = process.env.NEXT_PUBLIC_AW_MCP_BASE_URL  ?? ''
  const scimUrl = process.env.NEXT_PUBLIC_AW_SCIM_BASE_URL ?? ''

  const rows = [
    { label: 'MCP URL',  value: mcpUrl,  hint: 'Model Context Protocol endpoint for connecting AI clients.' },
    { label: 'SCIM URL', value: scimUrl, hint: 'SCIM 2.0 endpoint for user/group provisioning.' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Link2 size={16} style={{ color: 'var(--c-t3)' }} />
        <div>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>Connections</p>
          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Endpoints to plug external tools into your account.</p>
        </div>
      </div>
      {rows.map(row => (
        <div key={row.label}>
          <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
            style={{ color: 'var(--c-t4)' }}>{row.label}</label>
          <div className="flex items-center gap-2">
            <input readOnly value={row.value} className={`${inputCls} flex-1 font-mono`} style={inputStyle} />
            <CopyBtn value={row.value} />
          </div>
          <p className="text-[11px] mt-1" style={{ color: 'var(--c-t5)' }}>{row.hint}</p>
        </div>
      ))}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function SettingsPage({ onClose }: { onClose?: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('apikey')

  const isModal = !!onClose

  const tabs = (
    <div className="flex shrink-0 border-b" style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
      {TABS.map(t => {
        const isActive = activeTab === t.id
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="relative px-5 py-3 text-[13px] font-medium transition"
            style={{ color: isActive ? 'var(--c-primary)' : 'var(--c-t4)' }}>
            {t.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ background: 'var(--c-primary)' }} />
            )}
          </button>
        )
      })}
    </div>
  )

  const content = (
    <>
      {activeTab === 'apikey'      && <ApiKeyTab />}
      {activeTab === 'connections' && <ConnectionsTab />}
    </>
  )

  // ── Modal layout ─────────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <div className="relative rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col border h-[88vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Settings2 size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>Settings</h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                Manage your API key and integration connections.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {tabs}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {content}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Close
          </button>
        </div>
      </div>
    )
  }

  // ── Page layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--c-base)' }}>
      <div className="max-w-3xl w-full mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-7">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            <Settings2 size={22} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: 'var(--c-t1)' }}>Settings</h1>
            <p className="text-[13px]" style={{ color: 'var(--c-t4)' }}>
              Manage your API key and integration connections.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-6 border-b pb-0" style={{ borderColor: 'var(--c-border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition border-b-2 -mb-px"
              style={{
                color:       activeTab === t.id ? 'var(--c-t1)' : 'var(--c-t4)',
                borderColor: activeTab === t.id ? 'var(--c-primary)' : 'transparent',
                fontWeight:  activeTab === t.id ? 600 : undefined,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {content}
      </div>
    </div>
  )
}
