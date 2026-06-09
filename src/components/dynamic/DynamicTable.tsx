'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import type { PageSection, PageSchema, RpcEnvelope } from '@/lib/schema'
import { DynamicControl } from './DynamicControl'

interface Props {
  section: PageSection
  schema?: PageSchema   // pass for editable mode (child_display_mode_id 32)
  recordId?: string     // pass when editing an existing record
  onDataChange?: (rows: Row[]) => void
}

type Row = Record<string, unknown>

/**
 * Evaluate a formula string like "{qty}*{rate}*1.00" against the current row.
 * Only permits numbers and arithmetic operators — no arbitrary code paths.
 */
function evalFormula(formula: string, row: Row): unknown {
  const expr = formula.replace(/\{(\w+)\}/g, (_, key) => {
    const v = row[key]
    const n = Number(v)
    return (!isNaN(n) && v !== null && v !== undefined && String(v).trim() !== '') ? String(n) : '0'
  })
  if (!/^[\d\s+\-*/.()\\.]+$/.test(expr)) return ''
  try {
    return Function(`"use strict"; return (${expr})`)()
  } catch {
    return ''
  }
}

export function DynamicTable({ section, schema, recordId, onDataChange }: Props) {
  const { section_display_modes, control_display_modes, control_types } = APP_CONSTANTS
  const router   = useRouter()
  const editMode = useAppStore(s => s.editMode)

  const isNoneMode = section.display_mode_id === section_display_modes.none
  const [expanded, setExpanded] = useState(
    isNoneMode || section.display_mode_id !== section_display_modes.collapse
  )

  const allControls = [...(section.controls ?? [])].sort((a, b) => a.display_order - b.display_order)

  const addRowCtrl    = allControls.find(c => c.control_type_id === control_types.addTableRow)
  const deleteRowCtrl = allControls.find(c => c.control_type_id === control_types.deleteTableRow)
  const dataCols      = allControls.filter(c =>
    c.control_type_id !== control_types.addTableRow &&
    c.control_type_id !== control_types.deleteTableRow &&
    (c.display_mode_id !== control_display_modes.none_hidden || editMode)
  )

  const isEditable    = !!schema
  const colCount      = dataCols.length + 1 + (deleteRowCtrl ? 1 : 0) // # + data + delete
  const colWidth      = (col: typeof dataCols[number]) => {
    const w = parseInt(String(col.data?.width ?? 4), 10)
    return (isNaN(w) || w <= 0) ? 4 : w
  }
  const totalColWidth = dataCols.reduce((sum, col) => sum + colWidth(col), 0)

  const [rows,    setRows]    = useState<Row[]>([{}])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  // ── Editable mode: load initial rows from parent record GET ─────────────────
  useEffect(() => {
    if (!isEditable || !schema?.binding_name_get || !expanded) return
    if (!recordId) { setRows([{}]); return }
    setLoading(true); setError(null)
    HttpHelper.rpc(schema.binding_name_get, { p_id: parseInt(recordId, 10) })
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        const env = data as unknown as RpcEnvelope<Record<string, unknown>[]>
        if (env?.is_success && env.data?.[0]) {
          const sectionRows = env.data[0][section.binding_name ?? '']
          if (Array.isArray(sectionRows) && sectionRows.length > 0) {
            setRows(sectionRows as Row[])
            return
          }
        }
        setRows([{}])
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId, schema?.binding_name_get, section.binding_name, expanded])

  // ── Read-only mode: fetch via section.binding_name ──────────────────────────
  useEffect(() => {
    if (isEditable || !section.binding_name || !expanded) return
    setLoading(true); setError(null)
    HttpHelper.rpc(section.binding_name, {})
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        const env = data as unknown as RpcEnvelope<Row[]>
        if (env?.is_success) setRows(env.data ?? [])
        else setError(env?.message ?? 'Failed to load data')
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.binding_name, expanded])

  // Report rows to parent whenever they change
  useEffect(() => {
    onDataChange?.(rows)
  }, [rows, onDataChange])

  const addRow = useCallback(() => {
    setRows(prev => [...prev, {}])
  }, [])

  const deleteRow = useCallback((index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateCell = useCallback((rowIndex: number, bindingName: string, value: unknown) => {
    setRows(prev => {
      const next = [...prev]
      const row  = { ...next[rowIndex], [bindingName]: value }
      // Re-evaluate any formula-bearing columns after each cell change
      for (const ctrl of dataCols) {
        const formula = ctrl.data?.formula as string | undefined
        if (formula) row[ctrl.binding_name] = evalFormula(formula, row)
      }
      next[rowIndex] = row
      return next
    })
  // dataCols reference is stable across renders (derived from section.controls)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Table body ──────────────────────────────────────────────────────────────
  const tableBody = (
    <div className="overflow-x-auto">
      {/* Add Row toolbar — only in editable mode */}
      {isEditable && addRowCtrl && (
        <div className="px-4 py-2.5 flex items-center gap-2"
          style={{ borderBottom: '1px solid var(--c-border)' }}>
          <button type="button" onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border)', color: 'var(--c-t2)' }}>
            <Plus size={12} /> {addRowCtrl.name}
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
        </div>
      ) : error ? (
        <p className="p-4 text-[12px]" style={{ color: '#ef4444' }}>{error}</p>
      ) : (
        <table className="w-full text-[12px] border-collapse table-fixed">
            <colgroup>
              <col style={{ width: '44px' }} />
              {dataCols.map(col => (
                <col key={col.id} style={{ width: `${(colWidth(col) / totalColWidth) * 100}%` }} />
              ))}
              {isEditable && deleteRowCtrl && <col style={{ width: '44px' }} />}
            </colgroup>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-hover)' }}>
              <th className="px-3 py-2 text-center font-semibold select-none"
                style={{ color: 'var(--c-t4)', width: 44 }}>#</th>
              {dataCols.map(col => {
                const isHidden = col.display_mode_id === control_display_modes.none_hidden
                return (
                  <th key={col.id}
                    className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                    style={{ color: 'var(--c-t3)' }}>
                    <span className="inline-flex items-center gap-1">
                      {col.name}
                      {isHidden && (
                        <span className="text-[9px] font-normal px-1 py-0.5 rounded"
                          style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--c-t4)' }}>
                          Hidden
                        </span>
                      )}
                      {editMode && (
                        <button type="button"
                          onClick={() => router.push(`/page_section_control?id=${col.id}`)}
                          className="p-0.5 rounded transition opacity-40 hover:opacity-100 hover:bg-[var(--c-hover)]"
                          title="Edit control">
                          <Pencil size={10} />
                        </button>
                      )}
                    </span>
                  </th>
                )
              })}
              {isEditable && deleteRowCtrl && (
                <th className="px-3 py-2 text-center font-semibold"
                  style={{ color: 'var(--c-t4)', width: 44 }}>
                  <span className="inline-flex items-center gap-1">
                    {editMode && (
                      <button type="button"
                        onClick={() => router.push(`/page_section_control?id=${deleteRowCtrl.id}`)}
                        className="p-0.5 rounded transition opacity-40 hover:opacity-100 hover:bg-[var(--c-hover)]"
                        title="Edit control">
                        <Pencil size={10} />
                      </button>
                    )}
                  </span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: '1px solid var(--c-border)' }}
                className="transition-colors hover:bg-[var(--c-hover)]">
                <td className="px-3 py-1 text-center select-none"
                  style={{ color: 'var(--c-t5)', width: 44 }}>{i + 1}</td>
                {dataCols.map(col => (
                  <td key={col.id} className="px-2 py-1" style={{ color: 'var(--c-t2)' }}>
                    {isEditable ? (
                      <DynamicControl
                        {...col}
                        value={row[col.binding_name]}
                        onChange={(name, value) => updateCell(i, name, value)}
                        cascadeValue={
                          col.cascade_from_binding_name
                            ? row[col.cascade_from_binding_name]
                            : undefined
                        }
                        compact
                      />
                    ) : (
                      (() => {
                        const val = row[col.binding_name]
                        if (val === null || val === undefined)
                          return <span style={{ color: 'var(--c-t5)' }}>—</span>
                        if (typeof val === 'boolean')
                          return <span style={{ color: val ? '#16a34a' : 'var(--c-t5)' }}>{val ? '✓' : '—'}</span>
                        return <>{String(val)}</>
                      })()
                    )}
                  </td>
                ))}
                {isEditable && deleteRowCtrl && (
                  <td className="px-3 py-1 text-center" style={{ width: 44 }}>
                    <button type="button" onClick={() => deleteRow(i)}
                      title={deleteRowCtrl.name}
                      className="p-1.5 rounded-lg border border-transparent transition hover:border-red-200 hover:bg-red-50"
                      style={{ color: '#ef4444' }}>
                      <Trash2 size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={colCount}
                  className="py-8 text-center text-[13px]"
                  style={{ color: 'var(--c-t5)' }}>
                  No rows{isEditable && addRowCtrl ? ' — click Add Row to start' : ''}.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  )

  if (isNoneMode) return (
    <div className="relative">
      {editMode && (
        <div className="absolute top-2 right-2 flex gap-0.5 z-10">
          <button type="button" onClick={() => router.push(`/page_section?id=${section.id}`)}
            className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Edit section"
            style={{ color: 'var(--c-t4)' }}>
            <Pencil size={12} />
          </button>
          <button type="button" onClick={() => router.push(`/page_section_control?section_id=${section.id}`)}
            className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Add control"
            style={{ color: 'var(--c-t4)' }}>
            <Plus size={12} />
          </button>
        </div>
      )}
      {tableBody}
    </div>
  )

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
      <div className="flex items-center"
        style={{ borderBottom: expanded ? '1px solid var(--c-border)' : 'none', background: 'var(--c-topbar)' }}>
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-2 px-4 py-3 text-left transition hover:bg-[var(--c-hover)] min-w-0">
          {expanded
            ? <ChevronDown  size={13} style={{ color: 'var(--c-t4)' }} />
            : <ChevronRight size={13} style={{ color: 'var(--c-t4)' }} />}
          <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
            {section.name}
          </span>
        </button>
        {editMode && (
          <div className="flex items-center gap-0.5 pr-2 shrink-0">
            <button type="button" onClick={() => router.push(`/page_section?id=${section.id}`)}
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Edit section"
              style={{ color: 'var(--c-t4)' }}>
              <Pencil size={12} />
            </button>
            <button type="button" onClick={() => router.push(`/page_section_control?section_id=${section.id}`)}
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Add control"
              style={{ color: 'var(--c-t4)' }}>
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>
      {expanded && tableBody}
    </div>
  )
}
