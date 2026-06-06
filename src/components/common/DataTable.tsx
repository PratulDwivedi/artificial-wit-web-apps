'use client'

import { Fragment, useState, useMemo, useEffect, useRef } from 'react'
import {
  Search, Download, SlidersHorizontal,
  ChevronLeft, ChevronRight, X, Loader2,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Column<T> {
  key:          string
  label:        string
  filterValue?: (row: T) => string   // enables column in filter panel
  exportValue?: (row: T) => string   // enables column in CSV export
}

interface DataTableProps<T extends object> {
  columns:            Column<T>[]
  rows:               T[]
  loading:            boolean
  searchPlaceholder?: string
  searchFields?:      (row: T) => string   // text searched when typing
  exportFilename?:    string               // omit to hide export button
  emptyIcon:          React.ReactNode
  emptyTitle:         string
  emptyDescription:   string
  onAddClick?:        () => void
  addLabel?:          string
  renderRow:          (row: T, index: number) => React.ReactNode
}

const PAGE_SIZE = 20

// ── Component ──────────────────────────────────────────────────────────────────

export function DataTable<T extends object>({
  columns, rows, loading,
  searchPlaceholder = 'Search...',
  searchFields,
  exportFilename,
  emptyIcon, emptyTitle, emptyDescription,
  onAddClick, addLabel,
  renderRow,
}: DataTableProps<T>) {
  const [search,      setSearch]      = useState('')
  const [filters,     setFilters]     = useState<Record<string, string[]>>({})
  const [filterOpen,  setFilterOpen]  = useState(false)
  const [activeCol,   setActiveCol]   = useState<string | null>(null)
  const [page,        setPage]        = useState(1)
  const filterRef = useRef<HTMLDivElement>(null)

  const filterableCols = useMemo(() => columns.filter(c => c.filterValue), [columns])

  // Unique values per filterable column derived from full rows
  const uniqueValues = useMemo(() => {
    const map: Record<string, string[]> = {}
    for (const col of filterableCols) {
      const vals = new Set<string>()
      for (const row of rows) {
        const v = col.filterValue!(row)
        if (v) vals.add(v)
      }
      map[col.key] = Array.from(vals).sort()
    }
    return map
  }, [rows, filterableCols])

  // Apply search + column filters
  const filtered = useMemo(() => {
    let result = rows
    if (search && searchFields) {
      const q = search.toLowerCase()
      result = result.filter(row => searchFields(row).toLowerCase().includes(q))
    }
    const active = Object.entries(filters).filter(([, v]) => v.length > 0)
    if (active.length > 0) {
      result = result.filter(row =>
        active.every(([key, vals]) => {
          const col = columns.find(c => c.key === key)
          return col?.filterValue ? vals.includes(col.filterValue(row)) : true
        })
      )
    }
    return result
  }, [rows, search, filters, columns, searchFields])

  const activeFilterCount = useMemo(
    () => Object.values(filters).reduce((s, v) => s + v.length, 0),
    [filters]
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to page 1 when search or filters change
  useEffect(() => setPage(1), [search, filters])

  // Auto-select first filterable column when filter panel opens
  useEffect(() => {
    if (filterOpen && !activeCol && filterableCols.length > 0)
      setActiveCol(filterableCols[0].key)
  }, [filterOpen, activeCol, filterableCols])

  // Close filter panel on outside click
  useEffect(() => {
    if (!filterOpen) return
    const h = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node))
        setFilterOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [filterOpen])

  const toggleFilter = (colKey: string, val: string) => {
    setFilters(prev => {
      const curr = prev[colKey] ?? []
      return { ...prev, [colKey]: curr.includes(val) ? curr.filter(v => v !== val) : [...curr, val] }
    })
  }

  const clearFilters = () => setFilters({})

  const downloadCSV = () => {
    const expCols = columns.filter(c => c.exportValue)
    if (!expCols.length || !exportFilename) return
    const header = expCols.map(c => `"${c.label}"`).join(',')
    const body   = filtered.map(row =>
      expCols.map(c => `"${(c.exportValue!(row) ?? '').replace(/"/g, '""')}"`).join(',')
    )
    const csv  = [header, ...body].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `${exportFilename}.csv`
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const isFiltering = search !== '' || activeFilterCount > 0

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="px-6 py-3 border-b flex-shrink-0 flex items-center gap-2"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>

        {/* Search */}
        <div className="relative" style={{ width: 280 }}>
          <Search size={13}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--c-t4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-xl pl-9 pr-4 py-2 text-[12px] border focus:outline-none transition"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
          />
        </div>

        <div className="flex-1" />

        {/* Filter */}
        {filterableCols.length > 0 && (
          <div className="relative" ref={filterRef}>
            <button
              onClick={() => setFilterOpen(o => !o)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition"
              style={{
                background:  activeFilterCount ? 'var(--c-primary-light)' : 'var(--c-hover)',
                borderColor: activeFilterCount ? 'var(--c-primary)'       : 'var(--c-border-strong)',
                color:       activeFilterCount ? 'var(--c-primary)'       : 'var(--c-t3)',
              }}>
              <SlidersHorizontal size={13} />
              Filter
              {activeFilterCount > 0 && (
                <span
                  className="ml-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1"
                  style={{ background: 'var(--c-primary)', color: 'white' }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-30 rounded-2xl border shadow-2xl flex overflow-hidden"
                style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)', width: 360, minHeight: 220 }}>

                {/* Column sidebar */}
                <div className="flex flex-col border-r py-2 shrink-0"
                  style={{ width: 140, borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--c-t5)' }}>Columns</p>

                  {filterableCols.map(col => {
                    const cnt      = filters[col.key]?.length ?? 0
                    const isActive = activeCol === col.key
                    return (
                      <button key={col.key}
                        onClick={() => setActiveCol(col.key)}
                        className="flex items-center justify-between px-3 py-2 text-[12px] text-left transition"
                        style={{
                          background: isActive ? 'var(--c-active)' : 'transparent',
                          color:      cnt > 0  ? 'var(--c-primary)' : 'var(--c-t2)',
                          fontWeight: cnt > 0  ? 600 : undefined,
                        }}>
                        <span className="truncate">{col.label}</span>
                        {cnt > 0 && (
                          <span
                            className="ml-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[9px] font-bold px-1 shrink-0"
                            style={{ background: 'var(--c-primary)', color: 'white' }}>
                            {cnt}
                          </span>
                        )}
                      </button>
                    )
                  })}

                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters}
                      className="mx-2 mt-auto mb-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition"
                      style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.15)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.08)' }}>
                      Clear all
                    </button>
                  )}
                </div>

                {/* Values panel */}
                <div className="flex-1 overflow-y-auto">
                  {!activeCol ? (
                    <p className="px-4 py-8 text-[12px] text-center" style={{ color: 'var(--c-t5)' }}>
                      Select a column
                    </p>
                  ) : (
                    <>
                      <div className="px-3 pt-2 pb-1 flex items-center justify-between">
                        <p className="text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: 'var(--c-t5)' }}>Values</p>
                        {(filters[activeCol]?.length ?? 0) > 0 && (
                          <button
                            onClick={() => setFilters(prev => ({ ...prev, [activeCol]: [] }))}
                            className="text-[10px] transition hover:opacity-70"
                            style={{ color: 'var(--c-primary)' }}>
                            Clear
                          </button>
                        )}
                      </div>
                      {(uniqueValues[activeCol] ?? []).length === 0 ? (
                        <p className="px-3 py-2 text-[12px]" style={{ color: 'var(--c-t5)' }}>No values</p>
                      ) : (
                        (uniqueValues[activeCol] ?? []).map(val => {
                          const checked = (filters[activeCol] ?? []).includes(val)
                          return (
                            <label key={val}
                              className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer transition hover:bg-[var(--c-hover)]">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleFilter(activeCol, val)}
                                className="rounded flex-shrink-0"
                                style={{ accentColor: 'var(--c-primary)', width: 13, height: 13 }}
                              />
                              <span className="text-[12px] truncate" style={{ color: 'var(--c-t2)' }}>{val}</span>
                            </label>
                          )
                        })
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Export */}
        {exportFilename && (
          <button
            onClick={downloadCSV}
            title="Export to CSV"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[12px] font-medium transition"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
            <Download size={13} />
            Export
          </button>
        )}

        {/* Pagination */}
        <div className="flex items-center rounded-xl overflow-hidden border"
          style={{ borderColor: 'var(--c-border-strong)' }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-2.5 py-2 transition hover:bg-[var(--c-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--c-t3)' }}>
            <ChevronLeft size={13} />
          </button>
          <span
            className="px-3 text-[12px] font-medium border-x"
            style={{ color: 'var(--c-t2)', borderColor: 'var(--c-border-strong)', minWidth: 56, textAlign: 'center' }}>
            {filtered.length === 0 ? '—' : `${safePage} / ${totalPages}`}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-2.5 py-2 transition hover:bg-[var(--c-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ color: 'var(--c-t3)' }}>
            <ChevronRight size={13} />
          </button>
        </div>
      </div>

      {/* ── Active filter chips ──────────────────────────────────────────────── */}
      {activeFilterCount > 0 && (
        <div className="px-6 py-2 border-b flex items-center gap-2 flex-wrap flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
          {Object.entries(filters).flatMap(([colKey, vals]) =>
            vals.map(val => {
              const col = columns.find(c => c.key === colKey)
              return (
                <span key={`${colKey}:${val}`}
                  className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-0.5 rounded-lg text-[11px] font-medium border"
                  style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)', borderColor: 'var(--c-primary)' }}>
                  <span className="opacity-60 text-[10px]">{col?.label}:</span>
                  {val}
                  <button onClick={() => toggleFilter(colKey, val)}
                    className="ml-0.5 hover:opacity-70 transition flex-shrink-0">
                    <X size={11} />
                  </button>
                </span>
              )
            })
          )}
          <button onClick={clearFilters}
            className="text-[11px] px-2 py-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            Clear all
          </button>
        </div>
      )}

      {/* ── Table area ──────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--c-panel)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--c-hover)' }}>
              {emptyIcon}
            </div>
            <div>
              <p className="text-[14px] font-medium" style={{ color: 'var(--c-t2)' }}>
                {isFiltering ? 'No results match your search' : emptyTitle}
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                {isFiltering ? 'Try adjusting the search or filters.' : emptyDescription}
              </p>
            </div>
            {!isFiltering && onAddClick && addLabel && (
              <button onClick={onAddClick}
                className="px-4 py-2 btn-primary text-[12px] font-medium rounded-xl transition">
                {addLabel}
              </button>
            )}
          </div>

        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b sticky top-0 z-10"
                style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
                <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider w-14"
                  style={{ color: 'var(--c-t4)' }}>#</th>
                {columns.map(col => (
                  <th key={col.key}
                    className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--c-t4)' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const rowKey = ('id' in row ? String((row as Record<string, unknown>).id) : null) ?? String((safePage - 1) * PAGE_SIZE + i)
                const globalIdx = (safePage - 1) * PAGE_SIZE + i + 1
                return (
                  <Fragment key={rowKey}>
                    {renderRow(row, globalIdx)}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
