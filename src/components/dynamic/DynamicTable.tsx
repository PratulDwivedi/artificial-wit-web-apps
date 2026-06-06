'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import type { PageSection, RpcEnvelope } from '@/lib/schema'

interface Props {
  section: PageSection
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

export function DynamicTable({ section }: Props) {
  const { section_display_modes, control_display_modes } = APP_CONSTANTS

  const [rows,     setRows]     = useState<Row[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [expanded, setExpanded] = useState(
    section.display_mode_id !== section_display_modes.collapse
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
        if (env?.is_success) setRows(env.data ?? [])
        else setError(env?.message ?? 'Failed to load data')
      })
      .finally(() => setLoading(false))
  // Fetch once when section first expands
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.binding_name, expanded])

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>

      {/* Section header */}
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-[var(--c-hover)]"
        style={{ borderBottom: expanded ? '1px solid var(--c-border)' : 'none', background: 'var(--c-topbar)' }}>
        {expanded
          ? <ChevronDown  size={13} style={{ color: 'var(--c-t4)' }} />
          : <ChevronRight size={13} style={{ color: 'var(--c-t4)' }} />}
        <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
          {section.name}
        </span>
        {!loading && rows.length > 0 && (
          <span className="ml-auto text-[11px] tabular-nums" style={{ color: 'var(--c-t5)' }}>
            {rows.length} record{rows.length !== 1 ? 's' : ''}
          </span>
        )}
      </button>

      {expanded && (
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
                      {col.name}
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
      )}
    </div>
  )
}
