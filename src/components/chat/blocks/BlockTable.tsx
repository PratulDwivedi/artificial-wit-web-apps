'use client'

import { useState, useMemo } from 'react'
import { Search, ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, Download } from 'lucide-react'
import type { TableBlock } from './types'

function downloadCSV(block: TableBlock) {
  const cols   = block.columns ?? []
  const brows  = block.rows ?? []
  const header = cols.map(c => `"${c.label}"`).join(',')
  const rows   = brows.map(r => cols.map(c => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','))
  const blob   = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a'); a.href = url; a.download = `${block.title}.csv`; a.click()
  URL.revokeObjectURL(url)
}

function downloadXLS(block: TableBlock) {
  const cols   = block.columns ?? []
  const brows  = block.rows ?? []
  const header = cols.map(c => c.label).join('\t')
  const rows   = brows.map(r => cols.map(c => String(r[c.key] ?? '')).join('\t'))
  const blob   = new Blob([[header, ...rows].join('\n')], { type: 'application/vnd.ms-excel' })
  const url    = URL.createObjectURL(blob)
  const a      = document.createElement('a'); a.href = url; a.download = `${block.title}.xls`; a.click()
  URL.revokeObjectURL(url)
}

const PAGE_SIZE = 10

type SortDir = 'asc' | 'desc' | null

export default function BlockTable({ block }: { block: TableBlock }) {
  const [search,  setSearch]  = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page,    setPage]    = useState(1)

  const rows    = block.rows    ?? []
  const columns = block.columns ?? []

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row =>
      columns.some(col => String(row[col.key] ?? '').toLowerCase().includes(q))
    )
  }, [rows, columns, search])

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      const av = String(a[sortKey] ?? '')
      const bv = String(b[sortKey] ?? '')
      const n  = Number(av) - Number(bv)
      const cmp = !isNaN(n) && av !== '' && bv !== '' ? n : av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage   = Math.min(page, totalPages)
  const pageRows   = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function toggleSort(key: string) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); setPage(1); return }
    if (sortDir === 'asc')  { setSortDir('desc'); return }
    setSortKey(null); setSortDir(null)
  }

  function SortIcon({ colKey }: { colKey: string }) {
    if (sortKey !== colKey) return <ChevronsUpDown size={11} style={{ color: 'var(--c-t5)' }} />
    if (sortDir === 'asc')  return <ChevronUp      size={11} style={{ color: 'var(--c-primary)' }} />
    return                         <ChevronDown     size={11} style={{ color: 'var(--c-primary)' }} />
  }

  return (
    <div className="rounded-xl border mt-2 flex flex-col"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)', maxHeight: 420 }}>

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b flex-shrink-0 flex-wrap"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <span className="text-[12px] font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--c-t1)' }}>
          {block.title}
        </span>
        {block.totalRows !== undefined && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0"
            style={{ background: 'var(--c-hover)', color: 'var(--c-t4)' }}>
            {block.totalRows} rows
          </span>
        )}
        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ color: 'var(--c-t5)' }} />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search…"
            className="pl-6 pr-2 py-1 text-[11px] rounded-lg border w-28 focus:outline-none"
            style={{ background: 'var(--c-base)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
          />
        </div>
        {/* Download */}
        <button onClick={() => downloadCSV(block)} title="Download CSV"
          className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition hover:bg-[var(--c-hover)] flex-shrink-0"
          style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
          <Download size={10} /> CSV
        </button>
        <button onClick={() => downloadXLS(block)} title="Download XLS"
          className="flex items-center gap-1 px-2 py-1 rounded-lg border text-[10px] font-medium transition hover:bg-[var(--c-hover)] flex-shrink-0"
          style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
          <Download size={10} /> XLS
        </button>
      </div>

      {/* Scrollable table */}
      <div className="overflow-auto flex-1">
        <table className="w-full" style={{ minWidth: columns.length * 120 }}>
          <thead className="sticky top-0 z-10">
            <tr style={{ background: 'var(--c-topbar)', borderBottom: '1px solid var(--c-border)' }}>
              {columns.map(col => (
                <th key={col.key}
                  className="px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none whitespace-nowrap"
                  style={{ color: sortKey === col.key ? 'var(--c-primary)' : 'var(--c-t4)' }}
                  onClick={() => toggleSort(col.key)}>
                  <span className="flex items-center gap-1">
                    {col.label}
                    <SortIcon colKey={col.key} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}
                  className="px-3 py-4 text-center text-[11px]" style={{ color: 'var(--c-t5)' }}>
                  No results
                </td>
              </tr>
            ) : pageRows.map((row, i) => (
              <tr key={i} className="border-b transition"
                style={{ borderColor: 'var(--c-border)' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                {columns.map(col => (
                  <td key={col.key} className="px-3 py-1.5 text-[11px] whitespace-nowrap"
                    style={{ color: 'var(--c-t2)' }}>
                    {row[col.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
          <span className="text-[11px]" style={{ color: 'var(--c-t5)' }}>
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              className="p-1 rounded disabled:opacity-30 hover:bg-[var(--c-hover)] transition">
              <ChevronLeft size={13} style={{ color: 'var(--c-t3)' }} />
            </button>
            <span className="text-[11px] px-1" style={{ color: 'var(--c-t3)' }}>
              {safePage} / {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="p-1 rounded disabled:opacity-30 hover:bg-[var(--c-hover)] transition">
              <ChevronRight size={13} style={{ color: 'var(--c-t3)' }} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
