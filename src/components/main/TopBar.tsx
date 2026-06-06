'use client'
import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/lib/store'
import { MethodBadge } from '@/components/ui/MethodBadge'
import { ChevronDown, Plus, Pencil, Loader2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import {
  ApiConfigSaveModal,
  type ApiConfig,
} from '@/components/api-configs/ApiConfigsPage'

export function TopBar() {
  const {
    selectedEndpoint, requestBody,
    setLoading, setResponse, isLoading,
  } = useAppStore()

  const [modalConfig,   setModalConfig]   = useState<ApiConfig | null | 'new'>(null)
  const [sourceOptions, setSourceOptions] = useState<{ value: string; label: string }[]>([])

  // Load source options when modal opens
  useEffect(() => {
    if (modalConfig === null) return
    HttpHelper.rpc('fn_get_api_configs', { p_id: null, p_search: null }).then(({ data }) => {
      const env = data as { is_success: boolean; data: ApiConfig[] }
      if (env?.is_success)
        setSourceOptions((env.data ?? []).map(c => ({ value: String(c.id), label: c.name })))
    })
  }, [modalConfig ])

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!selectedEndpoint || isLoading) return

    setLoading(true)
    setResponse(null, null, null, null)

    try {
      // Find matching API config for base URL
      const { data: cfgData } = await HttpHelper.rpc('fn_get_api_configs', { p_id: null, p_search: null })
      const cfgEnv = cfgData as { is_success: boolean; data: ApiConfig[] }
      const configs = cfgEnv?.is_success ? (cfgEnv.data ?? []) : []

      const matchedConfig = configs.find(c =>
        c.url && (
          c.url.endsWith(selectedEndpoint.path) ||
          c.url.includes(selectedEndpoint.path) ||
          c.name.toLowerCase() === selectedEndpoint.name.toLowerCase()
        )
      )

      // Build full URL
      const base = (process.env.NEXT_PUBLIC_AW_API_BASE_URL ?? '').replace(/\/$/, '')
      const url  = matchedConfig?.url ?? `${base}${selectedEndpoint.path}`

      // Merge headers from endpoint + api config
      const endpointHeaders: Record<string, string> = {}
      ;(selectedEndpoint.request.headers ?? []).forEach(h => {
        if (h.enabled !== false) endpointHeaders[h.name] = h.value
      })
      if (matchedConfig?.headers) {
        Object.entries(matchedConfig.headers).forEach(([k, v]) => { endpointHeaders[k] = v })
      }

      const res = await fetch('/api/rest/call', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          url,
          method:  selectedEndpoint.method,
          headers: endpointHeaders,
          body:    requestBody || undefined,
        }),
      })

      const result = await res.json() as {
        success: boolean
        data:    string
        status:  number
        time:    number
        headers: Record<string, string>
        error?:  string
      }

      if (result.success) {
        setResponse(result.data, result.status, result.time, result.headers)
      } else {
        setResponse(result.error ?? 'Request failed', res.status, null, null)
      }
    } catch (err) {
      setResponse((err as Error).message, 0, null, null)
    } finally {
      setLoading(false)
    }
  }

  // ── Edit ────────────────────────────────────────────────────────────────────
  const openAdd = () => setModalConfig('new')

  const openEdit = async () => {
    if (!selectedEndpoint) return
    const { data } = await HttpHelper.rpc('fn_get_api_configs', { p_id: null, p_search: null })
    const env = data as { is_success: boolean; data: ApiConfig[] }
    if (!env?.is_success) return
    const configs = env.data ?? []
    const match = configs.find(c =>
      c.url && (
        c.url.endsWith(selectedEndpoint.path) ||
        c.url.includes(selectedEndpoint.path) ||
        c.name.toLowerCase() === selectedEndpoint.name.toLowerCase()
      )
    )
    setModalConfig(match ?? configs[0] ?? 'new')
  }

  const canEdit = selectedEndpoint !== null

  return (
    <>
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}
      >
        {/* Method selector */}
        {selectedEndpoint && (
          <div
            className="flex items-center gap-0.5 rounded px-2 py-[5px] shrink-0 border"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}
          >
            <MethodBadge method={selectedEndpoint.method} />
            {selectedEndpoint.method !== 'MCP' && (
              <ChevronDown size={10} className="ml-0.5" style={{ color: 'var(--c-t4)' }} />
            )}
          </div>
        )}

        {/* URL bar */}
        <div
          className="flex-1 flex items-center rounded px-2 py-[5px] gap-1 min-w-0 border"
          style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}
        >
          <span className="text-[10px] truncate" style={{ color: 'var(--c-t2)' }}>
            {selectedEndpoint ? selectedEndpoint.path : '/'}
          </span>
        </div>

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!selectedEndpoint || isLoading}
          className="px-3 py-[5px] btn-primary text-white text-[11px] font-medium rounded shrink-0 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {isLoading && <Loader2 size={10} className="animate-spin" />}
          Send
        </button>

        {/* Add API Config */}
        <button
          onClick={openAdd}
          title="Add API Config"
          className="flex items-center gap-1 px-2 py-[5px] rounded border text-[10px] shrink-0 transition-colors hover:bg-[var(--c-active)]"
          style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
        >
          <Plus size={12} />
          <span>Add</span>
        </button>

        {/* Edit API Config */}
        <button
          onClick={openEdit}
          disabled={!canEdit}
          title={canEdit ? `Edit config for ${selectedEndpoint?.name}` : 'Select an endpoint first'}
          className="flex items-center gap-1 px-2 py-[5px] rounded border text-[10px] shrink-0 transition-colors"
          style={{
            borderColor: 'var(--c-border-strong)',
            background:  canEdit ? 'var(--c-hover)' : 'transparent',
            color:       canEdit ? 'var(--c-t3)'    : 'var(--c-t5)',
            cursor:      canEdit ? 'pointer'         : 'not-allowed',
            opacity:     canEdit ? 1                 : 0.45,
          }}
          onMouseEnter={e => { if (canEdit) e.currentTarget.style.background = 'var(--c-active)' }}
          onMouseLeave={e => { if (canEdit) e.currentTarget.style.background = canEdit ? 'var(--c-hover)' : 'transparent' }}
        >
          <Pencil size={11} />
          <span>Edit</span>
        </button>
      </div>

      {modalConfig !== null && (
        <ApiConfigSaveModal
          config={modalConfig === 'new' ? null : modalConfig}
          sourceOptions={sourceOptions}
          onClose={() => setModalConfig(null)}
          onSaved={() => setModalConfig(null)}
        />
      )}
    </>
  )
}
