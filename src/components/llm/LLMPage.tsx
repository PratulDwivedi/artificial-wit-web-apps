'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Search, Eye, EyeOff, Pencil, Trash2, ShieldCheck, Loader2, X, Star, Cpu } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import { useEditParam } from '@/lib/useEditParam'

// ── Types ──────────────────────────────────────────────────────────────────────

interface LLMConfig {
  id: number
  name: string
  provider: string
  model: string
  api_key: string
  endpoint: string
  is_default: boolean
  data: { is_embed_model?: boolean }
  access_control: { scope?: string; roles?: number[] }
  created_at: string
  updated_at: string
}

// ── Provider / model catalog ───────────────────────────────────────────────────

const PROVIDERS: Record<string, { models: string[]; defaultEndpoint: string }> = {
  OpenAI: {
    defaultEndpoint: 'https://api.openai.com/v1',
    models: [
      'gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini',
      'gpt-4-turbo', 'gpt-3.5-turbo',
      'o1', 'o1-mini', 'o3-mini',
      'text-embedding-3-small', 'text-embedding-3-large', 'text-embedding-ada-002',
    ],
  },
  Anthropic: {
    defaultEndpoint: 'https://api.anthropic.com/v1',
    models: [
      'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001',
      'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307',
      'claude-sonnet-4-20250514',
    ],
  },
  Google: {
    defaultEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      'gemini-2.0-flash', 'gemini-2.0-flash-lite',
      'gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b',
    ],
  },
  'Azure OpenAI': {
    defaultEndpoint: '',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-35-turbo', 'text-embedding-ada-002'],
  },
  Mistral: {
    defaultEndpoint: 'https://api.mistral.ai/v1',
    models: ['mistral-large-latest', 'mistral-medium', 'mistral-small', 'mistral-embed'],
  },
  Cohere: {
    defaultEndpoint: 'https://api.cohere.ai/v1',
    models: ['command-r-plus', 'command-r', 'command', 'embed-english-v3.0'],
  },
  Custom: {
    defaultEndpoint: '',
    models: [],
  },
}

const PROVIDER_LIST = Object.keys(PROVIDERS)

// ── Badges ─────────────────────────────────────────────────────────────────────

function AccessBadge({ scope }: { scope?: string }) {
  const s = scope ?? 'private'
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    private:   { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', border: 'rgba(220,38,38,0.25)',  label: 'Private'   },
    protected: { bg: 'rgba(234,179,8,0.10)',  color: '#ca8a04', border: 'rgba(234,179,8,0.30)',  label: 'Protected' },
    public:    { bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', border: 'rgba(22,163,74,0.25)',  label: 'Public'    },
  }
  const { bg, color, border, label } = map[s] ?? map.private
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border"
      style={{ background: bg, color, borderColor: border }}>
      {label}
    </span>
  )
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className="w-10 h-6 rounded-full relative transition-colors flex-shrink-0"
      style={{ background: checked ? 'var(--c-primary)' : 'var(--c-border-strong)' }}>
      <div className={`w-4 h-4 rounded-full bg-white absolute top-1 shadow-sm transition-transform
        ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </button>
  )
}

// ── Masked key ─────────────────────────────────────────────────────────────────

function MaskedKey({ value }: { value: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[12px] truncate max-w-[160px]" style={{ color: 'var(--c-t2)' }}>
        {show ? value : '••••••••••••'}
      </span>
      <button onClick={() => setShow(v => !v)} style={{ color: 'var(--c-t4)' }}
        className="flex-shrink-0 hover:opacity-70 transition">
        {show ? <EyeOff size={12} /> : <Eye size={12} />}
      </button>
    </div>
  )
}

// ── LLM Card ───────────────────────────────────────────────────────────────────

function LLMCard({
  config, onEdit, onDeleted, onAccessUpdated,
}: {
  config: LLMConfig
  onEdit: () => void
  onDeleted: (id: number) => void
  onAccessUpdated: (id: number, ac: AccessControlValue) => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [showAccess, setShowAccess] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_delete_llm_config', { p_id: config.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(config.id)
    } catch { /* ignore */ } finally {
      setDeleting(false); setConfirmDel(false)
    }
  }

  const scope = config.access_control?.scope ?? 'private'
  const isEmbed = config.data?.is_embed_model === true

  return (
    <>
      <div className="rounded-2xl border flex flex-col transition-shadow hover:shadow-md"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Card header */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-start gap-3">
            {/* Provider icon */}
            <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--c-primary-light)' }}>
              <Cpu size={20} style={{ color: 'var(--c-primary)' }} />
            </div>

            {/* Name only */}
            <div className="flex-1 min-w-0 pt-0.5">
              <h3 className="text-[14px] font-semibold leading-snug" style={{ color: 'var(--c-t1)' }}>
                {config.name}
              </h3>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5" style={{ height: 1, background: 'var(--c-border)' }} />

        {/* Details */}
        <div className="px-5 py-4 flex flex-col gap-2.5 flex-1">
          {[
            { label: 'Model',    value: <span className="font-mono text-[12px]" style={{ color: 'var(--c-t2)' }}>{config.model}</span> },
            { label: 'Endpoint', value: <span className="font-mono text-[12px] truncate max-w-[200px] block" style={{ color: 'var(--c-t2)' }}>{config.endpoint}</span> },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <span className="text-[12px] flex-shrink-0" style={{ color: 'var(--c-t4)' }}>{label}</span>
              <div className="min-w-0 text-right">{value}</div>
            </div>
          ))}
        </div>

        {/* Chips + actions footer */}
        <div className="mx-5" style={{ height: 1, background: 'var(--c-border)' }} />

        <div className="px-5 pt-3 pb-1 flex items-center gap-1.5 flex-wrap">
          <AccessBadge scope={scope} />
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
            style={{ background: 'var(--c-hover)', color: 'var(--c-t3)', borderColor: 'var(--c-border-strong)' }}>
            {config.provider}
          </span>
          {config.is_default && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border"
              style={{ background: 'rgba(234,179,8,0.10)', color: '#ca8a04', borderColor: 'rgba(234,179,8,0.3)' }}>
              <Star size={10} /> Default
            </span>
          )}
          {isEmbed && (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border"
              style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)', borderColor: 'rgba(220,38,38,0.2)' }}>
              Embed
            </span>
          )}
        </div>

        {/* Actions footer */}
        <div className="px-5 py-2 flex items-center justify-end gap-0.5">
          {confirmDel ? (
            <div className="flex items-center gap-2">
              <span className="text-[11px]" style={{ color: 'var(--c-t4)' }}>Delete?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[11px] font-medium rounded-lg transition">
                {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="px-2.5 py-1 rounded-lg text-[11px] transition hover:bg-[var(--c-hover)]"
                style={{ color: 'var(--c-t4)' }}>
                No
              </button>
            </div>
          ) : (
            <>
              <button onClick={() => setShowAccess(true)} title="Access Control"
                className="p-2 rounded-lg transition hover:bg-[var(--c-hover)]"
                style={{ color: 'var(--c-t4)' }}>
                <ShieldCheck size={16} />
              </button>
              <button onClick={onEdit} title="Edit"
                className="p-2 rounded-lg transition hover:bg-[var(--c-hover)]"
                style={{ color: 'var(--c-t4)' }}>
                <Pencil size={16} />
              </button>
              <button onClick={() => setConfirmDel(true)} title="Delete"
                className="p-2 rounded-lg transition hover:bg-red-500/10"
                style={{ color: 'var(--c-t4)' }}>
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {showAccess && (
        <AccessControl
          resourceName={config.name}
          recordId={config.id}
          routeName="llm_config"
          accessControl={config.access_control}
          onClose={() => setShowAccess(false)}
          onSaved={ac => { onAccessUpdated(config.id, ac); setShowAccess(false) }}
        />
      )}
    </>
  )
}

// ── Save Modal ─────────────────────────────────────────────────────────────────

function SaveLLMModal({
  config, onClose, onSaved,
}: {
  config: LLMConfig | null
  onClose: () => void
  onSaved: (c: LLMConfig) => void
}) {
  const isEdit = config !== null

  const [name,      setName]      = useState(config?.name ?? '')
  const [provider,  setProvider]  = useState(config?.provider ?? 'OpenAI')
  const [model,     setModel]     = useState(config?.model ?? 'gpt-4o-mini')
  const [apiKey,    setApiKey]    = useState(config?.api_key ?? '')
  const [endpoint,  setEndpoint]  = useState(config?.endpoint ?? PROVIDERS.OpenAI.defaultEndpoint)
  const [isDefault, setIsDefault] = useState(config?.is_default ?? false)
  const [isEmbed,   setIsEmbed]   = useState(config?.data?.is_embed_model ?? false)
  const [showKey,   setShowKey]   = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState<string | null>(null)

  const providerCfg = PROVIDERS[provider] ?? PROVIDERS.Custom
  const modelList   = providerCfg.models

  const onProviderChange = (p: string) => {
    setProvider(p)
    const cfg = PROVIDERS[p]
    if (cfg) {
      if (cfg.models.length > 0) setModel(cfg.models[0])
      if (cfg.defaultEndpoint) setEndpoint(cfg.defaultEndpoint)
    }
  }

  const inputCls  = `w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition`
  const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !provider || !model) return
    setSaving(true); setError(null)
    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_llm_config', {
        p_id:         isEdit ? config.id : null,
        p_name:       name.trim(),
        p_provider:   provider,
        p_model:      model,
        p_api_key:    apiKey,
        p_endpoint:   endpoint,
        p_is_default: isDefault,
        p_data:       { is_embed_model: isEmbed },
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: LLMConfig[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved({
        ...( isEdit ? config : {} as LLMConfig ),
        ...env.data[0],
        access_control: isEdit ? config.access_control : {},
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save LLM config')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border max-h-[90vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b sticky top-0 z-10"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Cpu size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit LLM Config' : 'Add LLM Config'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                {isEdit ? 'Update this LLM configuration.' : 'Add a new LLM provider configuration.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form id="llm-modal-form" onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Name */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>
              Name <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="e.g. OpenAI Chat Completion"
              className={inputCls} style={inputStyle} />
          </div>

          {/* Provider + Model side by side */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>
                Provider <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select value={provider} onChange={e => onProviderChange(e.target.value)}
                  className={`${inputCls} appearance-none cursor-pointer`} style={inputStyle}>
                  {PROVIDER_LIST.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--c-t4)' }}>
                  <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
                      strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>
                Model <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                {modelList.length > 0 ? (
                  <select value={model} onChange={e => setModel(e.target.value)}
                    className={`${inputCls} appearance-none cursor-pointer`} style={inputStyle}>
                    {modelList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                ) : (
                  <input value={model} onChange={e => setModel(e.target.value)}
                    placeholder="Model name" required
                    className={inputCls} style={inputStyle} />
                )}
                {modelList.length > 0 && (
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--c-t4)' }}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                      <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>
              API Key
            </label>
            <div className="relative">
              <input value={apiKey} onChange={e => setApiKey(e.target.value)}
                type={showKey ? 'text' : 'password'}
                placeholder="sk-..."
                className={`${inputCls} font-mono pr-10`} style={inputStyle} />
              <button type="button" onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-70"
                style={{ color: 'var(--c-t4)' }}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Endpoint */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>
              Endpoint
            </label>
            <input value={endpoint} onChange={e => setEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1"
              className={`${inputCls} font-mono`} style={inputStyle} />
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-2">
            {[
              {
                key: 'default',
                title: 'Set as default',
                desc: 'Use this LLM by default for new agents.',
                checked: isDefault,
                onChange: setIsDefault,
              },
              {
                key: 'embed',
                title: 'Embedding model',
                desc: 'Use this model for vector embeddings.',
                checked: isEmbed,
                onChange: setIsEmbed,
              },
            ].map(({ key, title, desc, checked, onChange }) => (
              <div key={key} className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-xl border"
                style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>{title}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>{desc}</p>
                </div>
                <Toggle checked={checked} onChange={onChange} />
              </div>
            ))}
          </div>

          {error && (
            <div className="text-[12px] rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {error}
            </div>
          )}

        </form>

        {/* Footer — frozen */}
        <div className="flex gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Cancel
          </button>
          <button type="submit" form="llm-modal-form" disabled={saving}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                       transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function LLMPage() {

  const [configs,    setConfigs]    = useState<LLMConfig[]>([])
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async (q?: string) => {
    setLoading(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_get_llm_configs', { p_search: q ?? null })
      if (error) throw error
      const env = data as { is_success: boolean; data: LLMConfig[] }
      if (env.is_success) setConfigs(env.data ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = search
    ? configs.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.provider.toLowerCase().includes(search.toLowerCase()) ||
        c.model.toLowerCase().includes(search.toLowerCase())
      )
    : configs

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ background: 'var(--c-base)' }}>

      {/* ── Page header ── */}
      <div className="px-6 py-5 border-b flex items-start justify-between gap-4 flex-shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            <Cpu size={20} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: 'var(--c-t1)' }}>
              LLM Configuration
            </h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
              Configure AI model providers and credentials.
            </p>
          </div>
        </div>
        <button onClick={() => openEdit('new')}
          className="flex items-center gap-2 px-4 py-2.5 btn-primary text-[13px] font-semibold rounded-xl transition flex-shrink-0">
          <Plus size={15} /> Add LLM
        </button>
      </div>

      {/* ── Search ── */}
      <div className="px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--c-t4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search || undefined)}
            placeholder="Search by name, provider or model..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-[12px] border focus:outline-none transition"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
          />
        </div>
      </div>

      {/* ── Card grid ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--c-hover)' }}>
              <Cpu size={24} style={{ color: 'var(--c-t5)' }} />
            </div>
            <div>
              <p className="text-[14px] font-medium" style={{ color: 'var(--c-t2)' }}>No LLM configs yet</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                Add your first LLM provider to get started.
              </p>
            </div>
            <button onClick={() => openEdit('new')}
              className="px-4 py-2 btn-primary text-[12px] font-medium rounded-xl transition">
              Add LLM
            </button>
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' }}>
            {filtered.map(c => (
              <LLMCard
                key={c.id}
                config={c}
                onEdit={() => openEdit(c.id)}
                onDeleted={id => setConfigs(prev => prev.filter(x => x.id !== id))}
                onAccessUpdated={(id, ac) =>
                  setConfigs(prev => prev.map(x =>
                    x.id === id ? { ...x, access_control: ac } : x
                  ))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Save modal ── */}
      {editId !== null && (
        <SaveLLMModal
          config={editId === 'new' ? null : configs.find(c => String(c.id) === editId) ?? null}
          onClose={closeEdit}
          onSaved={saved => {
            setConfigs(prev => {
              const exists = prev.find(x => x.id === saved.id)
              return exists
                ? prev.map(x => x.id === saved.id ? saved : x)
                : [saved, ...prev]
            })
            closeEdit()
          }}
        />
      )}
    </div>
  )
}
