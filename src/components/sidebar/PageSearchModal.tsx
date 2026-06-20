'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { FileText, Search, X } from 'lucide-react'
import { resolveIcon } from '@/lib/icons'
import type { PageItem } from './DynamicSidebar'

// ── Flatten sidebar tree to searchable leaf pages ─────────────────────────────

interface FlatPage {
  id:         number
  name:       string
  route_name: string
  item_icon:  string | null
  item_color: string | null
  breadcrumb: string
  descr:      string | null
}

function flattenPages(items: PageItem[], ancestors: string[] = []): FlatPage[] {
  const result: FlatPage[] = []
  for (const item of [...items].sort((a, b) => a.display_order - b.display_order)) {
    const hasChildren = item.children && item.children.length > 0
    if (!hasChildren && item.route_name) {
      result.push({
        id:         item.id,
        name:       item.name,
        route_name: item.route_name,
        item_icon:  item.data?.item_icon ?? null,
        item_color: item.data?.item_color ?? null,
        breadcrumb: ancestors.join(' › '),
        descr:      item.descr,
      })
    }
    if (hasChildren) {
      result.push(...flattenPages(item.children, [...ancestors, item.name]))
    }
  }
  return result
}

// ── PageSearchModal ───────────────────────────────────────────────────────────

interface Props {
  pages:   PageItem[]
  onClose: () => void
}

export function PageSearchModal({ pages, onClose }: Props) {
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const router   = useRouter()

  const flatPages = flattenPages(pages)

  // Auto-focus on open
  useEffect(() => { inputRef.current?.focus() }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const q = search.trim().toLowerCase()
  const filtered = q
    ? flatPages.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.breadcrumb.toLowerCase().includes(q) ||
        (p.descr ?? '').toLowerCase().includes(q)
      )
    : flatPages

  function navigate(route: string) {
    router.push(`/${route}`)
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b"
          style={{ borderColor: 'var(--c-border)' }}>
          <Search size={16} className="shrink-0" style={{ color: 'var(--c-t4)' }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search menu items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-transparent outline-none text-[14px] placeholder:text-[var(--c-t5)]"
            style={{ color: 'var(--c-t1)' }}
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Results list */}
        <div className="overflow-y-auto" style={{ maxHeight: '60vh' }}>
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Search size={22} className="mx-auto mb-2" style={{ color: 'var(--c-t5)' }} />
              <p className="text-[13px]" style={{ color: 'var(--c-t4)' }}>No results for &ldquo;{search}&rdquo;</p>
            </div>
          ) : (
            <div className="py-1.5 px-1.5 flex flex-col gap-0.5">
              {filtered.map(page => {
                const Icon = resolveIcon(page.item_icon, FileText)
                return (
                  <button
                    key={page.id}
                    type="button"
                    onClick={() => navigate(page.route_name)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition w-full"
                    style={{ color: 'var(--c-t1)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'var(--c-active)' }}>
                      <Icon size={13} style={{ color: page.item_color ?? 'var(--c-primary)' }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium truncate" style={{ color: 'var(--c-t1)' }}>
                        {page.name}
                      </p>
                      {(page.breadcrumb || page.descr) && (
                        <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>
                          {[page.breadcrumb, page.descr].filter(Boolean).join(' — ')}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] font-mono shrink-0 ml-2" style={{ color: 'var(--c-t5)' }}>
                      /{page.route_name}
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t flex items-center justify-between"
          style={{ borderColor: 'var(--c-border)' }}>
          <span className="text-[11px]" style={{ color: 'var(--c-t5)' }}>
            {q ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : `${flatPages.length} pages`}
          </span>
          <span className="text-[10px]" style={{ color: 'var(--c-t5)' }}>esc to close</span>
        </div>
      </div>
    </div>,
    document.body
  )
}
