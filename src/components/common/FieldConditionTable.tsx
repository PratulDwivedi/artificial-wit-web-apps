'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X, Search, Plus, Trash2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { PageControlCondition } from './PageControlCondition'

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageField {
  id: number
  name: string
  binding_name: string
  control_type: string
  control_type_id: number
  binding_list_route_name: string | null
}

interface ConditionRow {
  _id: string        // internal React key — stripped on emit
  control_id: number
  operator: string
  value: string
}

export interface ConditionEntry {
  control_id: number
  operator: string
  value: string
}

const OPERATORS = ['=', '!=', 'IN', 'NOT IN', '>', '<', '>=', '<=', 'LIKE', 'NOT LIKE']

// ── FieldSelect — portal dropdown keyed by field id ───────────────────────────

function FieldSelect({ fields, value, onChange, disabled }: {
  fields: PageField[]
  value: number
  onChange: (id: number) => void
  disabled?: boolean
}) {
  const [open,   setOpen]   = useState(false)
  const [search, setSearch] = useState('')
  const [rect,   setRect]   = useState<DOMRect | null>(null)
  const triggerRef  = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selected = fields.find(f => f.id === value)
  const filtered = search
    ? fields.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase()) ||
        f.binding_name.toLowerCase().includes(search.toLowerCase())
      )
    : fields

  function openDropdown() {
    if (disabled) return
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setOpen(true)
  }

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

  useEffect(() => {
    if (!open) return
    const upd = () => { if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect()) }
    window.addEventListener('scroll', upd, true)
    window.addEventListener('resize', upd)
    return () => { window.removeEventListener('scroll', upd, true); window.removeEventListener('resize', upd) }
  }, [open])

  const DROPDOWN_HEIGHT = 256
  const flipUp = rect ? (window.innerHeight - rect.bottom) < DROPDOWN_HEIGHT + 8 : false

  const dropdownStyle: React.CSSProperties = rect ? {
    position: 'fixed',
    ...(flipUp ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    left:  rect.left,
    width: Math.max(rect.width, 220),
    zIndex: 9999,
  } : { display: 'none' }

  return (
    <div ref={triggerRef}>
      <div
        onClick={openDropdown}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border text-[12px]"
        style={{
          background:  'var(--c-hover)',
          borderColor: open ? 'var(--c-primary)' : 'var(--c-border-strong)',
          color:       selected ? 'var(--c-t1)' : 'var(--c-t4)',
          boxShadow:   open ? '0 0 0 2px var(--c-primary-light)' : undefined,
          cursor:      disabled ? 'not-allowed' : 'pointer',
          opacity:     disabled ? 0.6 : 1,
        }}>
        <span className="flex-1 truncate">{selected?.name ?? 'Select field…'}</span>
        {selected && !disabled && (
          <button type="button" onMouseDown={e => { e.stopPropagation(); onChange(0) }}
            className="shrink-0 hover:opacity-70" style={{ color: 'var(--c-t4)' }}>
            <X size={11} />
          </button>
        )}
        <ChevronDown size={12} className="shrink-0" style={{ color: 'var(--c-t4)' }} />
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
          <div className="p-1.5 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg" style={{ background: 'var(--c-hover)' }}>
              <Search size={11} style={{ color: 'var(--c-t4)' }} />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search fields…" className="flex-1 bg-transparent outline-none text-[11px]"
                style={{ color: 'var(--c-t1)' }} />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {filtered.length === 0
              ? <div className="py-3 text-center text-[11px]" style={{ color: 'var(--c-t4)' }}>No results</div>
              : filtered.map(f => (
                <button key={f.id} type="button"
                  onClick={() => { onChange(f.id); setOpen(false); setSearch('') }}
                  className="w-full px-3 py-1.5 text-left text-[12px] transition flex items-center justify-between gap-2"
                  style={{
                    background: f.id === value ? 'var(--c-active)' : undefined,
                    color:      f.id === value ? 'var(--c-primary)' : 'var(--c-t2)',
                  }}
                  onMouseEnter={e => { if (f.id !== value) e.currentTarget.style.background = 'var(--c-hover)' }}
                  onMouseLeave={e => { if (f.id !== value) e.currentTarget.style.background = '' }}>
                  <span className="truncate">{f.name}</span>
                  <code className="text-[9px] font-mono shrink-0" style={{ color: 'var(--c-t5)' }}>
                    {`{{${f.binding_name}}}`}
                  </code>
                </button>
              ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ── FieldConditionTable ────────────────────────────────────────────────────────

export function FieldConditionTable({
  value,
  onChange,
  binding_list_route_name,
  cascade_from_binding_name,
  cascadeValue,
  disabled = false,
}: {
  value: unknown
  onChange: (conditions: ConditionEntry[]) => void
  binding_list_route_name?: string
  cascade_from_binding_name?: string
  cascadeValue?: unknown
  disabled?: boolean
}) {
  const [pageFields, setPageFields] = useState<PageField[]>([])
  const [rows,       setRows]       = useState<ConditionRow[]>([])
  const isTouchedRef = useRef(false)

  // Load page fields when cascade value changes
  useEffect(() => {
    if (!binding_list_route_name || cascadeValue == null) { setPageFields([]); return }
    const params: Record<string, unknown> = {}
    if (cascade_from_binding_name) params[`p_${cascade_from_binding_name}`] = cascadeValue
    HttpHelper.rpc(binding_list_route_name, params)
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: PageField[] }
        if (env?.is_success) setPageFields(env.data ?? [])
        else setPageFields([])
      })
      .catch(() => setPageFields([]))
  }, [binding_list_route_name, cascade_from_binding_name, cascadeValue])

  // Sync from value prop until user makes the first edit
  useEffect(() => {
    if (isTouchedRef.current) return
    const incoming = Array.isArray(value) ? (value as object[]) : []
    setRows(incoming.map(c => {
      const cond = c as Partial<ConditionEntry>
      return {
        _id:        crypto.randomUUID(),
        control_id: cond.control_id ?? 0,
        operator:   cond.operator   ?? '=',
        value:      cond.value      ?? '',
      }
    }))
  }, [value])

  function emit(newRows: ConditionRow[]) {
    isTouchedRef.current = true
    setRows(newRows)
    onChange(newRows.map(({ _id: _, ...rest }) => rest))
  }

  function addRow() {
    emit([...rows, { _id: crypto.randomUUID(), control_id: 0, operator: '=', value: '' }])
  }

  function removeRow(id: string) {
    emit(rows.filter(r => r._id !== id))
  }

  function updateField(id: string, control_id: number) {
    emit(rows.map(r => r._id === id ? { ...r, control_id, value: '' } : r))
  }

  function updateRow(id: string, key: 'operator' | 'value', val: string) {
    emit(rows.map(r => r._id === id ? { ...r, [key]: val } : r))
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="py-4 text-center text-[12px]" style={{ color: 'var(--c-t5)' }}>
          No conditions added yet
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--c-border)' }}>
                {['Page Field', 'Operator', 'Value', ''].map(h => (
                  <th key={h} className="text-left pb-2 font-semibold text-[11px] uppercase tracking-wide pr-3"
                    style={{ color: 'var(--c-t4)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const selectedField = pageFields.find(f => f.id === row.control_id) ?? null
                return (
                  <tr key={row._id} className="border-b" style={{ borderColor: 'var(--c-border)' }}>
                    <td className="py-2 pr-3" style={{ minWidth: 160 }}>
                      <FieldSelect
                        fields={pageFields}
                        value={row.control_id}
                        onChange={id => updateField(row._id, id)}
                        disabled={disabled}
                      />
                    </td>
                    <td className="py-2 pr-3" style={{ minWidth: 120 }}>
                      <select
                        value={row.operator}
                        onChange={e => updateRow(row._id, 'operator', e.target.value)}
                        disabled={disabled}
                        className="w-full rounded-lg px-2 py-1.5 text-[12px] border"
                        style={{
                          background:  'var(--c-hover)',
                          borderColor: 'var(--c-border-strong)',
                          color:       'var(--c-t1)',
                        }}>
                        {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3" style={{ minWidth: 180 }}>
                      <PageControlCondition
                        field={selectedField}
                        value={row.value}
                        onChange={val => updateRow(row._id, 'value', val)}
                      />
                    </td>
                    <td className="py-2">
                      {!disabled && (
                        <button type="button" onClick={() => removeRow(row._id)}
                          className="p-1.5 rounded-lg transition hover:bg-red-500/10"
                          style={{ color: '#ef4444' }}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {!disabled && (
        <button type="button" onClick={addRow}
          className="flex items-center gap-1.5 px-3.5 py-1.5 btn-primary rounded-xl text-[12px] font-semibold">
          <Plus size={13} /> Add Condition
        </button>
      )}
    </div>
  )
}
