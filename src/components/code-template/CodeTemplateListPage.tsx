'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Menu, Plus, Search, X, Loader2, Trash2, Pencil, LayoutTemplate,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import { NotificationBadge } from '@/components/common/NotificationBadge'
import type { LabelTemplate } from '@/lib/label-template'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TemplateRow {
  id:         number
  name:       string
  page_id:    number | null
  canvas:     LabelTemplate | null
  is_active:  boolean
  created_at: string
  updated_at: string | null
}

// ── Mini canvas thumbnail ─────────────────────────────────────────────────────

function CanvasThumbnail({ tmpl }: { tmpl: LabelTemplate | null }) {
  const config = tmpl?.canvas
  if (!config) return (
    <div className="absolute inset-0 flex items-center justify-center"
      style={{ background: 'var(--c-hover)' }}>
      <LayoutTemplate size={22} style={{ color: 'var(--c-t5)' }} />
    </div>
  )

  return (
    <div className="absolute inset-0 flex items-center justify-center p-4"
      style={{ background: 'var(--c-base)' }}>
      <div
        className="shadow border"
        style={{
          background:  config.background_color || '#ffffff',
          borderColor: 'rgba(0,0,0,0.12)',
          aspectRatio: `${config.width_mm} / ${config.height_mm}`,
          maxWidth:    '100%',
          maxHeight:   '100%',
        }}
      />
    </div>
  )
}

// ── Delete confirmation dialog ────────────────────────────────────────────────

function DeleteDialog({
  name,
  onConfirm,
  onCancel,
  busy,
}: {
  name:      string
  onConfirm: () => void
  onCancel:  () => void
  busy:      boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="rounded-2xl border p-6 w-full max-w-sm shadow-2xl"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
          style={{ background: 'rgba(239,68,68,0.1)' }}>
          <Trash2 size={18} style={{ color: '#ef4444' }} />
        </div>
        <h3 className="text-[15px] font-semibold mb-1" style={{ color: 'var(--c-t1)' }}>
          Delete Template
        </h3>
        <p className="text-[13px] mb-5" style={{ color: 'var(--c-t3)' }}>
          Delete <span className="font-semibold" style={{ color: 'var(--c-t1)' }}>&ldquo;{name}&rdquo;</span>?
          This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="flex-1 py-2 rounded-xl border text-[13px] font-semibold transition"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy}
            className="flex-1 py-2 rounded-xl text-[13px] font-semibold text-white transition flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: '#ef4444' }}>
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── CodeTemplateListPage ──────────────────────────────────────────────────────

export function CodeTemplateListPage() {
  const [rows,         setRows]         = useState<TemplateRow[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TemplateRow | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)

  const router = useRouter()
  const { setSidebarOpen } = useAppStore()

  const loadTemplates = useCallback((q?: string) => {
    setLoading(true)
    HttpHelper.rpc('fn_get_code_templates', { ...(q ? { p_search: q } : {}) })
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: TemplateRow[] }
        if (env?.is_success) setRows(env.data ?? [])
        else setRows([])
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  // debounced search
  useEffect(() => {
    const t = setTimeout(() => loadTemplates(search || undefined), 300)
    return () => clearTimeout(t)
  }, [search, loadTemplates])

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setErrorMsg(null)
    try {
      const { data, error } = await HttpHelper.rpc('fn_delete_code_template', { p_id: deleteTarget.id })
      if (error) throw new Error(error as string)
      const env = data as unknown as { is_success: boolean; message: string }
      if (!env?.is_success) throw new Error(env?.message ?? 'Delete failed')
      setRows(prev => prev.filter(r => r.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b gap-4"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0"
            style={{ color: 'var(--c-t3)' }}>
            <Menu size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-active)' }}>
            <LayoutTemplate size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div>
            <h1 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--c-t1)' }}>
              Code Templates
            </h1>
            <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>
              QR codes &amp; barcode label designs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => router.push('/code_template?id=new')}
            className="flex items-center gap-1.5 px-4 py-2 btn-primary rounded-xl text-[13px] font-semibold transition">
            <Plus size={14} /> New Template
          </button>
          <NotificationBadge />
        </div>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-3 border-b"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border max-w-sm"
          style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
          <Search size={13} style={{ color: 'var(--c-t4)', flexShrink: 0 }} />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="flex-1 bg-transparent outline-none text-[13px]"
            style={{ color: 'var(--c-t1)' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')}
              className="opacity-50 hover:opacity-100 transition">
              <X size={11} style={{ color: 'var(--c-t4)' }} />
            </button>
          )}
        </div>
      </div>

      {/* Error banner */}
      {errorMsg && (
        <div className="shrink-0 px-6 py-2.5 text-[12px] border-b flex items-center justify-between"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
          {errorMsg}
          <button type="button" onClick={() => setErrorMsg(null)}><X size={12} /></button>
        </div>
      )}

      {/* ── Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--c-hover)' }}>
              <LayoutTemplate size={24} style={{ color: 'var(--c-t5)' }} />
            </div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t2)' }}>
              {search ? 'No matching templates' : 'No templates yet'}
            </p>
            {!search && (
              <button type="button" onClick={() => router.push('/code_template?id=new')}
                className="flex items-center gap-1.5 px-4 py-2 btn-primary rounded-xl text-[13px] font-semibold mt-1">
                <Plus size={13} /> Create your first template
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {rows.map(row => (
              <div key={row.id}
                className="rounded-2xl border overflow-hidden flex flex-col transition group cursor-pointer"
                style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
                onClick={() => router.push(`/code_template?id=${row.id}`)}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-primary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)' }}>

                {/* Thumbnail — fixed aspect container */}
                <div className="relative shrink-0 overflow-hidden" style={{ paddingBottom: '52%' }}>
                  <CanvasThumbnail tmpl={row.canvas} />
                  {row.canvas?.canvas && (
                    <span className="absolute bottom-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded-md pointer-events-none"
                      style={{ background: 'rgba(0,0,0,0.5)', color: '#fff' }}>
                      {row.canvas.canvas.width_mm}×{row.canvas.canvas.height_mm}mm
                    </span>
                  )}
                </div>

                {/* Info + actions */}
                <div className="px-3 py-2.5 flex items-center gap-2">
                  <p className="flex-1 text-[13px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>
                    {row.name || 'Untitled'}
                  </p>
                  <button type="button" title="Edit"
                    onClick={e => { e.stopPropagation(); router.push(`/code_template?id=${row.id}`) }}
                    className="p-1.5 rounded-lg border transition shrink-0"
                    style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)'; e.currentTarget.style.color = 'var(--c-primary)'; e.currentTarget.style.borderColor = 'var(--c-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-t3)'; e.currentTarget.style.borderColor = 'var(--c-border-strong)' }}>
                    <Pencil size={13} />
                  </button>
                  <button type="button" title="Delete"
                    onClick={e => { e.stopPropagation(); setDeleteTarget(row); setErrorMsg(null) }}
                    className="p-1.5 rounded-lg border transition shrink-0"
                    style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.borderColor = '#fca5a5'; e.currentTarget.style.color = '#ef4444' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.borderColor = 'var(--c-border-strong)'; e.currentTarget.style.color = 'var(--c-t3)' }}>
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete dialog */}
      {deleteTarget && (
        <DeleteDialog
          name={deleteTarget.name}
          onConfirm={handleDelete}
          onCancel={() => { setDeleteTarget(null); setErrorMsg(null) }}
          busy={deleting}
        />
      )}
    </div>
  )
}
