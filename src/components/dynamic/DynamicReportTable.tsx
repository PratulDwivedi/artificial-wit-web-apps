'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { resolveIcon } from '@/lib/icons'
import type { PageSection, PageSchema, RpcEnvelope } from '@/lib/schema'

type Row = Record<string, unknown>

interface Props {
  section:     PageSection
  schema:      PageSchema
  viewTrigger?: number
}

/** Resolve a dot-notation path from a row object: "category.name" → row.category?.name */
function resolvePath(row: Row, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur != null && typeof cur === 'object') return (cur as Row)[key]
    return undefined
  }, row)
}

/** Substitute {field} placeholders in a URL template using row values */
function buildUrl(template: string, row: Row): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(row[key] ?? ''))
}

// ── Action cell ───────────────────────────────────────────────────────────────

function ActionCell({ control, row }: { control: PageSection['controls'][number]; row: Row }) {
  const router = useRouter()
  const template = (control.data?.default_value as string) ?? '#'
  const href     = buildUrl(template, row)
  const iconName = control.data?.item_icon as string | undefined
  const color    = (control.data?.item_color as string) ?? 'var(--c-primary)'
  const Icon     = resolveIcon(iconName)

  return (
    <button
      type="button"
      onClick={() => router.push(href)}
      title={control.name}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition border"
      style={{ color, borderColor: `${color}40`, background: `${color}10` }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      <Icon size={12} />
      {control.name}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DynamicReportTable({ section, schema, viewTrigger = 0 }: Props) {
  const { section_display_modes, control_display_modes, control_types } = APP_CONSTANTS

  const [rows,    setRows]    = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const isNoneMode = section.display_mode_id === section_display_modes.none
  const [expanded, setExpanded] = useState(
    isNoneMode || section.display_mode_id !== section_display_modes.collapse
  )

  // All controls sorted — hidden ones still available for buildUrl substitution
  const allControls = [...(section.controls ?? [])].sort((a, b) => a.display_order - b.display_order)

  // Visible columns (not none_hidden)
  const columns = allControls.filter(c => c.display_mode_id !== control_display_modes.none_hidden)

  // Action control types
  const ACTION_TYPES = new Set<number>([control_types.hyperlink, control_types.hyperlinkRow])

  useEffect(() => {
    if (!schema.binding_name_get || !expanded) return
    setLoading(true); setError(null)
    HttpHelper.rpc(schema.binding_name_get, {})
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        const env = data as unknown as RpcEnvelope<Row[]>
        if (env?.is_success) setRows(Array.isArray(env.data) ? env.data : [])
        else setError(env?.message ?? 'Failed to load data')
      })
      .finally(() => setLoading(false))
  // viewTrigger: re-fetch on View button click; expanded: fetch on first expand
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema.binding_name_get, expanded, viewTrigger])

  const tableBody = (
    <div className="overflow-x-auto">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
        </div>
      ) : error ? (
        <p className="p-4 text-[12px]" style={{ color: '#ef4444' }}>{error}</p>
      ) : rows.length === 0 ? (
        <p className="p-6 text-[13px] text-center" style={{ color: 'var(--c-t5)' }}>No records found</p>
      ) : (
        <table className="w-full text-[12px] border-collapse">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-hover)' }}>
              {columns.map(col => (
                <th key={col.id}
                  className="px-4 py-2.5 text-left font-semibold whitespace-nowrap"
                  style={{ color: 'var(--c-t3)' }}>
                  {ACTION_TYPES.has(col.control_type_id) ? '' : col.name}
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
                  <td key={col.id} className="px-4 py-2" style={{ color: 'var(--c-t2)' }}>
                    {ACTION_TYPES.has(col.control_type_id) ? (
                      <ActionCell control={col} row={row} />
                    ) : (
                      (() => {
                        const val = resolvePath(row, col.binding_name)
                        if (val === null || val === undefined)
                          return <span style={{ color: 'var(--c-t5)' }}>—</span>
                        if (typeof val === 'boolean')
                          return <span style={{ color: val ? '#16a34a' : 'var(--c-t5)' }}>{val ? '✓' : '—'}</span>
                        return <>{String(val)}</>
                      })()
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )

  if (isNoneMode) return <>{tableBody}</>

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-[var(--c-hover)]"
        style={{ borderBottom: expanded ? '1px solid var(--c-border)' : 'none', background: 'var(--c-topbar)' }}>
        {expanded
          ? <ChevronDown  size={13} style={{ color: 'var(--c-t4)' }} />
          : <ChevronRight size={13} style={{ color: 'var(--c-t4)' }} />}
        <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
          {section.name}
        </span>
        {loading && expanded && (
          <Loader2 size={12} className="ml-auto animate-spin" style={{ color: 'var(--c-t4)' }} />
        )}
      </button>
      {expanded && tableBody}
    </div>
  )
}
