'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Search, Plus, Pencil, Trash2, ShieldCheck, Loader2, X, Bot,
  Cpu, GitFork, RefreshCw, Layers, ChevronDown, ChevronRight,
} from 'lucide-react'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import SearchableSelect from '@/components/common/SearchableSelect'
import { useEditParam } from '@/lib/useEditParam'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Agent {
  id: number
  name: string
  description: string | null
  system_prompt: string | null
  llm_config_id: number | null
  tool_ids: number[]
  kb_ids: number[]
  avatar: string | null
  agent_type: 'llm' | 'sequential' | 'parallel' | 'loop' | 'custom'
  max_iterations: number
  is_active: boolean
  access_control: { scope?: string; roles?: number[] }
  created_at: string
  updated_at: string | null
  llm: { id: number; name: string; model: string } | null
}

interface LLMConfig {
  id: number
  name: string
  model: string
  provider: string
  is_default: boolean
}

interface Tool {
  id: number
  name: string
  api_type: string
  method: string
  url: string
}

interface KBNode {
  id: number
  name: string
  parent_id: number | null
  children?: KBNode[]
}

// ── Agent type config ──────────────────────────────────────────────────────────

const AGENT_TYPES: {
  value: Agent['agent_type']
  label: string
  desc: string
  icon: React.ElementType
}[] = [
  { value: 'llm',        label: 'LLM Agent',  desc: 'Single LLM with tools & knowledge', icon: Cpu      },
  { value: 'sequential', label: 'Sequential',  desc: 'Run sub-agents one after another',  icon: Layers   },
  { value: 'parallel',   label: 'Parallel',    desc: 'Run sub-agents concurrently',       icon: GitFork  },
  { value: 'loop',       label: 'Loop',        desc: 'Repeat sub-agents until condition', icon: RefreshCw },
]

// ── KB tree builder ────────────────────────────────────────────────────────────

function buildKbTree(nodes: KBNode[]): KBNode[] {
  const map = new Map<number, KBNode>()
  const roots: KBNode[] = []
  nodes.forEach(n => map.set(n.id, { ...n, children: [] }))
  nodes.forEach(n => {
    if (n.parent_id == null) roots.push(map.get(n.id)!)
    else map.get(n.parent_id)?.children?.push(map.get(n.id)!)
  })
  return roots
}

// ── KB tree row ────────────────────────────────────────────────────────────────

function KbTreeRow({ node, depth, selected, onToggle, search }: {
  node: KBNode
  depth: number
  selected: Set<number>
  onToggle: (id: number) => void
  search: string
}) {
  const [expanded, setExpanded] = useState(true)
  const hasChildren = (node.children?.length ?? 0) > 0
  const lc = search.toLowerCase()
  const matches = !search || node.name.toLowerCase().includes(lc)
  const childMatches = search ? node.children?.some(c => c.name.toLowerCase().includes(lc)) : true
  if (!matches && !childMatches) return null

  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 rounded-lg transition cursor-pointer hover:bg-[var(--c-hover)]"
        style={{ paddingLeft: `${10 + depth * 14}px`, paddingRight: 8 }}
        onClick={() => onToggle(node.id)}
      >
        <button
          type="button"
          onClick={e => { e.stopPropagation(); setExpanded(v => !v) }}
          className="w-4 h-4 flex-shrink-0 flex items-center justify-center rounded"
          style={{ color: 'var(--c-t4)', visibility: hasChildren ? 'visible' : 'hidden' }}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </button>
        <div
          className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center"
          style={{
            background: selected.has(node.id) ? 'var(--c-primary)' : 'transparent',
            borderColor: selected.has(node.id) ? 'var(--c-primary)' : 'var(--c-border-strong)',
          }}
        >
          {selected.has(node.id) && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-[12px] select-none truncate" style={{ color: 'var(--c-t2)' }}>{node.name}</span>
      </div>
      {hasChildren && expanded && node.children?.map(child => (
        <KbTreeRow key={child.id} node={child} depth={depth + 1}
          selected={selected} onToggle={onToggle} search={search} />
      ))}
    </>
  )
}

// ── Checkbox row helper ────────────────────────────────────────────────────────

function CheckRow({ id, label, badge, selected, onToggle }: {
  id: number; label: string; badge?: string
  selected: Set<number>; onToggle: (id: number) => void
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition hover:bg-[var(--c-hover)]"
      onClick={() => onToggle(id)}
    >
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center"
          style={{
            background: selected.has(id) ? 'var(--c-primary)' : 'transparent',
            borderColor: selected.has(id) ? 'var(--c-primary)' : 'var(--c-border-strong)',
          }}
        >
          {selected.has(id) && (
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
              <path d="M1 4l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-[12px] truncate" style={{ color: 'var(--c-t2)' }}>{label}</span>
      </div>
      {badge && (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0"
          style={{ background: 'var(--c-hover)', color: 'var(--c-t5)', borderColor: 'var(--c-border)' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// ── Agent type dropdown ────────────────────────────────────────────────────────

function AgentTypeSelect({ value, onChange }: {
  value: Agent['agent_type']
  onChange: (v: Agent['agent_type']) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = AGENT_TYPES.find(t => t.value === value)!

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const SelIcon = selected.icon

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition"
        style={{
          background: 'var(--c-hover)',
          borderColor: open ? 'var(--c-primary)' : 'var(--c-border-strong)',
        }}
      >
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--c-primary-light)' }}>
          <SelIcon size={14} style={{ color: 'var(--c-primary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--c-t1)' }}>
            {selected.label}
          </p>
          <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{selected.desc}</p>
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--c-t4)' }}>
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
          {AGENT_TYPES.map(at => {
            const Icon = at.icon
            const isSelected = at.value === value
            return (
              <button
                key={at.value}
                type="button"
                onClick={() => { onChange(at.value); setOpen(false) }}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--c-hover)]"
                style={{ borderBottom: '1px solid var(--c-border)' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: isSelected ? 'var(--c-primary-light)' : 'var(--c-hover)' }}>
                  <Icon size={15} style={{ color: isSelected ? 'var(--c-primary)' : 'var(--c-t4)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: isSelected ? 'var(--c-primary)' : 'var(--c-t1)' }}>
                    {at.label}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>{at.desc}</p>
                </div>
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0"
                    style={{ color: 'var(--c-primary)' }}>
                    <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Save / Edit Modal ──────────────────────────────────────────────────────────

function SaveAgentModal({
  agent, llmList, tools, kbTree, onClose, onSaved,
}: {
  agent: Agent | null
  llmList: LLMConfig[]
  tools: Tool[]
  kbTree: KBNode[]
  onClose: () => void
  onSaved: (a: Agent) => void
}) {
  const isEdit = agent !== null

  const [agentType,    setAgentType]    = useState<Agent['agent_type']>(agent?.agent_type ?? 'llm')
  const [name,         setName]         = useState(agent?.name ?? '')
  const [description,  setDescription]  = useState(agent?.description ?? '')
  const [llmConfigId,  setLlmConfigId]  = useState<number | ''>(agent?.llm_config_id ?? '')
  const [systemPrompt, setSystemPrompt] = useState(agent?.system_prompt ?? '')
  const [selTools,     setSelTools]     = useState<Set<number>>(new Set(agent?.tool_ids ?? []))
  const [selKbs,       setSelKbs]       = useState<Set<number>>(new Set(agent?.kb_ids ?? []))
  const [toolSearch,   setToolSearch]   = useState('')
  const [kbSearch,     setKbSearch]     = useState('')
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)

  const toggleTool = (id: number) =>
    setSelTools(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })
  const toggleKb = (id: number) =>
    setSelKbs(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_agent', {
        p_id:             isEdit ? agent.id : null,
        p_name:           name.trim(),
        p_description:    description.trim() || null,
        p_system_prompt:  systemPrompt || null,
        p_llm_config_id:  llmConfigId || null,
        p_tool_ids:       Array.from(selTools),
        p_kb_ids:         Array.from(selKbs),
        p_agent_type:     agentType,
        p_is_active:      true,
        p_max_iterations: 10,
        p_avatar:         null,
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: Agent[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved(env.data[0])
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save agent')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    background: 'var(--c-hover)',
    borderColor: 'var(--c-border-strong)',
    color: 'var(--c-t1)',
  }

  // Grouped tools for right panel
  const filteredTools = toolSearch
    ? tools.filter(t => t.name.toLowerCase().includes(toolSearch.toLowerCase()))
    : tools
  const toolGroups = filteredTools.reduce<Record<string, Tool[]>>((acc, t) => {
    const key = t.api_type || 'Other'
    ;(acc[key] ??= []).push(t)
    return acc
  }, {})

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <form onSubmit={submit}
        className="relative rounded-2xl shadow-2xl w-full max-w-5xl flex flex-col border"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)', maxHeight: '92vh' }}>

        {/* Header — frozen */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Bot size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit Agent' : 'New Agent'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                {isEdit ? 'Update agent configuration.' : 'Configure a new AI agent.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body — left fields + right tools/KBs */}
        <div className="flex-1 flex min-h-0 overflow-hidden">

          {/* ── Left: scrollable fields ── */}
          <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

            {/* Agent type */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Agent Type</label>
              <AgentTypeSelect value={agentType} onChange={setAgentType} />
            </div>

            {/* Name + LLM on same row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="e.g. Support Agent"
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>
                  LLM Configuration <span className="text-red-500">*</span>
                </label>
                <SearchableSelect
                  options={llmList.map(l => ({
                    value: l.id,
                    label: `${l.name} — ${l.model}`,
                  }))}
                  value={llmConfigId}
                  onChange={setLlmConfigId}
                  placeholder="Select LLM…"
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Description</label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe what this agent does..."
                className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
                style={inputStyle}
              />
            </div>

            {/* System Prompt */}
            <MarkdownEditor
              label="System Prompt"
              value={systemPrompt}
              onChange={setSystemPrompt}
              placeholder="You are an AI assistant that..."
              rows={14}
              minHeight="200px"
            />
          </div>

          {/* ── Right: tools (top half) + KBs (bottom half) ── */}
          <div className="w-72 flex-shrink-0 border-l flex flex-col min-h-0"
            style={{ borderColor: 'var(--c-border)' }}>

            {/* Action Tools */}
            <div className="flex flex-col min-h-0" style={{ flex: '0 0 50%' }}>
              <div className="flex-shrink-0 px-4 py-3 border-b"
                style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
                  style={{ color: 'var(--c-t3)' }}>Action Tools</p>
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--c-t5)' }} />
                  <input
                    value={toolSearch}
                    onChange={e => setToolSearch(e.target.value)}
                    placeholder="Search action tools..."
                    className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] border focus:outline-none"
                    style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-1">
                {Object.keys(toolGroups).length === 0 ? (
                  <p className="text-[11px] px-3 py-4 text-center" style={{ color: 'var(--c-t5)' }}>No tools found</p>
                ) : Object.entries(toolGroups).map(([group, gTools]) => (
                  <div key={group}>
                    <p className="text-[10px] font-semibold uppercase tracking-wide px-3 pt-2 pb-1"
                      style={{ color: 'var(--c-t5)' }}>
                      {group.replace(/_/g, ' ')}
                    </p>
                    {gTools.map(t => (
                      <CheckRow key={t.id} id={t.id} label={t.name}
                        badge={t.method?.toUpperCase() || undefined}
                        selected={selTools} onToggle={toggleTool} />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-shrink-0 border-t" style={{ borderColor: 'var(--c-border)' }} />

            {/* Knowledge Bases */}
            <div className="flex flex-col flex-1 min-h-0">
              <div className="flex-shrink-0 px-4 py-3 border-b"
                style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
                <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
                  style={{ color: 'var(--c-t3)' }}>Knowledge Bases</p>
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--c-t5)' }} />
                  <input
                    value={kbSearch}
                    onChange={e => setKbSearch(e.target.value)}
                    placeholder="Search knowledge bases..."
                    className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] border focus:outline-none"
                    style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-2 py-1">
                {kbTree.length === 0 ? (
                  <p className="text-[11px] px-3 py-4 text-center" style={{ color: 'var(--c-t5)' }}>No knowledge bases</p>
                ) : kbTree.map(node => (
                  <KbTreeRow key={node.id} node={node} depth={0}
                    selected={selKbs} onToggle={toggleKb} search={kbSearch} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer — frozen */}
        <div className="flex-shrink-0 px-6 pb-5 pt-4 border-t flex flex-col gap-3"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)', borderRadius: '0 0 1rem 1rem' }}>
          {error && (
            <div className="text-[12px] rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                         transition flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Update Agent' : 'Create Agent'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ── Agent card ─────────────────────────────────────────────────────────────────

function AgentCard({ agent, tools, kbs, onEdit, onDeleted, onAccessUpdated }: {
  agent: Agent
  tools: Tool[]
  kbs: KBNode[]
  onEdit: () => void
  onDeleted: (id: number) => void
  onAccessUpdated: (id: number, ac: AccessControlValue) => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [showAccess, setShowAccess] = useState(false)

  const toolMap = useMemo(() => new Map(tools.map(t => [t.id, t.name])), [tools])
  const kbMap   = useMemo(() => new Map(kbs.map(k => [k.id, k.name])), [kbs])

  const toolNames = (agent.tool_ids ?? []).map(id => toolMap.get(id)).filter(Boolean) as string[]
  const kbNames   = (agent.kb_ids ?? []).map(id => kbMap.get(id)).filter(Boolean) as string[]

  const SHOW_MAX = 3
  const allTags = [
    ...toolNames.map(n => ({ n, kind: 'tool' as const })),
    ...kbNames.map(n => ({ n, kind: 'kb' as const })),
  ]
  const visible = allTags.slice(0, SHOW_MAX)
  const overflow = allTags.length - SHOW_MAX

  const typeConfig = AGENT_TYPES.find(t => t.value === agent.agent_type)
  const TypeIcon = typeConfig?.icon ?? Bot

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_delete_agent', { p_id: agent.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(agent.id)
    } catch { /* ignore */ } finally {
      setDeleting(false); setConfirmDel(false)
    }
  }

  return (
    <>
      <div className="rounded-2xl border p-5 flex flex-col gap-3 transition-shadow hover:shadow-md"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Top */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            <Bot size={18} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-semibold truncate leading-tight" style={{ color: 'var(--c-t1)' }}>
                {agent.name}
              </p>
              <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 border"
                style={{ background: 'var(--c-hover)', color: 'var(--c-t4)', borderColor: 'var(--c-border)' }}>
                <TypeIcon size={9} />
                {typeConfig?.label ?? agent.agent_type}
              </span>
            </div>
            {agent.llm && (
              <p className="text-[11px] mt-0.5 font-mono" style={{ color: 'var(--c-t4)' }}>
                {agent.llm.model}
              </p>
            )}
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <>
            <div className="h-px" style={{ background: 'var(--c-border)' }} />
            <p className="text-[12px] leading-relaxed line-clamp-2" style={{ color: 'var(--c-t3)' }}>
              {agent.description}
            </p>
          </>
        )}

        {/* Tags */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {visible.map(({ n, kind }) => (
              <span key={`${kind}-${n}`}
                className="text-[11px] px-2 py-0.5 rounded border"
                style={kind === 'kb'
                  ? { background: 'var(--c-primary-light)', color: 'var(--c-primary)', borderColor: 'var(--c-primary)' }
                  : { background: 'var(--c-hover)',         color: 'var(--c-t3)',       borderColor: 'var(--c-border)' }
                }>
                {n}
              </span>
            ))}
            {overflow > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded border"
                style={{ background: 'var(--c-hover)', color: 'var(--c-t4)', borderColor: 'var(--c-border)' }}>
                +{overflow} more
              </span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="border-t pt-3 flex items-center justify-end"
          style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-0.5">
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
              <>
                <button onClick={() => setShowAccess(true)} title="Access Control"
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
              </>
            )}
          </div>
        </div>
      </div>

      {showAccess && (
        <AccessControl
          resourceName={`Agent: ${agent.name}`}
          recordId={agent.id}
          routeName="agents"
          accessControl={agent.access_control}
          onClose={() => setShowAccess(false)}
          onSaved={ac => { onAccessUpdated(agent.id, ac); setShowAccess(false) }}
        />
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function AgentsPage() {

  const [agents,     setAgents]     = useState<Agent[]>([])
  const [llmList,    setLlmList]    = useState<LLMConfig[]>([])
  const [tools,      setTools]      = useState<Tool[]>([])
  const [kbFlat,     setKbFlat]     = useState<KBNode[]>([])
  const [kbTree,     setKbTree]     = useState<KBNode[]>([])
  const [search,     setSearch]     = useState('')
  const [loading,    setLoading]    = useState(true)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async () => {
    setLoading(true)
    try {
      const [agR, llmR, toolR, kbR] = await Promise.all([
        HttpHelper.rpc('fn_get_agents'),
        HttpHelper.rpc('fn_get_llm_list'),
        HttpHelper.rpc('fn_get_tools'),
        HttpHelper.rpc('fn_get_kb_tree'),
      ])
      const agEnv  = agR.data   as { is_success: boolean; data: Agent[] }
      const llmEnv = llmR.data  as { is_success: boolean; data: LLMConfig[] }
      const tEnv   = toolR.data as { is_success: boolean; data: Tool[] }
      const kbEnv  = kbR.data   as { is_success: boolean; data: KBNode[] }

      if (agEnv?.is_success)  setAgents(agEnv.data ?? [])
      if (llmEnv?.is_success) setLlmList(llmEnv.data ?? [])
      if (tEnv?.is_success)   setTools(tEnv.data ?? [])
      if (kbEnv?.is_success) {
        const flat = kbEnv.data ?? []
        setKbFlat(flat)
        setKbTree(buildKbTree(flat))
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = search
    ? agents.filter(a => a.name.toLowerCase().includes(search.toLowerCase()))
    : agents

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ background: 'var(--c-base)' }}>

      {/* Header */}
      <div className="px-6 py-5 border-b flex items-start justify-between gap-4 flex-shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            <Bot size={20} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div>
            <h1 className="text-[16px] font-semibold" style={{ color: 'var(--c-t1)' }}>Agents</h1>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
              Build specialized agents with custom prompts, tools, and LLM assignments.
            </p>
          </div>
        </div>
        <button onClick={() => openEdit('new')}
          className="flex items-center gap-2 px-4 py-2.5 btn-primary text-[13px] font-semibold rounded-xl transition flex-shrink-0">
          <Plus size={15} /> New Agent
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--c-t4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search agents..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-[12px] border focus:outline-none transition"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--c-hover)' }}>
              <Bot size={24} style={{ color: 'var(--c-t5)' }} />
            </div>
            <div>
              <p className="text-[14px] font-medium" style={{ color: 'var(--c-t2)' }}>
                {search ? 'No agents match your search' : 'No agents yet'}
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                {search ? 'Try a different search term.' : 'Create your first agent to get started.'}
              </p>
            </div>
            {!search && (
              <button onClick={() => openEdit('new')}
                className="px-4 py-2 btn-primary text-[12px] font-medium rounded-xl transition">
                New Agent
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(a => (
              <AgentCard
                key={a.id}
                agent={a}
                tools={tools}
                kbs={kbFlat}
                onEdit={() => openEdit(a.id)}
                onDeleted={id => setAgents(prev => prev.filter(x => x.id !== id))}
                onAccessUpdated={(id, ac) =>
                  setAgents(prev => prev.map(x => x.id === id ? { ...x, access_control: ac } : x))
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Save modal */}
      {editId !== null && (
        <SaveAgentModal
          agent={editId === 'new' ? null : agents.find(a => String(a.id) === editId) ?? null}
          llmList={llmList}
          tools={tools}
          kbTree={kbTree}
          onClose={closeEdit}
          onSaved={saved => {
            const llm = llmList.find(l => l.id === saved.llm_config_id)
            const enriched: Agent = {
              ...saved,
              llm: llm ? { id: llm.id, name: llm.name, model: llm.model } : null,
            }
            setAgents(prev => {
              const exists = prev.find(x => x.id === enriched.id)
              return exists
                ? prev.map(x => x.id === enriched.id ? enriched : x)
                : [enriched, ...prev]
            })
            closeEdit()
          }}
        />
      )}
    </div>
  )
}
