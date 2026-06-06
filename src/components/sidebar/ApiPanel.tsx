'use client'

import { useState, useEffect, useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import type { Endpoint, HttpMethod, McpTool } from '@/lib/types'
import { MethodBadge } from '@/components/ui/MethodBadge'
import {
  Search, ChevronDown, ChevronRight, Loader2, Zap, BarChart2,
  RefreshCw, Database, BookOpen,
} from 'lucide-react'
import clsx from 'clsx'

// ── Local type (minimal shape from fn_get_api_configs) ─────────────────────────

interface ApiConfig {
  id: number
  name: string
  api_type: 'analytics' | 'action'
  url: string
  method: string
  headers: Record<string, string>
  body: { name: string; type: string; required: boolean; title?: string; description: string; source?: string }[]
  data: { description?: string; title?: string }
  data_field_path: string
}

// ── Converters ─────────────────────────────────────────────────────────────────

function toEndpoint(c: ApiConfig): Endpoint {
  const bodyObj =
    Array.isArray(c.body) && c.body.length > 0
      ? Object.fromEntries(c.body.map(f => [f.name, f.type === 'number' ? 0 : f.type === 'boolean' ? false : '']))
      : null

  return {
    id: String(c.id),
    name: c.name,
    method: c.method as HttpMethod,
    path: c.url,
    description: c.data?.description ?? '',
    tags: [c.api_type],
    mcpTool: c.name,
    request: {
      headers: Object.entries(c.headers ?? {}).map(([name, value]) => ({ name, value, enabled: true })),
      params: [],
      body: bodyObj ? { type: 'json', content: JSON.stringify(bodyObj, null, 2) } : undefined,
    },
    responses: {},
  }
}

function toMcpTool(c: ApiConfig): McpTool {
  return {
    id: String(c.id),
    name: c.name,
    title: c.data?.title ?? '',
    description: c.data?.description ?? '',
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        (c.body ?? []).map(f => [f.name, { type: f.type, title: f.title, description: f.description, required: f.required, source: f.source }])
      ),
    },
  }
}

// ── REST/MCP view toggle — always visible ──────────────────────────────────────

function ViewToggle() {
  const { viewMode, setViewMode } = useAppStore()
  return (
    <div className="flex items-center gap-0.5 rounded p-0.5 border shrink-0"
      style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
      <button
        onClick={() => setViewMode('rest')}
        className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
        style={{ background: viewMode === 'rest' ? 'var(--c-active)' : undefined, color: viewMode === 'rest' ? 'var(--c-t1)' : 'var(--c-t4)' }}>
        REST
      </button>
      <button
        onClick={() => setViewMode('mcp')}
        className="px-2 py-0.5 rounded text-[10px] font-medium transition-colors"
        style={viewMode === 'mcp' ? { background: 'var(--c-primary-light)', color: 'var(--c-primary)' } : { color: 'var(--c-t4)' }}>
        MCP
      </button>
    </div>
  )
}

// ── REST: single endpoint row ──────────────────────────────────────────────────

function ApiRow({ config }: { config: ApiConfig }) {
  const { selectedEndpoint, setSelectedEndpoint } = useAppStore()
  const isSelected = selectedEndpoint?.id === String(config.id)

  return (
    <button
      onClick={() => setSelectedEndpoint(toEndpoint(config))}
      className="w-full flex items-center gap-1.5 px-3 py-[5px] text-left rounded-sm transition-colors"
      style={{ background: isSelected ? 'var(--c-active)' : undefined }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '' }}
    >
      <MethodBadge method={config.method} size="xs" />
      <span className="text-[11px] font-mono truncate"
        style={{ color: isSelected ? 'var(--c-t1)' : 'var(--c-t3)' }}>
        {config.name}
      </span>
    </button>
  )
}

// ── REST: collapsible group ────────────────────────────────────────────────────

function ApiGroup({ label, Icon, configs }: {
  label: string
  Icon: React.ElementType
  configs: ApiConfig[]
}) {
  const [open, setOpen] = useState(true)
  if (configs.length === 0) return null
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-1.5 px-2 py-[5px] rounded-sm text-left transition-colors hover:bg-[var(--c-hover)]">
        {open
          ? <ChevronDown size={10} className="shrink-0" style={{ color: 'var(--c-t4)' }} />
          : <ChevronRight size={10} className="shrink-0" style={{ color: 'var(--c-t4)' }} />}
        <Icon size={11} className="shrink-0" style={{ color: 'var(--c-t4)' }} />
        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--c-t2)' }}>{label}</span>
        <span className="ml-auto text-[10px] shrink-0" style={{ color: 'var(--c-t5)' }}>{configs.length}</span>
      </button>
      {open && (
        <div className="ml-3">
          {configs.map(c => <ApiRow key={c.id} config={c} />)}
        </div>
      )}
    </div>
  )
}

// ── MCP: connection panel + tool list ─────────────────────────────────────────

type McpTab = 'tools' | 'resources' | 'prompts'

interface McpResource { id: number; uri: string; name: string; description?: string | null }
interface McpPrompt   { id: number; prompt: string }

function McpSidePanel({ configs }: { configs: ApiConfig[] }) {
  const {
    mcpConnected, setMcpConnected, mcpServerUrl, setMcpServerUrl,
    selectedMcpTool, setSelectedMcpTool,
  } = useAppStore()
  const [activeTab, setActiveTab] = useState<McpTab>('tools')

  const [resources,        setResources]        = useState<McpResource[]>([])
  const [prompts,          setPrompts]          = useState<McpPrompt[]>([])
  const [loadingResources, setLoadingResources] = useState(false)
  const [loadingPrompts,   setLoadingPrompts]   = useState(false)

  useEffect(() => {
    setLoadingResources(true)
    HttpHelper.rpc('fn_get_mcp_resources').then(({ data }) => {
      const env = data as { is_success: boolean; data: McpResource[] }
      if (env?.is_success) setResources(env.data ?? [])
      setLoadingResources(false)
    })
  }, [])

  useEffect(() => {
    setLoadingPrompts(true)
    HttpHelper.rpc('fn_get_prompts').then(({ data }) => {
      const env = data as { is_success: boolean; data: McpPrompt[] }
      if (env?.is_success) setPrompts(env.data ?? [])
      setLoadingPrompts(false)
    })
  }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Connection */}
      <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <div className={clsx('w-1.5 h-1.5 rounded-full', mcpConnected ? 'bg-emerald-500' : 'bg-gray-500')} />
          <span className="text-[10px]" style={{ color: 'var(--c-t3)' }}>
            {mcpConnected ? 'Connected' : 'Disconnected'}
          </span>
          {mcpConnected && (
            <button className="ml-auto transition-colors hover:text-[var(--c-t2)]" style={{ color: 'var(--c-t4)' }}>
              <RefreshCw size={10} />
            </button>
          )}
        </div>
        <input
          type="text"
          value={mcpServerUrl}
          onChange={e => setMcpServerUrl(e.target.value)}
          placeholder="MCP Server URL"
          className="w-full rounded px-2 py-1.5 text-[10px] focus:outline-none border mb-1.5"
          style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}
        />
        <button
          onClick={() => setMcpConnected(!mcpConnected)}
          className={clsx(
            'w-full py-1.5 rounded text-[11px] font-medium transition-colors',
            mcpConnected ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'btn-primary text-white'
          )}
        >
          {mcpConnected ? 'Disconnect' : 'Connect'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: 'var(--c-border)' }}>
        {(['tools', 'resources', 'prompts'] as McpTab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={clsx(
              'flex-1 py-1.5 text-[10px] border-b-2 transition-colors capitalize',
              activeTab === tab ? 'border-blue-500 text-blue-500' : 'border-transparent hover:text-[var(--c-t2)]'
            )}
            style={activeTab !== tab ? { color: 'var(--c-t4)' } : undefined}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {activeTab === 'tools' ? (
          configs.length === 0 ? (
            <p className="text-[11px] px-1 py-2" style={{ color: 'var(--c-t5)' }}>No tools configured.</p>
          ) : (
            configs.map((c, i) => {
              const isSelected = selectedMcpTool?.id === String(c.id)
              return (
                <button key={c.id}
                  onClick={() => setSelectedMcpTool(isSelected ? null : toMcpTool(c))}
                  className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-colors hover:bg-[var(--c-hover)]"
                  style={{ background: isSelected ? 'var(--c-active)' : undefined }}>
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium" style={{ color: 'var(--c-t2)' }}>
                      {i + 1}. {c.name}
                    </div>
                    {c.data?.description && (
                      <div className="text-[10px] leading-snug" style={{ color: 'var(--c-t4)' }}>
                        {c.data.description}
                      </div>
                    )}
                  </div>
                </button>
              )
            })
          )
        ) : activeTab === 'resources' ? (
          loadingResources ? (
            <div className="flex items-center gap-2 px-1 py-3" style={{ color: 'var(--c-t5)' }}>
              <Loader2 size={11} className="animate-spin" /><span className="text-[11px]">Loading…</span>
            </div>
          ) : resources.length === 0 ? (
            <p className="text-[11px] px-1 py-2" style={{ color: 'var(--c-t5)' }}>No resources found.</p>
          ) : (
            resources.map(r => (
              <button key={r.id}
                className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-colors hover:bg-[var(--c-hover)]">
                <Database size={10} className="text-purple-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-[11px] font-medium truncate" style={{ color: 'var(--c-t2)' }}>{r.name}</div>
                  <div className="text-[10px] font-mono truncate" style={{ color: 'var(--c-t5)' }}>{r.uri}</div>
                </div>
              </button>
            ))
          )
        ) : (
          loadingPrompts ? (
            <div className="flex items-center gap-2 px-1 py-3" style={{ color: 'var(--c-t5)' }}>
              <Loader2 size={11} className="animate-spin" /><span className="text-[11px]">Loading…</span>
            </div>
          ) : prompts.length === 0 ? (
            <p className="text-[11px] px-1 py-2" style={{ color: 'var(--c-t5)' }}>No prompts found.</p>
          ) : (
            prompts.map(p => (
              <button key={p.id}
                className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-colors hover:bg-[var(--c-hover)]">
                <BookOpen size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                <p className="text-[11px] line-clamp-2 text-left" style={{ color: 'var(--c-t2)' }}>{p.prompt}</p>
              </button>
            ))
          )
        )}
      </div>
    </div>
  )
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export function ApiPanel() {
  const { viewMode } = useAppStore()
  const pathname = usePathname()
  const isToolTest = pathname === '/tool-test'

  const [configs, setConfigs] = useState<ApiConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')

  useEffect(() => {
    if (!isToolTest) return
    setLoading(true)
    ;(async () => {
      try {
        const { data } = await HttpHelper.rpc('fn_get_api_configs', { p_id: null, p_search: null })
        const env = data as { is_success: boolean; data: ApiConfig[] }
        if (env?.is_success) setConfigs(env.data ?? [])
      } catch { /* ignore */ } finally {
        setLoading(false)
      }
    })()
  }, [isToolTest ])

  if (!isToolTest) return null

  const filtered = search
    ? configs.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : configs

  const analytics = filtered.filter(c => c.api_type === 'analytics')
  const actions   = filtered.filter(c => c.api_type === 'action')

  return (
    <aside className="flex flex-col w-[220px] min-w-[220px] border-r h-full"
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

      {/* Header — always visible */}
      <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-2 mb-2">
          <ViewToggle />
        
          {configs.length > 0 && (
            <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded shrink-0"
              style={{ background: 'var(--c-hover)', color: 'var(--c-t5)' }}>
              {configs.length}
            </span>
          )}
        </div>

        {/* Search only in REST mode */}
        {viewMode === 'rest' && (
          <div className="relative">
            <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t4)' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search tools..."
              className="w-full rounded text-[11px] pl-6 pr-2 py-1 focus:outline-none border"
              style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }} />
          </div>
        )}
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={14} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
        </div>
      ) : viewMode === 'mcp' ? (
        <McpSidePanel configs={configs} />
      ) : (
        <div className="flex-1 overflow-y-auto py-1 px-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-[11px]" style={{ color: 'var(--c-t5)' }}>
              {search ? 'No tools match.' : 'No tools configured.'}
            </p>
          ) : (
            <>
              <ApiGroup label="Analytics" Icon={BarChart2} configs={analytics} />
              <ApiGroup label="Actions"   Icon={Zap}        configs={actions}   />
            </>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-3 py-2 shrink-0" style={{ borderColor: 'var(--c-border)' }}>
        <p className="text-[9px]" style={{ color: 'var(--c-t5)' }}>Artificial Wit MCP Tools</p>
      </div>
    </aside>
  )
}
