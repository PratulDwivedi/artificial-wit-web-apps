'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import type { PageSection, RpcEnvelope } from '@/lib/schema'

interface Props {
  section: PageSection
  onDataChange?: (rows: Row[]) => void
}

type Row = Record<string, unknown>

function resolveTemplate(template: string, row: Row): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(row[key] ?? ''))
}

function CellValue({ control, row }: { control: PageSection['controls'][number]; row: Row }) {
  const router = useRouter()
  const { control_types } = APP_CONSTANTS
  const val = row[control.binding_name]

  if (control.control_type_id === control_types.hyperlink) {
    const template = (control.data?.default_value as string) ?? '#'
    const href     = resolveTemplate(template, row)
    return (
      <button
        onClick={() => router.push(href)}
        className="px-2.5 py-1 rounded-lg text-[11px] font-medium transition border"
        style={{ color: 'var(--c-primary)', borderColor: 'var(--c-primary)', background: 'var(--c-active)' }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8' }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
        {control.name}
      </button>
    )
  }

  if (control.control_type_id === control_types.hyperlinkRow) {
    const template = (control.data?.default_value as string) ?? '#'
    const href     = resolveTemplate(template, row)
    return (
      <a href={href} className="text-[12px] underline" style={{ color: 'var(--c-primary)' }}>
        {String(val ?? control.name)}
      </a>
    )
  }

  if (val === null || val === undefined) {
    return <span style={{ color: 'var(--c-t5)' }}>—</span>
  }
  if (typeof val === 'boolean') {
    return <span style={{ color: val ? '#16a34a' : 'var(--c-t5)' }}>{val ? '✓' : '—'}</span>
  }
  return <>{String(val)}</>
}

export function DynamicTable({ section, onDataChange }: Props) {
  const { section_display_modes, control_display_modes, control_types } = APP_CONSTANTS
  const ACTION_TYPES = new Set<number>([control_types.hyperlink, control_types.hyperlinkRow])
  const router   = useRouter()
  const editMode = useAppStore(s => s.editMode)

  const [rows,     setRows]     = useState<Row[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const isNoneMode = section.display_mode_id === section_display_modes.none
  const [expanded, setExpanded] = useState(
    isNoneMode || section.display_mode_id !== section_display_modes.collapse
  )

  const columns = [...(section.controls ?? [])]
    .filter(c => c.display_mode_id !== control_display_modes.none_hidden)
    .sort((a, b) => a.display_order - b.display_order)

  useEffect(() => {
    if (!section.binding_name || !expanded) return
    setLoading(true); setError(null)
    HttpHelper.rpc(section.binding_name, {})
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        const env = data as unknown as RpcEnvelope<Row[]>
        if (env?.is_success) {
          const loaded = env.data ?? []
          setRows(loaded)
          onDataChange?.(loaded)
        } else setError(env?.message ?? 'Failed to load data')
      })
      .finally(() => setLoading(false))
  // Fetch once when section first expands
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.binding_name, expanded])

  const tableBody = (
    <div className="overflow-x-auto">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
        </div>
      ) : error ? (
        <p className="p-4 text-[12px]" style={{ color: '#ef4444' }}>{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-[13px] text-center" style={{ color: 'var(--c-t5)' }}>
          No records found
        </p>
      ) : (
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-hover)' }}>
              {columns.map(col => (
                <th key={col.id}
                  className="px-4 py-2.5 text-left font-semibold whitespace-nowrap"
                  style={{ color: 'var(--c-t3)' }}>
                  <span className="inline-flex items-center gap-1">
                    {col.name}
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
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}
                style={{ borderBottom: '1px solid var(--c-border)' }}
                className="transition-colors hover:bg-[var(--c-hover)]">
                {columns.map(col => (
                  <td key={col.id} className="px-4 py-2.5" style={{ color: 'var(--c-t2)' }}>
                    <CellValue control={col} row={row} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  /* display_mode none (30) → no collapsible header, content always visible */
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
