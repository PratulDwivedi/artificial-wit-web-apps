'use client'
import { useAppStore } from '@/lib/store'
import type { Endpoint } from '@/lib/types'
import { useState, useEffect, useMemo } from 'react'
import { HttpHelper } from '@/lib/http'
import { ShieldCheck, KeyRound, User, Globe, Loader2 } from 'lucide-react'
import clsx from 'clsx'

// Docs, Params tabs removed; Form/Raw body sub-tabs removed
const tabs = [
  { id: 'body',    label: 'Body'    },
  { id: 'headers', label: 'Headers' },
  { id: 'auth',    label: 'Auth'    },
] as const

function TabButton({ id, label, active, count }: { id: string; label: string; active: boolean; count?: number }) {
  const { setActiveTab } = useAppStore()
  return (
    <button
      onClick={() => setActiveTab(id as any)}
      className={clsx('px-3 py-1.5 text-[11px] border-b-2 transition-colors whitespace-nowrap',
        active ? 'border-blue-500 text-blue-500' : 'border-transparent hover:text-[var(--c-t2)]'
      )}
      style={!active ? { color: 'var(--c-t4)' } : undefined}
    >
      {label}
      {count != null && count > 0 && (
        <span className="ml-1 rounded px-1 text-[9px]"
          style={{ background: 'var(--c-active)', color: 'var(--c-t3)' }}>
          {count}
        </span>
      )}
    </button>
  )
}

function ParamsTable({ endpoint }: { endpoint: Endpoint }) {
  const params = endpoint.request.params ?? []
  if (params.length === 0) {
    return (
      <div className="px-4 py-3">
        <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>No query parameters defined</p>
        <button className="mt-2 text-[11px] text-blue-500 hover:text-blue-400">+ Add parameter</button>
      </div>
    )
  }
  return (
    <div className="px-4 py-2">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b" style={{ color: 'var(--c-t4)', borderColor: 'var(--c-border)' }}>
            <th className="text-left py-1.5 font-normal w-4"><input type="checkbox" className="w-3 h-3" /></th>
            <th className="text-left py-1.5 font-normal">Name</th>
            <th className="text-left py-1.5 font-normal">Type</th>
            <th className="text-left py-1.5 font-normal">Example</th>
            <th className="text-left py-1.5 font-normal">Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className="border-b transition-colors hover:bg-[var(--c-hover)]" style={{ borderColor: 'var(--c-border)' }}>
              <td className="py-1.5"><input type="checkbox" defaultChecked className="w-3 h-3" /></td>
              <td className="py-1.5">
                <span style={{ color: 'var(--c-t1)' }}>{p.name}</span>
                {p.required && <span className="text-red-500 ml-0.5">*</span>}
              </td>
              <td className="py-1.5" style={{ color: 'var(--c-t4)' }}>{p.type}</td>
              <td className="py-1.5">
                <input type="text" defaultValue={p.value}
                  className="bg-transparent border-b focus:border-blue-500/50 outline-none w-full min-w-[80px]"
                  style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }} />
              </td>
              <td className="py-1.5" style={{ color: 'var(--c-t4)' }}>{p.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="mt-2 text-[11px] text-blue-500 hover:text-blue-400">+ Add parameter</button>
    </div>
  )
}

function HeadersTable({ endpoint }: { endpoint: Endpoint }) {
  const headers = endpoint.request.headers ?? []
  return (
    <div className="px-4 py-2">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b" style={{ color: 'var(--c-t4)', borderColor: 'var(--c-border)' }}>
            <th className="text-left py-1.5 font-normal w-4"></th>
            <th className="text-left py-1.5 font-normal">Name</th>
            <th className="text-left py-1.5 font-normal">Value</th>
          </tr>
        </thead>
        <tbody>
          {headers.map((h, i) => (
            <tr key={i} className="border-b" style={{ borderColor: 'var(--c-border)' }}>
              <td className="py-1.5"><input type="checkbox" defaultChecked={h.enabled} className="w-3 h-3" /></td>
              <td className="py-1.5" style={{ color: 'var(--c-t2)' }}>{h.name}</td>
              <td className="py-1.5 font-mono text-[10px]" style={{ color: 'var(--c-t3)' }}>{h.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Body — JSON only (Form and Raw removed)
function BodyEditor({ endpoint }: { endpoint: Endpoint }) {
  const { requestBody, setRequestBody } = useAppStore()
  const body = endpoint.request.body
  if (!body || body.type === 'none') {
    return <div className="px-4 py-3 text-[11px]" style={{ color: 'var(--c-t4)' }}>No body for this request type</div>
  }
  return (
    <div className="px-4 py-2 flex flex-col gap-2">
      <textarea
        value={requestBody || body.content}
        onChange={(e) => setRequestBody(e.target.value)}
        spellCheck={false}
        className="rounded p-3 text-[11px] font-mono resize-none h-40 focus:outline-none border focus:border-blue-500/40"
        style={{ background: 'var(--c-code)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}
      />
    </div>
  )
}

// Auth type display helpers
const AUTH_ICON: Record<string, React.ElementType> = {
  bearer:  KeyRound,
  basic:   User,
  api_key: ShieldCheck,
  none:    Globe,
}
const AUTH_LABEL: Record<string, string> = {
  bearer:  'Bearer Token',
  basic:   'Basic Auth',
  api_key: 'API Key',
  none:    'No Auth',
}

interface ApiConfigAuth {
  api_auth_name: string | null
  api_auth_type: string | null
  api_auth_id:   number | null
  name:          string
  url:           string
}

function AuthView({ endpoint }: { endpoint: Endpoint }) {
  const [config,  setConfig]  = useState<ApiConfigAuth | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    HttpHelper.rpc('fn_get_api_configs', { p_id: null, p_search: null }).then(({ data }) => {
      const env = data as { is_success: boolean; data: ApiConfigAuth[] }
      if (env?.is_success) {
        const match = (env.data ?? []).find(c =>
          c.url && (
            c.url.endsWith(endpoint.path) ||
            c.url.includes(endpoint.path) ||
            c.name.toLowerCase() === endpoint.name.toLowerCase()
          )
        )
        setConfig(match ?? null)
      }
      setLoading(false)
    })
  }, [endpoint.path, endpoint.name ])

  if (loading) {
    return (
      <div className="px-4 py-4 flex items-center gap-2" style={{ color: 'var(--c-t5)' }}>
        <Loader2 size={13} className="animate-spin" /> Loading auth config…
      </div>
    )
  }

  if (!config) {
    return (
      <div className="px-4 py-3 text-[11px]" style={{ color: 'var(--c-t4)' }}>
        No API config found for this endpoint.
      </div>
    )
  }

  const authType  = config.api_auth_type ?? 'none'
  const AuthIcon  = AUTH_ICON[authType]  ?? Globe
  const authLabel = AUTH_LABEL[authType] ?? authType

  return (
    <div className="px-4 py-3 flex flex-col gap-3">
      {/* API Config name */}
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-t5)' }}>API Config</p>
        <p className="text-[12px] font-mono font-semibold" style={{ color: 'var(--c-primary)' }}>{config.name}</p>
      </div>

      {/* Auth type */}
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-t5)' }}>Auth Type</p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border w-fit"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}>
          <AuthIcon size={13} style={{ color: 'var(--c-primary)' }} />
          <span className="text-[12px] font-medium" style={{ color: 'var(--c-t2)' }}>{authLabel}</span>
        </div>
      </div>

      {/* Credential name (if linked) */}
      {config.api_auth_name && (
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: 'var(--c-t5)' }}>Credential</p>
          <p className="text-[12px]" style={{ color: 'var(--c-t2)' }}>{config.api_auth_name}</p>
        </div>
      )}

      {authType === 'none' && !config.api_auth_name && (
        <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>No authentication configured for this API.</p>
      )}
    </div>
  )
}

export function RequestPanel() {
  const { selectedEndpoint, activeTab } = useAppStore()
  if (!selectedEndpoint) return null

  const ep = selectedEndpoint
  const headerCount = ep.request.headers?.length ?? 0

  return (
    <div className="flex flex-col border-b" style={{ borderColor: 'var(--c-border)' }}>
      <div className="flex items-center gap-0 border-b px-2"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
        {tabs.map((t) => (
          <TabButton
            key={t.id}
            id={t.id}
            label={t.label}
            active={activeTab === t.id}
            count={t.id === 'headers' ? headerCount : undefined}
          />
        ))}
      </div>
      <div style={{ background: 'var(--c-panel)' }}>
        {activeTab === 'headers' && <HeadersTable endpoint={ep} />}
        {activeTab === 'body'    && <BodyEditor   endpoint={ep} />}
        {activeTab === 'auth'    && <AuthView     endpoint={ep} />}
      </div>
    </div>
  )
}
