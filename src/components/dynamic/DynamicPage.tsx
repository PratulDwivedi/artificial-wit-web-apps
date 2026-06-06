'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AlertCircle, Eye, Loader2, Menu, Save, Trash2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import { resolveIcon } from '@/lib/icons'
import type { PageSchema, PageSection, RpcEnvelope } from '@/lib/schema'
import { DynamicForm } from './DynamicForm'
import { DynamicTable } from './DynamicTable'
import { DynamicReportTable } from './DynamicReportTable'
import { DynamicCard } from './DynamicCard'

interface Props {
  routeName: string
}

/** Parse schema width to a number, clamped to 1-16, default 16. */
function colSpan(width: unknown, defaultSpan = 16): number {
  const n = parseInt(String(width ?? defaultSpan), 10)
  return isNaN(n) ? defaultSpan : Math.min(16, Math.max(1, n))
}

export function DynamicPage({ routeName }: Props) {
  const [schema,      setSchema]      = useState<PageSchema | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [saveTrigger,  setSaveTrigger] = useState(0)
  const [savingCount,  setSavingCount] = useState(0)
  const [viewTrigger,  setViewTrigger] = useState(0)
  const [deleting,     setDeleting]    = useState(false)
  const [deleteMsg,    setDeleteMsg]   = useState<{ text: string; ok: boolean } | null>(null)

  const searchParams = useSearchParams()
  const recordId     = searchParams.get('id') ?? undefined
  const router       = useRouter()

  // Must be before any early returns — Rules of Hooks
  const { setSidebarOpen } = useAppStore()

  useEffect(() => {
    setLoading(true); setError(null); setSchema(null)
    HttpHelper.rpc('fn_get_page_schema', { p_route_name: routeName })
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        const env = data as unknown as RpcEnvelope<PageSchema | PageSchema[]>
        if (!env?.is_success) { setError(env?.message ?? 'Failed to load page'); return }
        const schema = Array.isArray(env.data) ? env.data[0] : env.data
        setSchema(schema ?? null)
      })
      .finally(() => setLoading(false))
  }, [routeName])

  const handleSavingChange = (saving: boolean) =>
    setSavingCount(n => Math.max(0, saving ? n + 1 : n - 1))

  const handleDelete = useCallback(async (bindingName: string) => {
    if (!recordId) return
    if (!confirm('Are you sure you want to delete this record?')) return
    setDeleting(true); setDeleteMsg(null)
    try {
      const { data, error: err } = await HttpHelper.rpc(bindingName, { p_id: parseInt(recordId, 10) })
      if (err) throw new Error(err)
      const env = data as unknown as RpcEnvelope
      if (!env?.is_success) throw new Error(env?.message ?? 'Delete failed')
      setDeleteMsg({ text: env.message ?? 'Deleted successfully', ok: true })
      setTimeout(() => router.back(), 1200)
    } catch (e) {
      setDeleteMsg({ text: e instanceof Error ? e.message : 'Delete failed', ok: false })
    } finally {
      setDeleting(false)
    }
  }, [recordId, router])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--c-base)' }}>
      <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  )

  if (error) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8"
      style={{ background: 'var(--c-base)' }}>
      <AlertCircle size={24} style={{ color: '#ef4444' }} />
      <p className="text-[14px] font-medium" style={{ color: 'var(--c-t1)' }}>{error}</p>
    </div>
  )

  if (!schema) return null

  const isEditing  = !!recordId
  const showSave   = !!schema.binding_name_post
  const showView   = !!schema.binding_name_get && !schema.binding_name_post
  const showDelete = isEditing && !!schema.binding_name_delete
  const isSaving   = savingCount > 0
  const Icon       = resolveIcon(schema.data?.item_icon)

  const sections = [...(schema.sections ?? [])]
    .filter(s => s.is_active)
    .sort((a, b) => a.display_order - b.display_order)

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Frozen page header ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0"
            style={{ color: 'var(--c-t3)' }}
          >
            <Menu size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-active)' }}>
            <Icon size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--c-t1)' }}>
              {schema.name}
            </h1>
            {schema.descr && (
              <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{schema.descr}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          {/* Delete — only when editing a record that has a delete binding */}
          {showDelete && (
            <button type="button" disabled={deleting}
              onClick={() => handleDelete(schema.binding_name_delete!)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-medium transition disabled:opacity-60"
              style={{ borderColor: '#fca5a5', color: '#ef4444', background: 'rgba(239,68,68,0.06)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          )}

          {/* Save / Update — driven by binding_name_post */}
          {showSave && (
            <button type="button" disabled={isSaving || deleting}
              onClick={() => setSaveTrigger(n => n + 1)}
              className="flex items-center gap-1.5 px-4 py-2 btn-primary rounded-xl text-[13px] font-semibold transition disabled:opacity-60">
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {isSaving ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}
            </button>
          )}

          {/* View — triggers a refresh of all report table sections */}
          {showView && (
            <button type="button"
              onClick={() => setViewTrigger(n => n + 1)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-medium transition"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
              <Eye size={13} /> View
            </button>
          )}
        </div>
      </div>

      {/* Delete feedback banner */}
      {deleteMsg && (
        <div className="shrink-0 px-6 py-2.5 text-[12px] border-b"
          style={deleteMsg.ok
            ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.2)' }
            : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
          {deleteMsg.text}
        </div>
      )}

      {/* ── Scrollable content — 16-col dynamic grid ───────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="dyn-grid p-5" style={{ gap: '20px' }}>
          {sections.map(section => (
            <div
              key={section.id}
              style={{ '--col-span': colSpan(section.data?.width) } as React.CSSProperties}
            >
              <SectionRenderer
                section={section}
                schema={schema}
                recordId={recordId}
                saveTrigger={showSave ? saveTrigger : undefined}
                viewTrigger={showView ? viewTrigger : undefined}
                onSavingChange={handleSavingChange}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Section router ─────────────────────────────────────────────────────────────

function SectionRenderer({
  section,
  schema,
  recordId,
  saveTrigger,
  viewTrigger,
  onSavingChange,
}: {
  section: PageSection
  schema: PageSchema
  recordId?: string
  saveTrigger?: number
  viewTrigger?: number
  onSavingChange?: (saving: boolean) => void
}) {
  const { child_display_modes } = APP_CONSTANTS

  switch (section.child_display_mode_id) {
    case child_display_modes.form:
      return (
        <DynamicForm
          section={section}
          schema={schema}
          recordId={recordId}
          saveTrigger={saveTrigger}
          onSavingChange={onSavingChange}
        />
      )

    case child_display_modes.dataTableReport:
    case child_display_modes.dataTableReportAdvance:
      // Report pages fetch from the page-level binding_name_get
      if (schema.binding_name_get) {
        return <DynamicReportTable section={section} schema={schema} viewTrigger={viewTrigger} />
      }
      // Fall through to DynamicTable if no page-level binding (inline table with section binding)
      return <DynamicTable section={section} />

    case child_display_modes.dataTable:
      return <DynamicTable section={section} />

    case child_display_modes.cardItem:
      return <DynamicCard section={section} />

    default:
      return (
        <div className="rounded-2xl border p-4"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
          <p className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>{section.name}</p>
          <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
            Display mode {section.child_display_mode_id} is not yet supported.
          </p>
        </div>
      )
  }
}
