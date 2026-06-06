'use client'
import { useAppStore } from '@/lib/store'
import type { ApiData, McpTool } from '@/lib/types'
import { HttpHelper } from '@/lib/http'
import clsx from 'clsx'
import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Zap, Play, ChevronDown, ChevronRight, RefreshCw, BookOpen, Database, Loader2, Search } from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

interface McpResource {
  id:           number
  uri:          string
  name:         string
  mime_type:    string | null
  description:  string | null
  text_content: string | null
  blob_content: string | null
}

interface McpPrompt {
  id:     number
  prompt: string
}

// ── Source-driven searchable dropdown ─────────────────────────────────────────

function SourceSelect({
  fieldKey, schema, value, onChange,
}: {
  fieldKey: string
  schema: { type: string; description: string; required?: boolean; source?: string }
  value: string
  onChange: (v: string) => void
}) {
  const [options,   setOptions]   = useState<{ id: string; label: string }[]>([])
  const [loading,   setLoading]   = useState(true)
  const [open,      setOpen]      = useState(false)
  const [query,     setQuery]     = useState('')
  const [dropRect,  setDropRect]  = useState<DOMRect | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const dropRef   = useRef<HTMLDivElement>(null)

  // Load options via the server-side proxy so the API key is never exposed in the browser
  useEffect(() => {
    if (!schema.source) { setLoading(false); return }
    setLoading(true)
    fetch('/api/mcp/call', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tool: schema.source, args: {} }),
    })
      .then(r => r.json())
      .then(res => {
        // Proxy unwraps MCP content blocks; response is the raw API payload
        let rows: { id: unknown; name?: string; title?: string }[] = []
        if (Array.isArray(res?.data?.data))    rows = res.data.data
        else if (Array.isArray(res?.data))     rows = res.data
        else if (Array.isArray(res?.content)) {
          for (const c of res.content) {
            if (c.type === 'text') {
              try { const p = JSON.parse(c.text); rows = p?.data ?? []; break } catch { /* ignore */ }
            }
          }
        }
        setOptions(rows.map(r => ({
          id:    String(r.id ?? ''),
          label: String(r.name ?? r.title ?? r.id ?? ''),
        })))
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [schema.source])

  const handleToggle = () => {
    if (!open && buttonRef.current) setDropRect(buttonRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) { setQuery(''); return }
    const h = (e: MouseEvent) => {
      if (buttonRef.current?.contains(e.target as Node)) return
      if (dropRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const filtered  = query ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())) : options
  const selected  = options.find(o => o.id === value)
  const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border text-[11px]" style={inputStyle}>
        <Loader2 size={11} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
        <span style={{ color: 'var(--c-t4)' }}>Loading {schema.source}…</span>
      </div>
    )
  }

  const dropdown = open && dropRect && typeof document !== 'undefined'
    ? createPortal(
        <div ref={dropRef}
          style={{
            position:    'fixed',
            top:         dropRect.bottom + 4,
            left:        dropRect.left,
            width:       dropRect.width,
            zIndex:      9999,
            background:  'var(--c-panel)',
            borderColor: 'var(--c-border)',
          }}
          className="rounded-xl border shadow-xl overflow-hidden">
          <div className="flex items-center gap-2 px-2 py-1.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <Search size={11} style={{ color: 'var(--c-t4)', flexShrink: 0 }} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search…" className="flex-1 text-[11px] bg-transparent outline-none"
              style={{ color: 'var(--c-t1)' }} />
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            {filtered.length === 0
              ? <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--c-t5)' }}>No results</p>
              : filtered.map(opt => (
                  <button key={opt.id} type="button"
                    onClick={() => { onChange(opt.id); setOpen(false) }}
                    className="w-full text-left px-3 py-1.5 text-[11px] transition"
                    style={{
                      background: opt.id === value ? 'var(--c-primary-light)' : 'transparent',
                      color:      opt.id === value ? 'var(--c-primary)'       : 'var(--c-t2)',
                    }}
                    onMouseEnter={e => { if (opt.id !== value) e.currentTarget.style.background = 'var(--c-hover)' }}
                    onMouseLeave={e => { if (opt.id !== value) e.currentTarget.style.background = 'transparent' }}>
                    {opt.label}
                    <span className="ml-1 text-[10px]" style={{ color: 'var(--c-t5)' }}>#{opt.id}</span>
                  </button>
                ))
            }
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <button ref={buttonRef} type="button" onClick={handleToggle}
        className="w-full flex items-center justify-between gap-1 px-2 py-1.5 rounded border text-[11px] text-left"
        style={inputStyle}>
        <span className="truncate" style={{ color: selected ? 'var(--c-t1)' : 'var(--c-t4)' }}>
          {selected ? `${selected.label} (${selected.id})` : schema.description}
        </span>
        <ChevronDown size={11} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--c-t4)' }} />
      </button>
      {dropdown}
    </>
  )
}

// ── Tool call builder ──────────────────────────────────────────────────────────

function McpCallBuilder({ tool }: { tool: McpTool }) {
  const { setResponse, setLoading, isLoading } = useAppStore()
  const [args, setArgs] = useState<Record<string, string>>({})
  const [expandSchema, setExpandSchema] = useState(false)

  const props = Object.entries(tool.inputSchema.properties)

  const coercedArgs = Object.fromEntries(
    props.map(([key, schema]) => [
      key,
      schema.type === 'number' && args[key] !== undefined && args[key] !== ''
        ? Number(args[key])
        : (args[key] ?? ''),
    ])
  )

  const payload = JSON.stringify({ tool: tool.name, args: coercedArgs }, null, 2)

  const callTool = async () => {
    setLoading(true)
    const t0 = Date.now()
    try {
      const res = await fetch('/api/mcp/call', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    payload,
      })
      const data = await res.json()
      setResponse(JSON.stringify(data, null, 2), res.status, Date.now() - t0)
    } catch (e: unknown) {
      setResponse(JSON.stringify({ error: (e as Error).message }, null, 2), 500, Date.now() - t0)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Fixed header: title + call button + description */}
      <div className="shrink-0 px-5 py-4 border-b" style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Zap size={13} className="text-blue-500 shrink-0" />
            {tool.title ? (
              <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>
                {tool.title}
                <span className="ml-1 font-normal text-[11px]" style={{ color: 'var(--c-t4)' }}>({tool.name})</span>
              </span>
            ) : (
              <span className="text-[13px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>{tool.name}</span>
            )}
          </div>
          <button onClick={callTool} disabled={isLoading}
            className="flex items-center gap-1.5 px-4 py-2 btn-primary disabled:opacity-50 text-white text-[12px] font-semibold rounded-lg transition-colors shrink-0">
            <Play size={11} />
            {isLoading ? 'Calling…' : `Call ${tool.name}`}
          </button>
        </div>
        {tool.description && (
          <p className="text-[12px] mt-2" style={{ color: 'var(--c-t3)' }}>{tool.description}</p>
        )}
      </div>

      {/* Scrollable arguments area */}
      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4">
        {/* Arguments — 2 per row */}
        {props.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider mb-3" style={{ color: 'var(--c-t4)' }}>Arguments</p>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4">
              {props.map(([key, schema]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-[11px] font-medium flex items-center gap-1" style={{ color: 'var(--c-t3)' }}>
                    {schema.title ? (
                      <>
                        {schema.title}
                        <span className="text-[10px] font-normal" style={{ color: 'var(--c-t5)' }}>({key})</span>
                      </>
                    ) : key}
                    {schema.required && <span className="text-red-500">*</span>}
                    <span className="text-[9px] ml-auto" style={{ color: 'var(--c-t5)' }}>{schema.type}</span>
                  </label>
                  {schema.source ? (
                    <SourceSelect
                      fieldKey={key}
                      schema={schema}
                      value={args[key] ?? ''}
                      onChange={v => setArgs(prev => ({ ...prev, [key]: v }))}
                    />
                  ) : (
                    <input
                      type={schema.type === 'number' ? 'number' : 'text'}
                      placeholder={schema.description}
                      value={args[key] ?? ''}
                      onChange={e => setArgs(prev => ({ ...prev, [key]: e.target.value }))}
                      className="rounded px-2.5 py-1.5 text-[11px] focus:outline-none border focus:border-blue-500/40"
                      style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw payload toggle */}
        <div>
          <button onClick={() => setExpandSchema(!expandSchema)}
            className="flex items-center gap-1 text-[10px] transition-colors hover:text-[var(--c-t2)]"
            style={{ color: 'var(--c-t4)' }}>
            {expandSchema ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            Raw Payload
          </button>
          {expandSchema && (
            <pre className="mt-1.5 rounded p-2 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto border"
              style={{ background: 'var(--c-code)', borderColor: 'var(--c-border)', color: 'var(--c-t3)' }}>
              {payload}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Resource detail ────────────────────────────────────────────────────────────

function ResourceDetail({ resource }: { resource: McpResource }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <Database size={13} className="text-purple-500 shrink-0" />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>{resource.name}</span>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--c-t5)' }}>URI</p>
        <p className="text-[12px] font-mono" style={{ color: 'var(--c-primary)' }}>{resource.uri}</p>
      </div>
      {resource.mime_type && (
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--c-t5)' }}>MIME Type</p>
          <p className="text-[12px]" style={{ color: 'var(--c-t3)' }}>{resource.mime_type}</p>
        </div>
      )}
      {resource.description && (
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: 'var(--c-t5)' }}>Description</p>
          <p className="text-[12px]" style={{ color: 'var(--c-t2)' }}>{resource.description}</p>
        </div>
      )}
      {resource.text_content && (
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-t5)' }}>Content</p>
          <pre className="rounded p-3 text-[10px] font-mono whitespace-pre-wrap overflow-x-auto border max-h-96"
            style={{ background: 'var(--c-code)', borderColor: 'var(--c-border)', color: 'var(--c-t2)' }}>
            {resource.text_content}
          </pre>
        </div>
      )}
    </div>
  )
}

// ── Prompt detail ──────────────────────────────────────────────────────────────

function PromptDetail({ prompt }: { prompt: McpPrompt }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-2">
        <BookOpen size={13} className="text-emerald-500 shrink-0" />
        <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>Prompt #{prompt.id}</span>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-t5)' }}>Text</p>
        <pre className="rounded p-3 text-[12px] whitespace-pre-wrap border leading-relaxed"
          style={{ background: 'var(--c-code)', borderColor: 'var(--c-border)', color: 'var(--c-t2)', fontFamily: 'inherit' }}>
          {prompt.prompt}
        </pre>
      </div>
    </div>
  )
}

// ── Right side only: call builder ──────────────────────────────────────────────

export function McpCallBuilderArea() {
  const { selectedMcpTool, mcpServerUrl } = useAppStore()
  if (!selectedMcpTool) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
        <Zap size={24} className="mb-2" style={{ color: 'var(--c-t5)' }} />
        <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Select a tool from the left panel</p>
        <p className="text-[11px] mt-1" style={{ color: 'var(--c-t5)' }}>Tools let AI models interact with your API</p>
      </div>
    )
  }
  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--c-panel)' }}>
      <McpCallBuilder tool={selectedMcpTool} />
    </div>
  )
}

// ── Main MCP panel ─────────────────────────────────────────────────────────────

type McpTab = 'tools' | 'resources' | 'prompts'

export function McpPanel({ data }: { data: ApiData }) {
  const { selectedMcpTool, setSelectedMcpTool, mcpConnected, mcpServerUrl, setMcpServerUrl, setMcpConnected } = useAppStore()

  const [activeSection,     setActiveSection]     = useState<McpTab>('tools')
  const [resources,         setResources]         = useState<McpResource[]>([])
  const [prompts,           setPrompts]           = useState<McpPrompt[]>([])
  const [selectedResource,  setSelectedResource]  = useState<McpResource | null>(null)
  const [selectedPrompt,    setSelectedPrompt]    = useState<McpPrompt | null>(null)
  const [loadingResources,  setLoadingResources]  = useState(false)
  const [loadingPrompts,    setLoadingPrompts]    = useState(false)

  useEffect(() => {
    setLoadingResources(true)
    HttpHelper.rpc('fn_get_mcp_resources').then(({ data: d }) => {
      const env = d as { is_success: boolean; data: McpResource[] }
      if (env?.is_success) setResources(env.data ?? [])
      setLoadingResources(false)
    })
  }, [])

  useEffect(() => {
    setLoadingPrompts(true)
    HttpHelper.rpc('fn_get_prompts').then(({ data: d }) => {
      const env = d as { is_success: boolean; data: McpPrompt[] }
      if (env?.is_success) setPrompts(env.data ?? [])
      setLoadingPrompts(false)
    })
  }, [])

  const sections: { id: McpTab; label: string }[] = [
    { id: 'tools',     label: 'Tools'     },
    { id: 'resources', label: 'Resources' },
    { id: 'prompts',   label: 'Prompts'   },
  ]

  // Right-panel content
  const renderRight = () => {
    if (activeSection === 'tools') {
      if (selectedMcpTool) return <McpCallBuilder tool={selectedMcpTool} />
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <Zap size={24} className="mb-2" style={{ color: 'var(--c-t5)' }} />
          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Select a tool to call it</p>
          <p className="text-[11px] mt-1" style={{ color: 'var(--c-t5)' }}>Tools let AI models interact with your API</p>
        </div>
      )
    }
    if (activeSection === 'resources') {
      if (selectedResource) return <ResourceDetail resource={selectedResource} />
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <Database size={24} className="mb-2" style={{ color: 'var(--c-t5)' }} />
          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Select a resource to view details</p>
        </div>
      )
    }
    if (activeSection === 'prompts') {
      if (selectedPrompt) return <PromptDetail prompt={selectedPrompt} />
      return (
        <div className="flex flex-col items-center justify-center h-full text-center px-6">
          <BookOpen size={24} className="mb-2" style={{ color: 'var(--c-t5)' }} />
          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Select a prompt to view it</p>
        </div>
      )
    }
  }

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left panel */}
      <div className="w-[210px] min-w-[210px] border-r flex flex-col"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Connection bar */}
        <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-1.5 mb-1.5">
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
          <input type="text" placeholder="MCP Server URL" value={mcpServerUrl}
            onChange={(e) => setMcpServerUrl(e.target.value)}
            className="w-full rounded px-2 py-1 text-[10px] focus:outline-none border focus:border-blue-500/40"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }} />
          <button onClick={() => setMcpConnected(!mcpConnected)}
            className={clsx('w-full mt-1.5 py-1 rounded text-[10px] font-medium transition-colors',
              mcpConnected ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'btn-primary')}>
            {mcpConnected ? 'Disconnect' : 'Connect'}
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex border-b" style={{ borderColor: 'var(--c-border)' }}>
          {sections.map((s) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={clsx('flex-1 py-1.5 text-[10px] border-b-2 transition-colors',
                activeSection === s.id ? 'border-blue-500 text-blue-500' : 'border-transparent hover:text-[var(--c-t2)]'
              )}
              style={activeSection !== s.id ? { color: 'var(--c-t4)' } : undefined}>
              {s.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">

          {/* Tools */}
          {activeSection === 'tools' && data.mcpTools.map((tool, i) => (
            <button key={tool.id}
              onClick={() => setSelectedMcpTool(selectedMcpTool?.id === tool.id ? null : tool)}
              className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-colors hover:bg-[var(--c-hover)]"
              style={{ background: selectedMcpTool?.id === tool.id ? 'var(--c-active)' : undefined }}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <div>
                <div className="text-[11px] font-medium" style={{ color: 'var(--c-t2)' }}>{i + 1}. {tool.name}</div>
                <div className="text-[10px] leading-snug" style={{ color: 'var(--c-t4)' }}>{tool.description}</div>
              </div>
            </button>
          ))}

          {/* Resources */}
          {activeSection === 'resources' && (
            loadingResources ? (
              <div className="flex items-center gap-2 px-2 py-3" style={{ color: 'var(--c-t5)' }}>
                <Loader2 size={11} className="animate-spin" /> Loading…
              </div>
            ) : resources.length === 0 ? (
              <p className="text-[11px] px-1 py-2" style={{ color: 'var(--c-t5)' }}>No resources found</p>
            ) : (
              resources.map(r => (
                <button key={r.id}
                  onClick={() => setSelectedResource(selectedResource?.id === r.id ? null : r)}
                  className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-colors hover:bg-[var(--c-hover)]"
                  style={{ background: selectedResource?.id === r.id ? 'var(--c-active)' : undefined }}>
                  <Database size={10} className="text-purple-500 mt-0.5 shrink-0" />
                  <div>
                    <div className="text-[11px] font-medium" style={{ color: 'var(--c-t2)' }}>{r.name}</div>
                    <div className="text-[10px] leading-snug font-mono" style={{ color: 'var(--c-t5)' }}>{r.uri}</div>
                  </div>
                </button>
              ))
            )
          )}

          {/* Prompts */}
          {activeSection === 'prompts' && (
            loadingPrompts ? (
              <div className="flex items-center gap-2 px-2 py-3" style={{ color: 'var(--c-t5)' }}>
                <Loader2 size={11} className="animate-spin" /> Loading…
              </div>
            ) : prompts.length === 0 ? (
              <p className="text-[11px] px-1 py-2" style={{ color: 'var(--c-t5)' }}>No prompts found</p>
            ) : (
              prompts.map(p => (
                <button key={p.id}
                  onClick={() => setSelectedPrompt(selectedPrompt?.id === p.id ? null : p)}
                  className="w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left transition-colors hover:bg-[var(--c-hover)]"
                  style={{ background: selectedPrompt?.id === p.id ? 'var(--c-active)' : undefined }}>
                  <BookOpen size={10} className="text-emerald-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] line-clamp-2 text-left" style={{ color: 'var(--c-t2)' }}>{p.prompt}</p>
                </button>
              ))
            )
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--c-panel)' }}>
        {renderRight()}
      </div>
    </div>
  )
}
