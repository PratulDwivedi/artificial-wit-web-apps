'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronDown, ChevronRight, Loader2,
  ChevronUp, ChevronsUpDown,
  Search, Filter, Download, X,
  ChevronLeft, FileSpreadsheet,
  Pencil, Plus, Trash2,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import { resolveIcon } from '@/lib/icons'
import type { PageSection, PageSchema, RpcEnvelope } from '@/lib/schema'
import AccessControl from '@/components/common/AccessControl'
import type { AccessControlValue } from '@/components/common/AccessControl'
import { ShieldCheck, Globe, Lock } from 'lucide-react'
import { DynamicViewRecord } from '@/components/common/DynamicViewRecord'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

type Row = Record<string, unknown>
type SortDir = 'asc' | 'desc'

interface Props {
  section:          PageSection
  schema:           PageSchema
  viewTrigger?:     number
  onRecordSelect?:  (id: string, url: string) => void
}

function resolvePath(row: Row, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur != null && typeof cur === 'object') return (cur as Row)[key]
    return undefined
  }, row)
}

function buildUrl(template: string, row: Row): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(row[key] ?? ''))
}

function cellStr(val: unknown): string {
  if (val == null) return ''
  if (typeof val === 'boolean') return val ? 'true' : 'false'
  if (Array.isArray(val)) {
    return val.map(item =>
      item != null && typeof item === 'object' && 'name' in item
        ? String((item as Record<string, unknown>).name)
        : String(item)
    ).join(', ')
  }
  return String(val)
}

// ── Action cell ───────────────────────────────────────────────────────────────

function ActionCell({ control, row, onRecordSelect, routeName }: {
  control: PageSection['controls'][number]
  row: Row
  onRecordSelect?: (id: string, url: string) => void
  routeName?: string
}) {
  const router   = useRouter()
  const template = (control.data?.default_value as string) ?? '#'
  const href     = buildUrl(template, row)
  const iconName = control.data?.item_icon as string | undefined
  const color    = (control.data?.item_color as string) ?? 'var(--c-primary)'
  const Icon     = resolveIcon(iconName)

  function handleClick() {
    if (onRecordSelect && routeName) {
      try {
        const url = new URL(href, window.location.origin)
        if (url.pathname === `/${routeName}`) {
          const id = url.searchParams.get('id')
          if (id) { onRecordSelect(id, href); return }
        }
      } catch { /* invalid URL — fall through to router.push */ }
    }
    router.push(href)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title={control.name}
      className="inline-flex items-center justify-center p-1 rounded-lg transition"
      style={{ color, background: `${color}10` }}
      onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
      onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
    >
      <Icon size={13} />
    </button>
  )
}

// ── Access control cell ───────────────────────────────────────────────────────

function AccessControlBadge({ value }: { value: AccessControlValue | null }) {
  if (!value?.scope) return <span style={{ color: 'var(--c-t5)' }}>—</span>
  const cfg = {
    private:   { Icon: Lock,        color: '#6b7280', label: 'Private'   },
    protected: { Icon: ShieldCheck, color: '#f59e0b', label: 'Protected' },
    public:    { Icon: Globe,       color: '#16a34a', label: 'Public'    },
  }[value.scope] ?? { Icon: ShieldCheck, color: 'var(--c-t4)', label: value.scope }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold"
      style={{ background: `${cfg.color}18`, color: cfg.color }}>
      <cfg.Icon size={10} />{cfg.label}
    </span>
  )
}

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ col, sortKey, sortDir }: { col: string; sortKey: string; sortDir: SortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={11} style={{ color: 'var(--c-t5)', opacity: 0.5 }} />
  return sortDir === 'asc'
    ? <ChevronUp   size={11} style={{ color: 'var(--c-primary)' }} />
    : <ChevronDown size={11} style={{ color: 'var(--c-primary)' }} />
}

// ── Pagination ────────────────────────────────────────────────────────────────

const PAGE_SIZES = [20, 50, 100, 250]

function Pagination({ page, totalPages, total, pageSize, onPage, onPageSize }: {
  page: number; totalPages: number; total: number; pageSize: number
  onPage: (p: number) => void; onPageSize: (s: number) => void
}) {
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1
  const end   = Math.min(page * pageSize, total)

  const pages: (number | '...')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('...')
    pages.push(totalPages)
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-[11px]"
      style={{ borderTop: '1px solid var(--c-border)', color: 'var(--c-t3)' }}>
      <div className="flex items-center gap-2">
        <span>Rows per page:</span>
        <select
          value={pageSize}
          onChange={e => onPageSize(Number(e.target.value))}
          className="rounded px-1.5 py-0.5 text-[11px] border outline-none"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)', color: 'var(--c-t2)' }}
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span style={{ color: 'var(--c-t4)' }}>{start}–{end} of {total}</span>
      </div>
      <div className="flex items-center gap-1">
        <button disabled={page === 1} onClick={() => onPage(page - 1)}
          className="p-1 rounded transition disabled:opacity-30 hover:bg-[var(--c-hover)]">
          <ChevronLeft size={12} />
        </button>
        {pages.map((p, i) =>
          p === '...'
            ? <span key={`e${i}`} className="px-1">…</span>
            : <button key={p} onClick={() => onPage(p as number)}
                className="min-w-[22px] h-[22px] rounded text-[11px] transition"
                style={{
                  background: p === page ? 'var(--c-primary)' : 'transparent',
                  color:      p === page ? '#fff'              : 'var(--c-t2)',
                }}>
                {p}
              </button>
        )}
        <button disabled={page === totalPages} onClick={() => onPage(page + 1)}
          className="p-1 rounded transition disabled:opacity-30 hover:bg-[var(--c-hover)]">
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function DynamicReportTable({ section, schema, viewTrigger = 0, onRecordSelect }: Props) {
  const { section_display_modes, control_display_modes, control_types } = APP_CONSTANTS
  const router   = useRouter()
  const editMode = useAppStore(s => s.editMode)

  const [rows,    setRows]    = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const isNoneMode = section.display_mode_id === section_display_modes.none
  const [expanded, setExpanded] = useState(
    isNoneMode || section.display_mode_id !== section_display_modes.collapse
  )

  // Sort / search / filter / page state
  const [search,      setSearch]      = useState('')
  const [colFilters,  setColFilters]  = useState<Record<string, string>>({})
  const [showFilters, setShowFilters] = useState(false)
  const [sortKey,     setSortKey]     = useState('')
  const [sortDir,     setSortDir]     = useState<SortDir>('asc')
  const [page,        setPage]        = useState(1)
  const [pageSize,    setPageSize]    = useState(20)

  const [acOpen,       setAcOpen]       = useState<{ row: Row; col: PageSection['controls'][number] } | null>(null)
  const [viewRow,      setViewRow]      = useState<Row | null>(null)
  const [deleteRow,    setDeleteRow]    = useState<{ row: Row; bindingName: string } | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [refetchKey,   setRefetchKey]   = useState(0)

  const allControls      = [...(section.controls ?? [])].sort((a, b) => a.display_order - b.display_order)
  const columns          = allControls.filter(c =>
    c.display_mode_id !== control_display_modes.none_hidden || editMode
  )
  const ACTION_TYPES     = new Set<number>([control_types.hyperlink, control_types.hyperlinkRow, control_types.deleteTableRow])

  // hyperlinkRow (33) controls → toolbar bulk-action buttons, never table columns
  const hyperlinkRowCols = columns.filter(c => c.control_type_id === control_types.hyperlinkRow)
  const hasRowSelect     = hyperlinkRowCols.length > 0
  const tableCols        = columns.filter(c => c.control_type_id !== control_types.hyperlinkRow)
  const iconTableCols    = tableCols.filter(c => ACTION_TYPES.has(c.control_type_id) || c.control_type_id === control_types.accessControl)
  const regularTableCols = tableCols.filter(c => !ACTION_TYPES.has(c.control_type_id) && c.control_type_id !== control_types.accessControl)
  const dataCols         = regularTableCols

  // Row key field: binding_name of first hyperlinkRow control (typically "id")
  const rowKeyField = hyperlinkRowCols[0]?.binding_name ?? 'id'

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  // Clear selection when data refreshes or search/filter changes
  useEffect(() => { setSelectedKeys(new Set()) }, [rows, search, colFilters])

  function rowKey(row: Row): string { return String(resolvePath(row, rowKeyField) ?? '') }

  function toggleRow(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function colWidth(col: typeof columns[number]): number {
    const explicit = col.data?.width as number | undefined
    if (explicit) return explicit
    const isAction = ACTION_TYPES.has(col.control_type_id)
    const isHidden = col.display_mode_id === control_display_modes.none_hidden
    return (isAction || isHidden) ? 1 : 4
  }
  // pixel bounds for each data column
  function colMinPx(col: typeof columns[number]): number { return colWidth(col) * 40 + 60 }
  function colMaxPx(col: typeof columns[number]): number { return Math.min(320, colWidth(col) * 60 + 80) }
  // Section-level binding_name takes priority; fall back to page-level binding_name_get
  const fetchRpc = section.binding_name ?? schema.binding_name_get

  useEffect(() => {
    if (!fetchRpc || !expanded) return
    setLoading(true); setError(null)
    HttpHelper.rpc(fetchRpc, {})
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        const env = data as unknown as RpcEnvelope<Row[]>
        if (env?.is_success) setRows(Array.isArray(env.data) ? env.data : [])
        else setError(env?.message ?? 'Failed to load data')
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchRpc, expanded, viewTrigger, refetchKey])

  // Reset to page 1 whenever filters / sort / page size change
  useEffect(() => { setPage(1) }, [search, colFilters, sortKey, sortDir, pageSize])

  const processed = useMemo(() => {
    let data = [...rows]

    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(row =>
        dataCols.some(col => cellStr(resolvePath(row, col.binding_name)).toLowerCase().includes(q))
      )
    }

    for (const [key, val] of Object.entries(colFilters)) {
      if (!val.trim()) continue
      const q = val.toLowerCase()
      data = data.filter(row => cellStr(resolvePath(row, key)).toLowerCase().includes(q))
    }

    if (sortKey) {
      data.sort((a, b) => {
        const av = cellStr(resolvePath(a, sortKey))
        const bv = cellStr(resolvePath(b, sortKey))
        const an = Number(av), bn = Number(bv)
        const cmp = (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '')
          ? an - bn
          : av.localeCompare(bv)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }

    return data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, colFilters, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(processed.length / pageSize))
  const pageRows   = processed.slice((page - 1) * pageSize, page * pageSize)

  function handleSort(bindingName: string) {
    if (sortKey === bindingName) {
      // asc → desc → clear
      if (sortDir === 'asc') { setSortDir('desc') }
      else { setSortKey(''); setSortDir('asc') }
    } else {
      setSortKey(bindingName)
      setSortDir('asc')
    }
  }

  function updateColFilter(key: string, val: string) {
    setColFilters(f => ({ ...f, [key]: val }))
  }

  const activeFilterCount = Object.values(colFilters).filter(v => v.trim()).length

  function exportCSV() {
    const headers = dataCols.map(c => `"${c.name.replace(/"/g, '""')}"`)
    const csvRows = [
      headers.join(','),
      ...processed.map(row =>
        dataCols.map(col => {
          const str = cellStr(resolvePath(row, col.binding_name))
          return (str.includes(',') || str.includes('\n') || str.includes('"'))
            ? `"${str.replace(/"/g, '""')}"`
            : str
        }).join(',')
      ),
    ]
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `${section.name ?? 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportXLS() {
    const wsData = [
      dataCols.map(c => c.name),
      ...processed.map(row =>
        dataCols.map(col => {
          const val = resolvePath(row, col.binding_name)
          if (val == null) return ''
          const n = Number(val)
          return (!isNaN(n) && String(val).trim() !== '') ? n : String(val)
        })
      ),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Data')
    XLSX.writeFile(wb, `${section.name ?? 'export'}.xlsx`)
  }

  const toolbar = rows.length > 0 && (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5"
      style={{ borderBottom: '1px solid var(--c-border)' }}>
      {/* Global search */}
      <div className="relative flex-1 min-w-[160px]">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: 'var(--c-t4)' }} />
        <input
          type="text"
          placeholder="Search…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-7 pr-7 py-1.5 rounded-lg text-[12px] border outline-none transition"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)', color: 'var(--c-t1)' }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-50 hover:opacity-100 transition">
            <X size={11} />
          </button>
        )}
      </div>

      {/* Bulk-action buttons (hyperlinkRow controls) */}
      {hyperlinkRowCols.map(ctrl => {
        const Icon     = resolveIcon(ctrl.data?.item_icon as string | undefined)
        const color    = (ctrl.data?.item_color as string) ?? 'var(--c-primary)'
        const disabled = selectedKeys.size === 0
        function handleBulkClick() {
          const template = (ctrl.data?.default_value as string) ?? '#'
          const key      = ctrl.binding_name
          const values   = processed
            .filter(r => selectedKeys.has(rowKey(r)))
            .map(r => String(resolvePath(r, key) ?? ''))
            .join(',')
          router.push(template.replace(/\{(\w+)\}/g, (_, k) => k === key ? values : ''))
        }
        return (
          <button key={ctrl.id} type="button" disabled={disabled} onClick={handleBulkClick}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color, borderColor: `${color}40`, background: `${color}10` }}>
            <Icon size={11} />
            {ctrl.name}
            {selectedKeys.size > 0 && (
              <span className="ml-0.5 px-1 rounded text-[10px] font-bold"
                style={{ background: `${color}25` }}>
                {selectedKeys.size}
              </span>
            )}
          </button>
        )
      })}

      {/* Column filters toggle */}
      <button
        onClick={() => setShowFilters(v => !v)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition"
        style={{
          borderColor: (showFilters || activeFilterCount > 0) ? 'var(--c-primary)' : 'var(--c-border)',
          background:  (showFilters || activeFilterCount > 0) ? 'color-mix(in srgb, var(--c-primary) 10%, transparent)' : 'transparent',
          color:       (showFilters || activeFilterCount > 0) ? 'var(--c-primary)' : 'var(--c-t3)',
        }}
      >
        <Filter size={11} />
        Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
      </button>

      {/* Export buttons */}
      <button onClick={exportCSV} title="Export to CSV"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition hover:bg-[var(--c-hover)]"
        style={{ borderColor: 'var(--c-border)', color: 'var(--c-t3)' }}>
        <Download size={11} />
        CSV
      </button>
      <button onClick={exportXLS} title="Export to Excel"
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] border transition hover:bg-[var(--c-hover)]"
        style={{ borderColor: 'var(--c-border)', color: 'var(--c-t3)' }}>
        <FileSpreadsheet size={11} />
        XLS
      </button>
    </div>
  )

  const tableContent = (
    <>
      {toolbar}
      <div className="overflow-x-auto">
        {rows.length === 0 ? (
          <p className="p-6 text-[13px] text-center" style={{ color: 'var(--c-t5)' }}>No records found</p>
        ) : processed.length === 0 ? (
          <p className="p-6 text-[13px] text-center" style={{ color: 'var(--c-t5)' }}>No records match your search</p>
        ) : (
          <table className="w-max min-w-full text-[12px] border-collapse">
            <colgroup>
              <col style={{ width: '44px', minWidth: '44px' }} />
              {hasRowSelect && <col style={{ width: '40px', minWidth: '40px' }} />}
              {tableCols.map(col => {
                const isAction = ACTION_TYPES.has(col.control_type_id) || col.control_type_id === control_types.accessControl
                return isAction
                  ? <col key={col.id} style={{ width: '32px', minWidth: '32px' }} />
                  : <col key={col.id} style={{ minWidth: `${colMinPx(col)}px`, maxWidth: `${colMaxPx(col)}px`, width: `${colMinPx(col)}px` }} />
              })}
            </colgroup>
            <thead>
              {/* Column headers with sort */}
              <tr style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-hover)' }}>
                <th className="px-3 py-1 text-center font-semibold select-none"
                  style={{ color: 'var(--c-t4)', width: 44 }}>#</th>
                {hasRowSelect && (() => {
                  const pageKeys      = pageRows.map(r => rowKey(r))
                  const allSelected   = pageKeys.length > 0 && pageKeys.every(k => selectedKeys.has(k))
                  const someSelected  = pageKeys.some(k => selectedKeys.has(k))
                  return (
                    <th className="px-3 py-2.5 text-center" style={{ width: 40 }}>
                      <input type="checkbox"
                        checked={allSelected}
                        ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                        onChange={() => {
                          if (allSelected) {
                            setSelectedKeys(prev => { const n = new Set(prev); pageKeys.forEach(k => n.delete(k)); return n })
                          } else {
                            setSelectedKeys(prev => new Set([...prev, ...pageKeys]))
                          }
                        }}
                        className="cursor-pointer"
                        style={{ accentColor: 'var(--c-primary)' }}
                      />
                    </th>
                  )
                })()}
                {tableCols.map(col => {
                  const isAction = ACTION_TYPES.has(col.control_type_id) || col.control_type_id === control_types.accessControl
                  const isHidden = col.display_mode_id === control_display_modes.none_hidden
                  if (isAction) {
                    return (
                      <th key={col.id} className="text-center" style={{ color: 'var(--c-t4)', width: 32, padding: 0 }}>
                        {editMode && (
                          <button type="button"
                            onClick={() => router.push(`/page_section_control?id=${col.id}`)}
                            className="p-0.5 rounded transition opacity-40 hover:opacity-100 hover:bg-[var(--c-hover)]"
                            title={`Edit: ${col.name}`}>
                            <Pencil size={10} />
                          </button>
                        )}
                      </th>
                    )
                  }
                  return (
                    <th key={col.id}
                      className="px-3 py-1 text-left font-semibold overflow-hidden"
                      style={{ color: 'var(--c-t3)', maxWidth: `${colMaxPx(col)}px` }}>
                      <div className="flex items-center gap-1 min-w-0">
                        <button type="button"
                          onClick={() => handleSort(col.binding_name)}
                          className="inline-flex items-center gap-1 hover:opacity-80 transition select-none min-w-0"
                          title={col.name}>
                          <span className="truncate">{col.name}</span>
                          {isHidden && (
                            <span className="shrink-0 text-[9px] font-normal px-1 py-0.5 rounded"
                              style={{ background: 'rgba(107,114,128,0.12)', color: 'var(--c-t4)' }}>
                              Hidden
                            </span>
                          )}
                          <SortIcon col={col.binding_name} sortKey={sortKey} sortDir={sortDir} />
                        </button>
                        {editMode && (
                          <button type="button"
                            onClick={() => router.push(`/page_section_control?id=${col.id}`)}
                            className="shrink-0 p-0.5 rounded transition opacity-40 hover:opacity-100 hover:bg-[var(--c-hover)]"
                            title="Edit control">
                            <Pencil size={10} />
                          </button>
                        )}
                      </div>
                    </th>
                  )
                })}
              </tr>

              {/* Per-column filter inputs */}
              {showFilters && (
                <tr style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-panel)' }}>
                  <th style={{ width: 44 }} />
                  {hasRowSelect && <th style={{ width: 40 }} />}
                  {tableCols.map(col => {
                    const isAction = ACTION_TYPES.has(col.control_type_id) || col.control_type_id === control_types.accessControl
                    if (isAction) return <th key={col.id} style={{ width: 32, padding: 0 }} />
                    return (
                      <th key={col.id} className="px-2 py-1.5 font-normal overflow-hidden"
                        style={{ maxWidth: `${colMaxPx(col)}px` }}>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="Filter…"
                            value={colFilters[col.binding_name] ?? ''}
                            onChange={e => updateColFilter(col.binding_name, e.target.value)}
                            className="w-full px-2 pr-6 py-1 rounded text-[11px] border outline-none"
                            style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', color: 'var(--c-t1)' }}
                          />
                          {colFilters[col.binding_name] && (
                            <button onClick={() => updateColFilter(col.binding_name, '')}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80 transition">
                              <X size={9} />
                            </button>
                          )}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              )}
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const key       = rowKey(row)
                const isChecked = selectedKeys.has(key)
                const rowIndex  = (page - 1) * pageSize + i + 1
                return (
                  <tr key={i}
                    style={{ borderBottom: '1px solid var(--c-border)', cursor: 'pointer' }}
                    className="transition-colors hover:bg-[var(--c-hover)]"
                    onClick={() => setViewRow(row)}>
                    <td className="px-3 py-0.5 text-center select-none"
                      style={{ color: 'var(--c-t5)', width: 44 }}>{rowIndex}</td>
                    {hasRowSelect && (
                      <td className="px-3 py-0.5 text-center" style={{ width: 40 }}
                        onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isChecked}
                          onChange={() => toggleRow(key)}
                          className="cursor-pointer"
                          style={{ accentColor: 'var(--c-primary)' }}
                        />
                      </td>
                    )}
                    {tableCols.map(col => {
                      if (col.control_type_id === control_types.accessControl) {
                        const ac = resolvePath(row, col.binding_name) as { scope?: string; roles?: number[] } | null
                        const color = ac?.scope === 'public' ? '#16a34a' : ac?.scope === 'protected' ? '#f59e0b' : '#6b7280'
                        const AcIcon = resolveIcon(col.data?.item_icon as string | undefined, ShieldCheck)
                        return (
                          <td key={col.id} className="text-center" style={{ width: 32, padding: 0 }}
                            onClick={e => e.stopPropagation()}>
                            <button type="button"
                              onClick={() => setAcOpen({ row, col })}
                              title={col.name}
                              className="inline-flex items-center justify-center p-1 rounded-lg transition"
                              style={{ color, background: `${color}10` }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                              <AcIcon size={13} />
                            </button>
                          </td>
                        )
                      }
                      if (col.control_type_id === control_types.deleteTableRow) {
                        return (
                          <td key={col.id} className="text-center" style={{ width: 32, padding: 0 }}
                            onClick={e => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => setDeleteRow({ row, bindingName: col.binding_name })}
                              className="inline-flex items-center justify-center p-1 rounded-lg transition"
                              style={{ color: '#ef4444', background: 'rgba(239,68,68,0.08)' }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )
                      }
                      if (ACTION_TYPES.has(col.control_type_id)) {
                        return (
                          <td key={col.id} className="text-center" style={{ width: 32, padding: 0 }}
                            onClick={e => e.stopPropagation()}>
                            <ActionCell control={col} row={row} onRecordSelect={onRecordSelect} routeName={schema.route_name} />
                          </td>
                        )
                      }
                      const val = resolvePath(row, col.binding_name)
                      const str = cellStr(val)
                      return (
                        <td key={col.id} className="px-3 py-0.5 overflow-hidden"
                          style={{ color: 'var(--c-t2)', maxWidth: `${colMaxPx(col)}px` }}>
                          <div className="truncate" title={str || undefined}>
                            {val === null || val === undefined
                              ? <span style={{ color: 'var(--c-t5)' }}>—</span>
                              : typeof val === 'boolean'
                              ? <span style={{ color: val ? '#16a34a' : 'var(--c-t5)' }}>{val ? '✓' : '—'}</span>
                              : str}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {processed.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={processed.length}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      )}
    </>
  )

  const loadingEl = (
    <div className="flex items-center justify-center py-10">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  )

  const errorEl = (
    <p className="p-4 text-[12px]" style={{ color: '#ef4444' }}>{error}</p>
  )

  const body = loading ? loadingEl : error ? errorEl : tableContent

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
      {body}
      <ConfirmDialog
        open={!!deleteRow}
        title="Delete record"
        message={`Delete "${String(deleteRow?.row.full_name ?? deleteRow?.row.name ?? deleteRow?.row.email ?? `record #${deleteRow?.row.id}`)}"? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
        onConfirm={() => {
          if (!deleteRow) return
          setDeleting(true)
          HttpHelper.rpc(deleteRow.bindingName, { p_id: Number(resolvePath(deleteRow.row, rowKeyField)) })
            .then(({ data }) => {
              const env = data as { is_success?: boolean } | null
              if (env?.is_success) {
                setRows(prev => prev.filter(r =>
                  String(resolvePath(r, rowKeyField)) !== String(resolvePath(deleteRow.row, rowKeyField))
                ))
              }
              setDeleteRow(null)
            })
            .finally(() => setDeleting(false))
        }}
        onCancel={() => setDeleteRow(null)}
      />
      {acOpen && (
        <AccessControl
          resourceName={String(resolvePath(acOpen.row, 'name') ?? resolvePath(acOpen.row, 'title') ?? `Record #${resolvePath(acOpen.row, 'id')}`)}
          recordId={Number(resolvePath(acOpen.row, 'id') ?? 0)}
          routeName={schema.route_name}
          pageId={schema.id}
          accessControl={resolvePath(acOpen.row, acOpen.col.binding_name) as { scope?: string; roles?: number[] } | undefined}
          onClose={() => setAcOpen(null)}
          onSaved={() => {
            setAcOpen(null)
            setRefetchKey(k => k + 1)
          }}
        />
      )}
      {viewRow && (
        <DynamicViewRecord
          row={viewRow}
          controls={dataCols}
          title={section.name}
          onClose={() => setViewRow(null)}
        />
      )}
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
          {loading && expanded && (
            <Loader2 size={12} className="ml-2 animate-spin" style={{ color: 'var(--c-t4)' }} />
          )}
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
      {expanded && body}

      <ConfirmDialog
        open={!!deleteRow}
        title="Delete record"
        message={`Delete "${String(deleteRow?.row.full_name ?? deleteRow?.row.name ?? deleteRow?.row.email ?? `record #${deleteRow?.row.id}`)}"? This cannot be undone.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        variant="danger"
        onConfirm={() => {
          if (!deleteRow) return
          setDeleting(true)
          HttpHelper.rpc(deleteRow.bindingName, { p_id: Number(resolvePath(deleteRow.row, rowKeyField)) })
            .then(({ data }) => {
              const env = data as { is_success?: boolean } | null
              if (env?.is_success) {
                setRows(prev => prev.filter(r =>
                  String(resolvePath(r, rowKeyField)) !== String(resolvePath(deleteRow.row, rowKeyField))
                ))
              }
              setDeleteRow(null)
            })
            .finally(() => setDeleting(false))
        }}
        onCancel={() => setDeleteRow(null)}
      />
      {acOpen && (
        <AccessControl
          resourceName={String(resolvePath(acOpen.row, 'name') ?? resolvePath(acOpen.row, 'title') ?? `Record #${resolvePath(acOpen.row, 'id')}`)}
          recordId={Number(resolvePath(acOpen.row, 'id') ?? 0)}
          routeName={schema.route_name}
          pageId={schema.id}
          accessControl={resolvePath(acOpen.row, acOpen.col.binding_name) as { scope?: string; roles?: number[] } | undefined}
          onClose={() => setAcOpen(null)}
          onSaved={() => {
            setAcOpen(null)
            setRefetchKey(k => k + 1)
          }}
        />
      )}
      {viewRow && (
        <DynamicViewRecord
          row={viewRow}
          controls={dataCols}
          title={section.name}
          onClose={() => setViewRow(null)}
        />
      )}
    </div>
  )
}
