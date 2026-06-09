'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Search, Loader2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ConditionField {
  control_type_id: number
  binding_list_route_name: string | null
}

interface LookupItem { id: number; name: string }

// control_type_ids that source their options from a bound RPC
const LIST_TYPE_IDS = new Set([12, 17]) // Dropdown, Tree view Single/Multi Selection

// ── MultiSelectPortal ─────────────────────────────────────────────────────────

function MultiSelectPortal({
  routeName,
  value,
  onChange,
}: {
  routeName: string
  value: string        // comma-separated IDs, e.g. "1,3,7"
  onChange: (val: string) => void
}) {
  const [options,  setOptions]  = useState<LookupItem[]>([])
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)
  const [search,   setSearch]   = useState('')
  const [rect,     setRect]     = useState<DOMRect | null>(null)
  const triggerRef  = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedIds   = value ? value.split(',').map(s => s.trim()).filter(Boolean) : []
  const selectedItems = options.filter(o => selectedIds.includes(String(o.id)))

  // Load options once per routeName
  useEffect(() => {
    setLoading(true)
    HttpHelper.rpc(routeName, {})
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: LookupItem[] }
        if (env?.is_success) setOptions(env.data ?? [])
        else setOptions([])
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false))
  }, [routeName])

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !dropdownRef.current?.contains(e.target as Node)
      ) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return
    const upd = () => { if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect()) }
    window.addEventListener('scroll', upd, true)
    window.addEventListener('resize', upd)
    return () => { window.removeEventListener('scroll', upd, true); window.removeEventListener('resize', upd) }
  }, [open])

  function openDropdown() {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setOpen(true)
  }

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id]
    onChange(next.join(','))
  }

  const filtered = search
    ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase()))
    : options

  const DROPDOWN_HEIGHT = 280
  const flipUp = rect ? (window.innerHeight - rect.bottom) < DROPDOWN_HEIGHT + 8 : false

  const dropdownStyle: React.CSSProperties = rect ? {
    position: 'fixed',
    ...(flipUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    left:  rect.left,
    width: Math.max(rect.width, 240),
    zIndex: 9999,
  } : { display: 'none' }

  return (
    <div ref={triggerRef}>
      {/* Trigger — shows selected tags */}
      <div
        onClick={openDropdown}
        className="flex flex-wrap items-center gap-1 min-h-[32px] w-full px-2 py-1 rounded-lg border cursor-pointer"
        style={{
          background:  'var(--c-hover)',
          borderColor: open ? 'var(--c-primary)' : 'var(--c-border-strong)',
          boxShadow:   open ? '0 0 0 2px var(--c-primary-light)' : undefined,
        }}
      >
        {loading && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--c-t4)' }} />}
        {!loading && selectedItems.length === 0 && (
          <span className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Select values…</span>
        )}
        {selectedItems.map(item => (
          <span key={item.id}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px]"
            style={{ background: 'var(--c-active)', color: 'var(--c-primary)' }}>
            {item.name}
            <button type="button"
              onMouseDown={e => { e.stopPropagation(); toggle(String(item.id)) }}
              className="hover:opacity-60">
              <X size={9} />
            </button>
          </span>
        ))}
        <ChevronDown size={11} className="ml-auto shrink-0" style={{ color: 'var(--c-t4)' }} />
      </div>

      {open && createPortal(
        <div ref={dropdownRef} style={{
          ...dropdownStyle,
          background:   'var(--c-panel)',
          borderRadius: 12,
          border:       '1px solid var(--c-border)',
          boxShadow:    '0 8px 32px rgba(0,0,0,0.18)',
          overflow:     'hidden',
        }}>
          {/* Search */}
          <div className="p-1.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'var(--c-hover)' }}>
              <Search size={11} style={{ color: 'var(--c-t4)' }} />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…" className="flex-1 bg-transparent outline-none text-[11px]"
                style={{ color: 'var(--c-t1)' }} />
            </div>
          </div>

          {/* Options */}
          <div className="overflow-y-auto" style={{ maxHeight: '220px' }}>
            {filtered.length === 0 ? (
              <div className="py-3 text-center text-[11px]" style={{ color: 'var(--c-t4)' }}>No results</div>
            ) : filtered.map(opt => {
              const sid     = String(opt.id)
              const checked = selectedIds.includes(sid)
              return (
                <button key={opt.id} type="button"
                  onClick={() => toggle(sid)}
                  className="w-full px-3 py-1.5 text-left text-[12px] transition flex items-center gap-2"
                  style={{
                    background: checked ? 'var(--c-active)' : undefined,
                    color:      checked ? 'var(--c-primary)' : 'var(--c-t2)',
                  }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--c-hover)' }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = '' }}>
                  {/* Checkbox indicator */}
                  <span
                    className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 text-[8px] leading-none"
                    style={{
                      borderColor: checked ? 'var(--c-primary)' : 'var(--c-border-strong)',
                      background:  checked ? 'var(--c-primary)' : 'transparent',
                      color:       '#fff',
                    }}>
                    {checked ? '✓' : ''}
                  </span>
                  <span className="truncate flex-1">{opt.name}</span>
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── PageControlCondition ──────────────────────────────────────────────────────

export function PageControlCondition({
  field,
  value,
  onChange,
}: {
  field: ConditionField | null
  value: string
  onChange: (val: string) => void
}) {
  const baseStyle: React.CSSProperties = {
    background:  'var(--c-hover)',
    borderColor: 'var(--c-border-strong)',
    color:       'var(--c-t1)',
  }

  // No field selected yet
  if (!field) {
    return (
      <input disabled value="" readOnly placeholder="Select a field first…"
        className="w-full rounded-lg px-2 py-1.5 text-[12px] border"
        style={{ ...baseStyle, color: 'var(--c-t4)', opacity: 0.6, cursor: 'not-allowed' }} />
    )
  }

  // Date picker
  if (field.control_type_id === 4) {
    return (
      <input type="date" value={value} onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg px-2 py-1.5 text-[12px] border"
        style={baseStyle} />
    )
  }

  // Dropdown / Tree view — multiselect sourced from bound RPC
  if (LIST_TYPE_IDS.has(field.control_type_id) && field.binding_list_route_name) {
    return (
      <MultiSelectPortal
        routeName={field.binding_list_route_name}
        value={value}
        onChange={onChange}
      />
    )
  }

  // Default: free-text
  return (
    <input type="text" value={value} onChange={e => onChange(e.target.value)}
      placeholder="Value…"
      className="w-full rounded-lg px-2 py-1.5 text-[12px] border"
      style={baseStyle} />
  )
}
