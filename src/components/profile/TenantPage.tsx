'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Building2, Loader2, Upload, Save, ChevronDown, Search,
} from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { useAppStore } from '@/lib/store'
import { ModalShell } from '@/components/common/ModalShell'

// ── Types ──────────────────────────────────────────────────────────────────────

interface TenantProfile {
  name: string
  data?: {
    logo_url?:        string | null
    datetime_format?: string | null
    language?:        string | null
    currency?:        string | null
    currency_symbol?: string | null
  } | null
}

interface ProfileEnvelope {
  is_success: boolean
  data: Array<{
    tenant?: TenantProfile
  }>
}

interface LookupItem { id: number; code: string; name: string; data?: { symbol?: string } | null }

// ── Helpers ────────────────────────────────────────────────────────────────────

const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition'
const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

function logoSrc(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `/api/profile-pics/download?filename=${encodeURIComponent(url)}`
}

// ── Searchable select ──────────────────────────────────────────────────────────

interface SearchSelectOption { value: string; label: string }

function SearchSelect({
  value, onChange, options, placeholder = '— Select —',
}: {
  value: string; onChange: (v: string) => void; options: SearchSelectOption[]; placeholder?: string
}) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => { if (!open) setQuery('') }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}
        style={inputStyle}>
        <span className="truncate" style={{ color: selected ? 'var(--c-t1)' : 'var(--c-t5)' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={13} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--c-t4)' }} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <Search size={13} style={{ color: 'var(--c-t4)', flexShrink: 0 }} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search…" className="flex-1 text-[12px] bg-transparent outline-none"
              style={{ color: 'var(--c-t1)' }} />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px]" style={{ color: 'var(--c-t5)' }}>No results</p>
            ) : filtered.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-[13px] transition"
                style={{
                  background: opt.value === value ? 'var(--c-primary-light)' : 'transparent',
                  color:      opt.value === value ? 'var(--c-primary)' : 'var(--c-t2)',
                  fontWeight: opt.value === value ? 600 : undefined,
                }}
                onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--c-hover)' }}
                onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function Alert({ msg, ok }: { msg: string; ok?: boolean }) {
  return (
    <div className="text-[12px] rounded-lg px-4 py-3 border"
      style={ok
        ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a',  borderColor: 'rgba(22,163,74,0.3)'  }
        : { background: 'rgba(220,38,38,0.08)', color: '#ef4444',  borderColor: 'rgba(220,38,38,0.2)'  }}>
      {msg}
    </div>
  )
}

// ── TenantPage ─────────────────────────────────────────────────────────────────

export function TenantPage({ onClose }: { onClose?: () => void } = {}) {
  const isModal = !!onClose
  const { tenantName, tenantLogoUrl, setTenantName, setTenantLogoUrl } = useAppStore()

  const [name,           setName]           = useState(tenantName ?? '')
  const [logoUrl,        setLogoUrl]        = useState(tenantLogoUrl ?? '')
  const [datetimeFormat, setDatetimeFormat] = useState('')
  const [language,       setLanguage]       = useState('')
  const [currency,       setCurrency]       = useState('')
  const [currencySymbol, setCurrencySymbol] = useState('')

  const [languages,  setLanguages]  = useState<LookupItem[]>([])
  const [currencies, setCurrencies] = useState<LookupItem[]>([])
  const [dtFormats,  setDtFormats]  = useState<LookupItem[]>([])

  const [loading,   setLoading]   = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      HttpHelper.rpc<LookupItem[]>('fn_get_languages').then(({ data }) => {
        if (data?.is_success) setLanguages(data.data ?? [])
      }),
      HttpHelper.rpc<LookupItem[]>('fn_get_currencies').then(({ data }) => {
        if (data?.is_success) setCurrencies(data.data ?? [])
      }),
      HttpHelper.rpc<LookupItem[]>('fn_get_datetime_formats').then(({ data }) => {
        if (data?.is_success) setDtFormats(data.data ?? [])
      }),
      HttpHelper.rpc<ProfileEnvelope>('fn_get_profile').then(({ data }) => {
        const tenant = (data as unknown as ProfileEnvelope)?.data?.[0]?.tenant
        if (tenant) {
          setName(tenant.name ?? '')
          setLogoUrl(tenant.data?.logo_url ?? '')
          setDatetimeFormat(tenant.data?.datetime_format ?? '')
          setLanguage(tenant.data?.language ?? '')
          setCurrency(tenant.data?.currency ?? '')
          setCurrencySymbol(tenant.data?.currency_symbol ?? '')
        }
      }),
    ]).finally(() => setLoading(false))
  }, [])

  const handleCurrencyChange = (code: string) => {
    setCurrency(code)
    const found = currencies.find(c => c.code === code)
    if (found?.data?.symbol) setCurrencySymbol(found.data.symbol)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/profile-pics/upload', { method: 'POST', body: form })
      const json = await res.json() as { success: boolean; url?: string; error?: string; detail?: string }
      if (!json.success) throw new Error([json.error, json.detail].filter(Boolean).join(' — '))
      setLogoUrl(json.url ?? '')
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Upload failed', ok: false })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = useCallback(async () => {
    setSaving(true); setMsg(null)
    try {
      const { data, error } = await HttpHelper.rpc('fn_update_tenant', {
        p_name: name,
        p_data: {
          logo_url:        logoUrl || null,
          datetime_format: datetimeFormat || null,
          language:        language || null,
          currency:        currency || null,
          currency_symbol: currencySymbol || null,
        },
      })
      if (error) throw error
      const env = data as { is_success: boolean; message: string }
      if (!env?.is_success) throw new Error(env?.message ?? 'Update failed')
      setTenantName(name)
      setTenantLogoUrl(logoUrl || null)
      setMsg({ text: env.message ?? 'Saved', ok: true })
      if (onClose) setTimeout(onClose, 1000)
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to save', ok: false })
    } finally {
      setSaving(false)
    }
  }, [name, logoUrl, datetimeFormat, language, currency, currencySymbol, setTenantName, setTenantLogoUrl])

  const content = loading ? (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={22} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
    </div>
  ) : (
    <div className="flex flex-col gap-5">
      {/* Logo row */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border flex items-center justify-center"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}>
          {logoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logoSrc(logoUrl) ?? ''} alt="Company logo" className="w-full h-full object-cover" />
            : <Building2 size={26} style={{ color: 'var(--c-t5)' }} />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[16px] font-semibold" style={{ color: 'var(--c-t1)' }}>{name || 'Company'}</p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>Company logo</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
        <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-[12px] font-medium transition disabled:opacity-60"
          style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
          onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = 'var(--c-active)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? 'Uploading…' : 'Upload logo'}
        </button>
      </div>

      <div className="h-px" style={{ background: 'var(--c-border)' }} />

      {/* Fields */}
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
            style={{ color: 'var(--c-t4)' }}>Company Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. Acme Corp" className={inputCls} style={inputStyle} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Date &amp; time format</label>
            <SearchSelect value={datetimeFormat} onChange={setDatetimeFormat}
              options={dtFormats.map(f => ({ value: f.code, label: f.name }))} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Language</label>
            <SearchSelect value={language} onChange={setLanguage}
              options={languages.map(l => ({ value: l.code, label: l.name }))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Currency</label>
            <SearchSelect value={currency} onChange={handleCurrencyChange}
              options={currencies.map(c => ({ value: c.code, label: `${c.code} (${c.data?.symbol ?? ''}) — ${c.name}` }))} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Currency symbol</label>
            <input value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)}
              placeholder="e.g. ₹" className={inputCls} style={inputStyle} />
          </div>
        </div>
      </div>

      {msg && <Alert msg={msg.text} ok={msg.ok} />}

      {!isModal && (
        <div className="flex justify-end">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 btn-primary rounded-xl text-[13px] font-semibold transition disabled:opacity-60">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save changes
          </button>
        </div>
      )}
    </div>
  )

  // ── Page layout ────────────────────────────────────────────────────────────────
  if (!isModal) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--c-base)' }}>
        <div className="max-w-3xl w-full mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-7">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--c-primary-light)' }}>
              <Building2 size={22} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold" style={{ color: 'var(--c-t1)' }}>Company Settings</h1>
              <p className="text-[13px]" style={{ color: 'var(--c-t4)' }}>
                Manage your company profile, logo, and regional preferences.
              </p>
            </div>
          </div>
          {content}
        </div>
      </div>
    )
  }

  // ── Modal layout ───────────────────────────────────────────────────────────────
  return (
    <ModalShell
      icon={<Building2 size={16} style={{ color: 'var(--c-primary)' }} />}
      title="Company Settings"
      subtitle="Manage your company profile, logo, and regional preferences."
      onClose={onClose}
      onSave={handleSave}
      saving={saving}
    >
      {content}
    </ModalShell>
  )
}
