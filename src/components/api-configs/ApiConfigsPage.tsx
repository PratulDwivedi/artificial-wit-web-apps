'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, Loader2, X, Webhook } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import SearchableSelect from '@/components/common/SearchableSelect'
import { useEditParam } from '@/lib/useEditParam'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'

// ── Types ──────────────────────────────────────────────────────────────────────

type ApiType = 'analytics' | 'action'

interface BodyField {
  name: string
  path: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  title: string
  description: string
  source: string
}

interface OutputField {
  name: string
  path: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
}

export interface ApiConfig {
  id: number
  name: string
  api_type: ApiType
  url: string
  method: string
  headers: Record<string, string>
  body: BodyField[]
  fields: OutputField[]
  api_auth_id: number | null
  api_auth_name: string | null
  api_auth_type: string | null
  data_field_path: string
  data: { description?: string; [key: string]: unknown }
  access_control: { scope?: string; roles?: number[] }
  created_at: string
  updated_at: string
  roles: { id: number; name: string }[]
}

interface ApiAuth {
  id: number
  name: string
  auth_type: string
}

// ── Badges ─────────────────────────────────────────────────────────────────────

function ApiTypeBadge({ type }: { type: string }) {
  return type === 'action' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
      style={{ background: 'rgba(234,88,12,0.10)', color: '#ea580c', borderColor: 'rgba(234,88,12,0.25)' }}>
      Action
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
      style={{ background: 'rgba(37,99,235,0.10)', color: '#2563eb', borderColor: 'rgba(37,99,235,0.25)' }}>
      Analytics
    </span>
  )
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    GET:    { bg: 'rgba(22,163,74,0.10)',  color: '#16a34a' },
    POST:   { bg: 'rgba(37,99,235,0.10)',  color: '#2563eb' },
    PUT:    { bg: 'rgba(234,179,8,0.10)',  color: '#ca8a04' },
    DELETE: { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626' },
    PATCH:  { bg: 'rgba(168,85,247,0.10)', color: '#9333ea' },
  }
  const { bg, color } = colors[method?.toUpperCase()] ?? colors.POST
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
      style={{ background: bg, color }}>
      {method}
    </span>
  )
}

function AccessBadge({ scope }: { scope?: string }) {
  const s = scope ?? 'private'
  const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
    private:   { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', border: 'rgba(220,38,38,0.25)',  label: 'Private'   },
    protected: { bg: 'rgba(234,179,8,0.10)',  color: '#ca8a04', border: 'rgba(234,179,8,0.30)',  label: 'Protected' },
    public:    { bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', border: 'rgba(22,163,74,0.25)',  label: 'Public'    },
  }
  const { bg, color, border, label } = styles[s] ?? styles.private
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border"
      style={{ background: bg, color, borderColor: border }}>
      {label}
    </span>
  )
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

const API_TYPES    = [{ value: 'analytics', label: 'Analyst' }, { value: 'action', label: 'Action' }]
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
const PARAM_TYPES  = ['string', 'number', 'boolean']
const FIELD_TYPES  = ['string', 'number', 'boolean', 'array', 'object']

function StyledSelect({ value, onChange, options, style, className }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  style?: React.CSSProperties
  className?: string
}) {
  return (
    <div className="relative">
      <select value={value} onChange={e => onChange(e.target.value)}
        className={`w-full appearance-none cursor-pointer rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition ${className ?? ''}`}
        style={style}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t4)' }}>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  )
}

// ── Save Modal ─────────────────────────────────────────────────────────────────

const MODAL_TABS = [
  { id: 'basic',      label: 'Basic'                         },
  { id: 'headers',    label: 'Headers'                       },
  { id: 'parameters', label: 'Input Schema (Payload)'        },
  { id: 'fields',     label: 'Output Schema (Fields)'        },
] as const

type ModalTab = typeof MODAL_TABS[number]['id']

export function ApiConfigSaveModal({ config, sourceOptions, onClose, onSaved }: {
  config: ApiConfig | null
  sourceOptions: { value: string; label: string }[]
  onClose: () => void
  onSaved: (c: ApiConfig) => void
}) {
  const isEdit   = config !== null

  // ── Form state ──────────────────────────────────────────────────────────────
  const [activeTab,     setActiveTab]     = useState<ModalTab>('basic')
  const [name,          setName]          = useState(config?.name ?? '')
  const [title,         setTitle]         = useState((config?.data?.title as string) ?? '')
  const [description,   setDescription]   = useState(config?.data?.description ?? '')
  const [apiType,       setApiType]       = useState(config?.api_type ?? 'analytics')
  const [url,           setUrl]           = useState(config?.url ?? '')
  const [method,        setMethod]        = useState(config?.method ?? 'POST')
  const [dataFieldPath, setDataFieldPath] = useState(config?.data_field_path ?? 'data')
  const [apiAuthId,     setApiAuthId]     = useState<string>(
    config?.api_auth_id && config.api_auth_id > 0 ? String(config.api_auth_id) : ''
  )
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(
    Object.entries(config?.headers ?? {}).map(([key, value]) => ({ key, value }))
  )
  const [params, setParams] = useState<BodyField[]>(
    Array.isArray(config?.body)
      ? config.body.map(f => ({
          name: f.name ?? '', path: f.path ?? '',
          type: (f.type ?? 'string') as BodyField['type'],
          required: !!f.required, title: f.title ?? '', description: f.description ?? '', source: f.source ?? '',
        }))
      : []
  )
  const [fields, setFields] = useState<OutputField[]>(
    Array.isArray(config?.fields)
      ? config.fields.map(f => ({
          name: f.name ?? '', path: f.path ?? '',
          type: (f.type ?? 'string') as OutputField['type'],
          description: f.description ?? '',
        }))
      : []
  )

  const [globalVars,  setGlobalVars]  = useState<{ id: number; name: string; value?: string }[]>([])
  const [discovering, setDiscovering] = useState(false)
  const [discoverError, setDiscoverError] = useState<string | null>(null)
  const [apiAuths,   setApiAuths]   = useState<ApiAuth[]>([])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // ── Variable chip cursor tracking ────────────────────────────────────────────
  // All tab content stays in the DOM (display:none when inactive) so activeRef
  // is always valid regardless of which tab is visible.
  const activeRef = useRef<{
    el: HTMLInputElement | HTMLTextAreaElement
    setState: (v: string) => void
  } | null>(null)

  const bindVar = (setState: (v: string) => void) => ({
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      activeRef.current = { el: e.currentTarget, setState }
    },
  })

  const insertVar = useCallback((token: string) => {
    if (!activeRef.current) return
    const { el, setState } = activeRef.current
    const start = el.selectionStart ?? el.value.length
    const end   = el.selectionEnd   ?? el.value.length
    const next  = el.value.slice(0, start) + token + el.value.slice(end)
    setState(next)
    requestAnimationFrame(() => {
      // Only restore cursor if the element is visible (not in a hidden tab)
      if (el.isConnected && el.offsetParent !== null) {
        el.focus()
        el.setSelectionRange(start + token.length, start + token.length)
      }
    })
  }, [])

  // ── Load supporting data ─────────────────────────────────────────────────────
  useEffect(() => {
    HttpHelper.rpc('fn_get_global_variables', { p_id: null, p_search: null }).then(({ data }) => {
      const env = data as { is_success: boolean; data: { id: number; name: string }[] }
      if (env?.is_success) setGlobalVars(env.data ?? [])
    })
    HttpHelper.rpc('fn_get_api_auths', { p_id: null, p_search: null }).then(({ data }) => {
      const env = data as { is_success: boolean; data: ApiAuth[] }
      if (env?.is_success) setApiAuths(env.data ?? [])
    })
  }, [])

  // ── Test & Discover fields ───────────────────────────────────────────────────
  const discoverFields = async () => {
    if (!url.trim()) { setDiscoverError('URL is required on the Basic tab first'); return }
    setDiscovering(true); setDiscoverError(null)
    try {
      const resolve = (str: string) =>
        globalVars.reduce((s, v) => s.replaceAll(`{{${v.name}}}`, v.value ?? ''), str)

      const resolvedUrl = resolve(url.trim())
      const resolvedHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      headers.filter(h => h.key.trim()).forEach(h => {
        resolvedHeaders[h.key.trim()] = resolve(h.value)
      })

      const res = await fetch(resolvedUrl, {
        method,
        headers: resolvedHeaders,
        ...(method !== 'GET' ? { body: JSON.stringify({}) } : {}),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
      const json = await res.json()

      // Navigate to the data collection using dataFieldPath
      const traverse = (obj: unknown, path: string): unknown =>
        path.split('.').filter(Boolean).reduce(
          (acc, key) => (acc && typeof acc === 'object' && !Array.isArray(acc)
            ? (acc as Record<string, unknown>)[key]
            : acc),
          obj
        )

      const root = traverse(json, dataFieldPath)
      const sample: Record<string, unknown> =
        Array.isArray(root) && root.length > 0
          ? (root[0] as Record<string, unknown>)
          : root && typeof root === 'object' ? (root as Record<string, unknown>) : {}

      const inferType = (v: unknown): OutputField['type'] => {
        if (Array.isArray(v))      return 'array'
        if (v === null)            return 'string'
        if (typeof v === 'object') return 'object'
        if (typeof v === 'boolean') return 'boolean'
        if (typeof v === 'number') return 'number'
        return 'string'
      }

      const discovered: OutputField[] = Object.entries(sample).map(([name, val]) => ({
        name, path: name, type: inferType(val), description: '',
      }))

      setFields(prev => {
        const existing = new Map(prev.map(f => [f.name, f]))
        return discovered.map(d => ({
          ...d,
          description: existing.get(d.name)?.description ?? '',
        }))
      })
    } catch (e: unknown) {
      setDiscoverError(e instanceof Error ? e.message : 'Discovery failed')
    } finally {
      setDiscovering(false)
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!name.trim() || !url.trim() || !description.trim()) {
      setError('Name, Description, and URL are required')
      setActiveTab('basic')
      return
    }
    if (!/^[a-z_]+$/.test(name.trim())) {
      setError('Name must contain only lowercase letters and underscores')
      setActiveTab('basic')
      return
    }
    setSaving(true); setError(null)
    const headersObj: Record<string, string> = {}
    headers.filter(h => h.key.trim()).forEach(h => { headersObj[h.key.trim()] = h.value })
    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_api_config', {
        p_id:              isEdit ? config.id : null,
        p_api_type:        apiType,
        p_name:            name.trim(),
        p_url:             url.trim(),
        p_method:          method,
        p_body:            params,
        p_headers:         headersObj,
        p_fields:          fields,
        p_api_auth_id:     apiAuthId ? parseInt(apiAuthId) : null,
        p_data_field_path: dataFieldPath || 'data',
        p_data:            { description: description.trim(), title: title.trim() },
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: ApiConfig[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved({ ...(isEdit ? config : {} as ApiConfig), ...env.data[0] })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save API config')
    } finally {
      setSaving(false)
    }
  }

  // ── Shared styles ────────────────────────────────────────────────────────────
  const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }
  const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition'
  const labelCls   = 'text-[11px] font-semibold uppercase tracking-wide mb-1.5 block'
  const labelStyle = { color: 'var(--c-t4)' }

  // ── Tab counts ───────────────────────────────────────────────────────────────
  const counts: Record<ModalTab, number | null> = {
    basic:      null,
    headers:    headers.length || null,
    parameters: params.length || null,
    fields:     fields.length || null,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col border h-[88vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* ── Modal header ── */}
        <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Webhook size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit API Config' : 'Add API Config'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                Configure an API tool for the AI assistant.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex shrink-0 border-b" style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
          {MODAL_TABS.map(tab => {
            const isActive = activeTab === tab.id
            const count    = counts[tab.id]
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="relative px-5 py-3 text-[13px] font-medium transition flex items-center gap-1.5"
                style={{ color: isActive ? 'var(--c-primary)' : 'var(--c-t4)' }}>
                {tab.label}
                {count !== null && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                    style={{
                      background: isActive ? 'var(--c-primary-light)' : 'var(--c-hover)',
                      color: isActive ? 'var(--c-primary)' : 'var(--c-t5)',
                    }}>
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                    style={{ background: 'var(--c-primary)' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Tab content (all rendered, inactive hidden) ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Basic */}
          <div className="flex flex-col gap-5" style={{ display: activeTab === 'basic' ? 'flex' : 'none' }}>
            <div className="grid grid-cols-[1fr_1fr_120px] gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value.toLowerCase().replace(/[^a-z_]/g, ''))}
                  autoFocus={!isEdit}
                  placeholder="e.g. get_assets"
                  className={`${inputCls} font-mono`}
                  style={inputStyle}
                  {...bindVar(v => setName(v.toLowerCase().replace(/[^a-z_]/g, '')))}
                />
                <p className="text-[10px] mt-1" style={{ color: 'var(--c-t5)' }}>
                  Lowercase letters and underscores only — MCP tool naming convention.
                </p>
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Human-readable title"
                  className={inputCls}
                  style={inputStyle}
                  {...bindVar(setTitle)}
                />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>API Type</label>
                <StyledSelect value={apiType} onChange={v => setApiType(v as ApiType)}
                  options={API_TYPES}
                  style={{ ...inputStyle, fontSize: 12 }} />
              </div>
            </div>

            <div>
              <label className={labelCls} style={labelStyle}>
                Description <span className="text-red-500">*</span>
              </label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What does this API do?" className={inputCls} style={inputStyle}
                {...bindVar(setDescription)} />
            </div>

            <div className="grid grid-cols-[130px_1fr] gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Method</label>
                <StyledSelect value={method} onChange={setMethod}
                  options={HTTP_METHODS.map(m => ({ value: m, label: m }))} style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>
                  URL <span className="text-red-500">*</span>
                </label>
                <input value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="{{AWT_SUPABASE_URL}}/rest/v1/rpc/fn_get_assets"
                  className={`${inputCls} font-mono text-[12px]`} style={inputStyle}
                  {...bindVar(setUrl)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>Credential</label>
                <StyledSelect value={apiAuthId} onChange={setApiAuthId}
                  options={[
                    { value: '', label: 'None' },
                    ...apiAuths.map(a => ({ value: String(a.id), label: `${a.name} (${a.auth_type})` })),
                  ]}
                  style={inputStyle} />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>Data Field Path</label>
                <input value={dataFieldPath} onChange={e => setDataFieldPath(e.target.value)}
                  placeholder="data" className={`${inputCls} font-mono`} style={inputStyle}
                  {...bindVar(setDataFieldPath)} />
              </div>
            </div>
          </div>

          {/* Headers */}
          <div style={{ display: activeTab === 'headers' ? 'block' : 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
                Request headers sent with every call to this API.
              </p>
              <button type="button" onClick={() => setHeaders(p => [...p, { key: '', value: '' }])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition hover:bg-[var(--c-hover)]"
                style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}>
                <Plus size={12} /> Add Header
              </button>
            </div>
            {headers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <p className="text-[13px] font-medium" style={{ color: 'var(--c-t3)' }}>No headers yet</p>
                <p className="text-[12px]" style={{ color: 'var(--c-t5)' }}>Click "Add Header" to add request headers.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={h.key} placeholder="Header name"
                      onChange={e => setHeaders(p => p.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
                      className="flex-[0_0_35%] rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
                      style={inputStyle}
                      {...bindVar(v => setHeaders(p => p.map((x, idx) => idx === i ? { ...x, key: v } : x)))} />
                    <input value={h.value} placeholder="Value or {{VARIABLE}}"
                      onChange={e => setHeaders(p => p.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                      className="flex-1 rounded-xl px-3 py-2.5 text-[13px] font-mono border focus:outline-none transition"
                      style={inputStyle}
                      {...bindVar(v => setHeaders(p => p.map((x, idx) => idx === i ? { ...x, value: v } : x)))} />
                    <button type="button" onClick={() => setHeaders(p => p.filter((_, idx) => idx !== i))}
                      className="p-2 rounded-lg transition hover:bg-red-500/10 shrink-0"
                      style={{ color: 'var(--c-t4)' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Parameters — Input Schema */}
          <div style={{ display: activeTab === 'parameters' ? 'block' : 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
                Input schema — parameters the AI will populate when calling this API.
              </p>
              <button type="button"
                onClick={() => setParams(p => [...p, { name: '', path: '', type: 'string', required: false, title: '', description: '', source: '' }])}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition hover:bg-[var(--c-hover)]"
                style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}>
                <Plus size={12} /> Add Parameter
              </button>
            </div>
            {params.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <p className="text-[13px] font-medium" style={{ color: 'var(--c-t3)' }}>No parameters yet</p>
                <p className="text-[12px]" style={{ color: 'var(--c-t5)' }}>
                  Add parameters to define the payload schema for this API.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {params.map((f, i) => (
                  <div key={i} className="flex flex-col gap-2 p-3 rounded-xl border"
                    style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}>
                    {/* Row 1: name | title | type | required | source | delete */}
                    <div className="flex items-center gap-2">
                      <input value={f.name} placeholder="param_name"
                        onChange={e => setParams(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                        className="flex-1 rounded-lg px-3 py-2 text-[12px] font-mono border focus:outline-none transition"
                        style={inputStyle}
                        {...bindVar(v => setParams(p => p.map((x, idx) => idx === i ? { ...x, name: v } : x)))} />
                      <input value={f.title} placeholder="Title"
                        onChange={e => setParams(p => p.map((x, idx) => idx === i ? { ...x, title: e.target.value } : x))}
                        className="flex-1 rounded-lg px-3 py-2 text-[12px] border focus:outline-none transition"
                        style={inputStyle}
                        {...bindVar(v => setParams(p => p.map((x, idx) => idx === i ? { ...x, title: v } : x)))} />
                      <div className="w-[105px] shrink-0">
                        <StyledSelect value={f.type}
                          onChange={v => setParams(p => p.map((x, idx) => idx === i ? { ...x, type: v as BodyField['type'] } : x))}
                          options={FIELD_TYPES.map(t => ({ value: t, label: t }))}
                          style={{ ...inputStyle, padding: '7px 28px 7px 10px', fontSize: 12, borderRadius: 8 }} />
                      </div>
                      <label className="flex items-center gap-1.5 text-[12px] shrink-0 cursor-pointer select-none"
                        style={{ color: 'var(--c-t3)' }}>
                        <input type="checkbox" checked={f.required}
                          onChange={e => setParams(p => p.map((x, idx) => idx === i ? { ...x, required: e.target.checked } : x))} />
                        Required
                      </label>
                      <div className="w-[160px] shrink-0">
                        <SearchableSelect
                          value={f.source}
                          onChange={v => setParams(p => p.map((x, idx) => idx === i ? { ...x, source: v } : x))}
                          options={sourceOptions}
                          placeholder="Source API"
                          clearable
                        />
                      </div>
                      <button type="button"
                        onClick={() => setParams(p => p.filter((_, idx) => idx !== i))}
                        className="p-1.5 rounded-lg transition hover:bg-red-500/10 shrink-0"
                        style={{ color: 'var(--c-t4)' }}>
                        <X size={13} />
                      </button>
                    </div>
                    {/* Row 2: description full width */}
                    <input value={f.description} placeholder="Description for the AI"
                      onChange={e => setParams(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                      className="w-full rounded-lg px-3 py-2 text-[12px] border focus:outline-none transition"
                      style={inputStyle}
                      {...bindVar(v => setParams(p => p.map((x, idx) => idx === i ? { ...x, description: v } : x)))} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fields — Output Schema */}
          <div style={{ display: activeTab === 'fields' ? 'block' : 'none' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
                Output schema — fields returned by this API that the AI can reference.
              </p>
              <div className="flex items-center gap-2">
                <button type="button" onClick={discoverFields} disabled={discovering}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition hover:bg-[var(--c-hover)] disabled:opacity-60"
                  style={{ borderColor: 'var(--c-primary)', color: 'var(--c-primary)', background: 'var(--c-primary-light)' }}>
                  {discovering ? <Loader2 size={12} className="animate-spin" /> : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><path d="M11 8v6M8 11h6"/>
                    </svg>
                  )}
                  {discovering ? 'Discovering…' : 'Test & Discover'}
                </button>
                <button type="button"
                  onClick={() => setFields(p => [...p, { name: '', path: '', type: 'string', description: '' }])}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition hover:bg-[var(--c-hover)]"
                  style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}>
                  <Plus size={12} /> Add Field
                </button>
              </div>
            </div>

            {discoverError && (
              <div className="mb-3 text-[12px] rounded-lg px-4 py-3 border"
                style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
                {discoverError}
              </div>
            )}

            {fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <p className="text-[13px] font-medium" style={{ color: 'var(--c-t3)' }}>No fields defined</p>
                <p className="text-[12px]" style={{ color: 'var(--c-t5)' }}>
                  Click <strong>Test &amp; Discover</strong> to auto-detect fields by calling the API, or add them manually.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {fields.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={f.name} placeholder="field_name"
                      onChange={e => setFields(p => p.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))}
                      className="flex-[0_0_22%] rounded-xl px-3 py-2.5 text-[13px] font-mono border focus:outline-none transition"
                      style={inputStyle}
                      {...bindVar(v => setFields(p => p.map((x, idx) => idx === i ? { ...x, name: v } : x)))} />
                    <input value={f.path} placeholder="json.path"
                      onChange={e => setFields(p => p.map((x, idx) => idx === i ? { ...x, path: e.target.value } : x))}
                      className="flex-[0_0_20%] rounded-xl px-3 py-2.5 text-[12px] font-mono border focus:outline-none transition"
                      style={inputStyle}
                      {...bindVar(v => setFields(p => p.map((x, idx) => idx === i ? { ...x, path: v } : x)))} />
                    <div className="w-[110px] shrink-0">
                      <StyledSelect value={f.type}
                        onChange={v => setFields(p => p.map((x, idx) => idx === i ? { ...x, type: v as OutputField['type'] } : x))}
                        options={FIELD_TYPES.map(t => ({ value: t, label: t }))}
                        style={{ ...inputStyle, padding: '8px 32px 8px 10px', fontSize: 12, borderRadius: 12 }} />
                    </div>
                    <input value={f.description} placeholder="Description"
                      onChange={e => setFields(p => p.map((x, idx) => idx === i ? { ...x, description: e.target.value } : x))}
                      className="flex-1 rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
                      style={inputStyle}
                      {...bindVar(v => setFields(p => p.map((x, idx) => idx === i ? { ...x, description: v } : x)))} />
                    <button type="button"
                      onClick={() => setFields(p => p.filter((_, idx) => idx !== i))}
                      className="p-2 rounded-lg transition hover:bg-red-500/10 shrink-0"
                      style={{ color: 'var(--c-t4)' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Variable chips — always visible ── */}
        {globalVars.length > 0 && (
          <div className="px-6 py-3 border-t shrink-0"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-t5)' }}>
              Insert variable at cursor
            </p>
            <div className="flex flex-wrap gap-1.5">
              {globalVars.map(v => (
                <button key={v.id} type="button" onClick={() => insertVar(`{{${v.name}}}`)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-opacity hover:opacity-80"
                  style={{ background: 'var(--c-t1)', color: 'var(--c-panel)' }}>
                  {`{{${v.name}}}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mx-6 mb-2 text-[12px] rounded-lg px-4 py-3 border shrink-0"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="flex gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={saving}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                       transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Update Config' : 'Add Config'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Config row ─────────────────────────────────────────────────────────────────

function ConfigRow({
  config, index, onEdit, onDeleted, onAccessControl,
}: {
  config: ApiConfig
  index: number
  onEdit: () => void
  onDeleted: (id: number) => void
  onAccessControl: () => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_delete_api_config', { p_id: config.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(config.id)
    } catch { /* ignore */ } finally {
      setDeleting(false); setConfirmDel(false)
    }
  }

  return (
    <tr className="border-b group" style={{ borderColor: 'var(--c-border)' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
      onMouseLeave={e => (e.currentTarget.style.background = '')}>

      <td className="px-4 py-1.5 whitespace-nowrap w-14">
        <span className="text-[12px] font-mono" style={{ color: 'var(--c-t5)' }}>{index}</span>
      </td>

      <td className="px-4 py-1.5 whitespace-nowrap">
        <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--c-primary)' }}>
          {config.name}
        </span>
      </td>

      <td className="px-4 py-1.5 whitespace-nowrap">
        <ApiTypeBadge type={config.api_type} />
      </td>

      <td className="px-4 py-1.5 whitespace-nowrap">
        <MethodBadge method={config.method} />
      </td>

      <td className="px-4 py-1.5 max-w-[260px]">
        <span className="font-mono text-[11px] truncate block max-w-[240px]" style={{ color: 'var(--c-t3)' }}>
          {config.url}
        </span>
      </td>

      <td className="px-4 py-1.5 whitespace-nowrap">
        {config.api_auth_name
          ? <span className="text-[12px]" style={{ color: 'var(--c-t2)' }}>{config.api_auth_name}</span>
          : <span style={{ color: 'var(--c-t5)' }}>—</span>
        }
      </td>

      <td className="px-4 py-1.5 whitespace-nowrap">
        <AccessBadge scope={config.access_control?.scope} />
      </td>

      <td className="px-4 py-1.5 whitespace-nowrap">
        {confirmDel ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color: 'var(--c-t4)' }}>Delete?</span>
            <button onClick={handleDelete} disabled={deleting}
              className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[11px] rounded-md transition">
              {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
            </button>
            <button onClick={() => setConfirmDel(false)}
              className="px-2 py-0.5 rounded-md text-[11px] transition hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t4)' }}>
              No
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5">
            <button onClick={onAccessControl} title="Access Control"
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-active)]"
              style={{ color: 'var(--c-t4)' }}>
              <ShieldCheck size={15} />
            </button>
            <button onClick={onEdit} title="Edit"
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-active)]"
              style={{ color: 'var(--c-t4)' }}>
              <Pencil size={15} />
            </button>
            <button onClick={() => setConfirmDel(true)} title="Delete"
              className="p-1.5 rounded-lg transition hover:bg-red-500/10"
              style={{ color: 'var(--c-t4)' }}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const CONFIG_COLUMNS: Column<ApiConfig>[] = [
  { key: 'name',   label: 'Name',   exportValue: c => c.name },
  { key: 'type',   label: 'Type',   filterValue: c => c.api_type, exportValue: c => c.api_type },
  { key: 'method', label: 'Method', filterValue: c => c.method,   exportValue: c => c.method },
  { key: 'url',    label: 'URL',    exportValue: c => c.url },
  { key: 'auth',   label: 'Auth',   exportValue: c => c.api_auth_name ?? '' },
  { key: 'access', label: 'Access', filterValue: c => (c.access_control?.scope ?? 'private').charAt(0).toUpperCase() + (c.access_control?.scope ?? 'private').slice(1), exportValue: c => c.access_control?.scope ?? 'private' },
  { key: 'actions', label: 'Actions' },
]

export function ApiConfigsPage() {

  const [configs,      setConfigs]      = useState<ApiConfig[]>([])
  const [loading,      setLoading]      = useState(true)
  const [accessTarget, setAccessTarget] = useState<ApiConfig | null>(null)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_get_api_configs', { p_id: null, p_search: null })
      if (error) throw error
      const env = data as { is_success: boolean; data: ApiConfig[] }
      if (env.is_success) setConfigs(env.data ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--c-panel)' }}>

      <PageHeader
        icon={<Webhook size={20} style={{ color: 'var(--c-primary)' }} />}
        title="API Configs"
        description="Define the APIs and tools available to the AI assistant."
        addLabel="Add Config"
        onAdd={() => openEdit('new')}
      />

      <DataTable
        columns={CONFIG_COLUMNS}
        rows={configs}
        loading={loading}
        searchPlaceholder="Search by name or URL..."
        searchFields={c => `${c.name} ${c.url}`}
        exportFilename="api-configs"
        emptyIcon={<Webhook size={24} style={{ color: 'var(--c-t5)' }} />}
        emptyTitle="No API configs yet"
        emptyDescription="Add your first API config to get started."
        onAddClick={() => openEdit('new')}
        addLabel="Add Config"
        renderRow={(c, i) => (
          <ConfigRow
            config={c}
            index={i}
            onEdit={() => openEdit(c.id)}
            onDeleted={id => setConfigs(prev => prev.filter(x => x.id !== id))}
            onAccessControl={() => setAccessTarget(c)}
          />
        )}
      />

      {editId !== null && (
        <ApiConfigSaveModal
          config={editId === 'new' ? null : configs.find(c => String(c.id) === editId) ?? null}
          sourceOptions={configs.map(c => ({ value: c.name, label: c.name }))}
          onClose={closeEdit}
          onSaved={saved => {
            setConfigs(prev => {
              const exists = prev.find(x => x.id === saved.id)
              return exists ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]
            })
            closeEdit()
          }}
        />
      )}

      {accessTarget && (
        <AccessControl
          resourceName={accessTarget.name}
          recordId={accessTarget.id}
          routeName="api_configs"
          accessControl={accessTarget.access_control}
          onClose={() => setAccessTarget(null)}
          onSaved={ac => {
            setConfigs(prev => prev.map(x =>
              x.id === accessTarget.id ? { ...x, access_control: ac } : x
            ))
            setAccessTarget(null)
          }}
        />
      )}
    </div>
  )
}
