'use client'

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, ChevronDown, X, Search } from 'lucide-react'
import { HttpHelper } from '@/lib/http'

interface TreeNode {
  id: number | string
  name: string
  children?: TreeNode[]
  parent_id?: number | string | null
  [key: string]: unknown
}

interface Props {
  value: unknown
  onChange: (value: unknown) => void
  binding_list_route_name?: string
  cascade_from_binding_name?: string
  cascadeValue?: unknown
  disabled?: boolean
  required?: boolean
  multiple?: boolean
}

// ── Recursive filter ──────────────────────────────────────────────────────────

function filterNodes(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query.trim()) return nodes
  const q = query.toLowerCase()
  return nodes
    .map(node => {
      const filteredChildren = filterNodes(node.children ?? [], q)
      if (node.name.toLowerCase().includes(q) || filteredChildren.length > 0) {
        return { ...node, children: filteredChildren }
      }
      return null
    })
    .filter(Boolean) as TreeNode[]
}

// ── Recursive tree node ───────────────────────────────────────────────────────

function TreeItem({
  node,
  selectedIds,
  onSelect,
  multiple,
  forceExpand = false,
  depth = 0,
}: {
  node: TreeNode
  selectedIds: string[]
  onSelect: (node: TreeNode) => void
  multiple: boolean
  forceExpand?: boolean
  depth?: number
}) {
  const hasChildren = (node.children?.length ?? 0) > 0
  const [expanded, setExpanded] = useState(false)
  const isExpanded = forceExpand || expanded
  const isSelected = selectedIds.includes(String(node.id))

  return (
    <div>
      <div
        role="option"
        aria-selected={isSelected}
        className="flex items-center gap-1.5 rounded-lg cursor-pointer transition select-none"
        style={{
          paddingLeft: 8 + depth * 18,
          paddingRight: 8,
          paddingTop: 6,
          paddingBottom: 6,
          background: isSelected ? 'var(--c-active)' : undefined,
          color: isSelected ? 'var(--c-primary)' : 'var(--c-t2)',
        }}
        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'var(--c-hover)' }}
        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '' }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse chevron */}
        <button
          type="button"
          className="shrink-0 w-4 h-4 flex items-center justify-center rounded transition hover:bg-[var(--c-border-strong)]"
          onClick={e => { e.stopPropagation(); if (hasChildren && !forceExpand) setExpanded(v => !v) }}
        >
          {hasChildren
            ? isExpanded
              ? <ChevronDown  size={11} style={{ color: 'var(--c-t4)' }} />
              : <ChevronRight size={11} style={{ color: 'var(--c-t4)' }} />
            : null}
        </button>

        {/* Checkbox for multi, radio-dot for single */}
        <span
          className="shrink-0 w-4 h-4 rounded flex items-center justify-center border transition"
          style={
            isSelected
              ? { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' }
              : { borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)' }
          }
        >
          {isSelected && (
            multiple
              ? <svg viewBox="0 0 12 12" width="8" height="8" fill="white"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <span className="w-2 h-2 rounded-full bg-white block" />
          )}
        </span>

        <span className="text-[13px] flex-1 truncate">{node.name}</span>
      </div>

      {isExpanded && hasChildren && (
        <div>
          {node.children!.map(child => (
            <TreeItem
              key={String(child.id)}
              node={child}
              selectedIds={selectedIds}
              onSelect={onSelect}
              multiple={multiple}
              forceExpand={forceExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function TreeViewSelect({
  value,
  onChange,
  binding_list_route_name,
  cascade_from_binding_name,
  cascadeValue,
  disabled = false,
  required = false,
  multiple = false,
}: Props) {
  const [nodes,   setNodes]   = useState<TreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)
  const [search,  setSearch]  = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef     = useRef<HTMLDivElement>(null)
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })

  // Fetch tree data
  useEffect(() => {
    if (!binding_list_route_name) return
    setLoading(true)
    const params: Record<string, unknown> = {}
    if (cascade_from_binding_name && cascadeValue != null) {
      params[`p_${cascade_from_binding_name}`] = cascadeValue
    }
    HttpHelper.rpc(binding_list_route_name, params)
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: TreeNode[] }
        if (env?.is_success) setNodes(env.data ?? [])
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding_list_route_name, cascade_from_binding_name, cascadeValue])

  // Close on outside click — allow clicks inside the portalled panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Derived selection state
  const selectedIds: string[] = multiple
    ? (Array.isArray(value) ? (value as unknown[]).map(String) : [])
    : (value != null ? [String(value)] : [])

  // Flatten tree for label lookup
  function flatNodes(nodes: TreeNode[]): TreeNode[] {
    return nodes.flatMap(n => [n, ...flatNodes(n.children ?? [])])
  }
  const flat = flatNodes(nodes)
  const chips = selectedIds.map(id => ({
    id,
    name: flat.find(n => String(n.id) === id)?.name ?? id,
  }))

  const handleSelect = (node: TreeNode) => {
    if (disabled) return
    const v = isNaN(Number(node.id)) ? node.id : Number(node.id)
    if (multiple) {
      const cur = Array.isArray(value) ? (value as unknown[]) : []
      const idx = cur.findIndex(x => String(x) === String(node.id))
      onChange(idx >= 0 ? cur.filter((_, i) => i !== idx) : [...cur, v])
    } else {
      onChange(v)
      setOpen(false)
    }
  }

  const removeChip = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    onChange((Array.isArray(value) ? (value as unknown[]) : []).filter(x => String(x) !== id))
  }

  const hasValue = selectedIds.length > 0

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          if (disabled || loading) return
          if (!open && containerRef.current) {
            const r = containerRef.current.getBoundingClientRect()
            setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
          }
          if (open) setSearch('')
          setOpen(v => !v)
        }}
        className="w-full min-h-[38px] flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-[13px] border transition
                   focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)]
                   disabled:opacity-50 disabled:cursor-not-allowed text-left"
        style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}
      >
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {hasValue ? (
            multiple ? chips.map(chip => (
              <span key={chip.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                style={{ background: 'var(--c-active)', color: 'var(--c-primary)' }}>
                {chip.name}
                {!disabled && (
                  <span onClick={e => removeChip(e, chip.id)} className="hover:opacity-60 cursor-pointer">
                    <X size={9} />
                  </span>
                )}
              </span>
            )) : (
              <span className="py-0.5 truncate" style={{ color: 'var(--c-t1)' }}>
                {chips[0]?.name}
              </span>
            )
          ) : (
            <span className="py-0.5" style={{ color: 'var(--c-t5)' }}>
              {loading ? 'Loading…' : multiple ? '— Select items —' : '— Select —'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-0.5 shrink-0">
          {hasValue && !disabled && (
            <span onClick={e => { e.stopPropagation(); onChange(multiple ? [] : null) }}
              className="p-0.5 rounded transition hover:bg-[var(--c-border-strong)]"
              style={{ color: 'var(--c-t5)' }}>
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13}
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--c-t4)' }} />
        </div>
      </button>

      {/* Tree dropdown — portalled to body so overflow:hidden on ancestors can't clip it */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="rounded-xl border shadow-2xl overflow-hidden"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: 'var(--c-panel)',
            borderColor: 'var(--c-border)',
          }}
        >
          {/* Search box */}
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <Search size={12} style={{ color: 'var(--c-t4)', flexShrink: 0 }} />
            <input
              autoFocus
              name="search" aria-label="Search options"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 text-[12px] bg-transparent outline-none"
              style={{ color: 'var(--c-t1)' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}
                className="opacity-50 hover:opacity-100 transition">
                <X size={10} style={{ color: 'var(--c-t4)' }} />
              </button>
            )}
          </div>
          {/* Tree list */}
          {(() => {
            const visible = filterNodes(nodes, search)
            const isSearching = search.trim().length > 0
            return (
              <div role="listbox" className="overflow-y-auto max-h-[240px] p-1">
                {visible.length === 0 ? (
                  <p className="px-3 py-3 text-[12px] text-center" style={{ color: 'var(--c-t5)' }}>
                    {nodes.length === 0 ? 'No options found' : 'No results'}
                  </p>
                ) : visible.map(node => (
                  <TreeItem
                    key={String(node.id)}
                    node={node}
                    selectedIds={selectedIds}
                    onSelect={handleSelect}
                    multiple={multiple}
                    forceExpand={isSearching}
                  />
                ))}
              </div>
            )
          })()}
        </div>,
        document.body
      )}

      {required && !hasValue && (
        <input type="text" required tabIndex={-1} aria-hidden name="_tree_required"
          className="absolute inset-0 opacity-0 pointer-events-none w-full"
          defaultValue="" />
      )}
    </div>
  )
}
