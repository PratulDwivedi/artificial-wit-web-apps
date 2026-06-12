'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { AlertCircle, Eye, Loader2, Menu, Pencil, Plus, Save, Trash2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import { resolveIcon } from '@/lib/icons'
import type { PageSchema, PageSection, RpcEnvelope } from '@/lib/schema'
import { DynamicForm } from './DynamicForm'
import { DynamicTable } from './DynamicTable'
import { DynamicReportTable } from './DynamicReportTable'
import { DynamicCard } from './DynamicCard'
import { NotificationBadge } from '@/components/common/NotificationBadge'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

interface Props {
  routeName: string
}

/** Parse schema width (12-column convention) and scale to the 16-column dyn-grid. */
function colSpan(width: unknown, defaultSpan = 16): number {
  const n = parseInt(String(width ?? ''), 10)
  if (isNaN(n)) return defaultSpan
  // Schema uses Bootstrap 12-col convention; scale proportionally to 16-col dyn-grid
  // e.g. 12 → 16 (full), 6 → 8 (half), 3 → 4 (quarter)
  return Math.min(16, Math.max(1, Math.round(n / 12 * 16)))
}

/**
 * Read a potentially-dotted path from an object.
 * "data.default_value" on { data: { default_value: "x" } } → "x"
 * Falls back to flat key lookup so plain binding names still work.
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const dot = path.indexOf('.')
  if (dot === -1) return obj[path]
  const prefix = path.slice(0, dot)
  const rest   = path.slice(dot + 1)
  const child  = obj[prefix]
  if (child !== null && typeof child === 'object') {
    const found = getNestedValue(child as Record<string, unknown>, rest)
    if (found !== undefined) return found
  }
  // flat fallback — handles formData stored with dotted key from handleChange
  return obj[path]
}

/**
 * Write a plain (no-prefix) nested value. Used for the sub-object after the
 * top-level p_ key has already been applied.
 * "b.c" on obj → obj["b"]["c"] = val
 */
function setNestedValue(obj: Record<string, unknown>, path: string, val: unknown): void {
  const dot = path.indexOf('.')
  if (dot === -1) { obj[path] = val; return }
  const prefix = path.slice(0, dot)
  const rest   = path.slice(dot + 1)
  if (typeof obj[prefix] !== 'object' || obj[prefix] === null) obj[prefix] = {}
  setNestedValue(obj[prefix] as Record<string, unknown>, rest, val)
}

/**
 * Write a value into the RPC payload using dot notation.
 * Only the first segment gets the p_ prefix; nested keys stay plain.
 * "data.width" → payload["p_data"]["width"] = val  (not p_width)
 * Multiple controls sharing the same prefix merge into the same object.
 */
function setPayloadValue(payload: Record<string, unknown>, bindingName: string, val: unknown): void {
  const dot = bindingName.indexOf('.')
  if (dot === -1) { payload[`p_${bindingName}`] = val; return }
  const prefix     = bindingName.slice(0, dot)
  const rest       = bindingName.slice(dot + 1)
  const payloadKey = `p_${prefix}`
  if (typeof payload[payloadKey] !== 'object' || payload[payloadKey] === null) payload[payloadKey] = {}
  setNestedValue(payload[payloadKey] as Record<string, unknown>, rest, val)
}

function isEqualData(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    return a.every((item, index) => item === b[index])
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const aKeys = Object.keys(a as Record<string, unknown>)
    const bKeys = Object.keys(b as Record<string, unknown>)
    if (aKeys.length !== bKeys.length) return false
    return aKeys.every(key => Object.prototype.hasOwnProperty.call(b, key)
      && (a as Record<string, unknown>)[key] === (b as Record<string, unknown>)[key])
  }
  return false
}

function shallowEqualRecords(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every(key => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key])
}

/**
 * Build the unified RPC payload from all section data.
 * - Form sections: emit p_<binding_name> for every control defined in the schema
 *   (filters out extra server fields). Dotted binding names like "data.key" become
 *   nested objects: p_data: { key: val }.
 * - DataTable sections: emit p_<section.binding_name> as a Row[] array.
 * - Report/card sections are display-only and contribute nothing.
 */
function buildPayload(
  schema: PageSchema,
  sectionData: Map<number, unknown>,
  recordId: string | undefined,
  childDisplayModes: typeof APP_CONSTANTS.child_display_modes,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {}

  for (const section of schema.sections ?? []) {
    const data = sectionData.get(section.id)

    if (section.child_display_mode_id === childDisplayModes.form) {
      const formData = (data ?? {}) as Record<string, unknown>
      for (const control of section.controls ?? []) {
        const val = getNestedValue(formData, control.binding_name)
        if (val !== undefined) setPayloadValue(payload, control.binding_name, val)
      }
    } else if (section.child_display_mode_id === childDisplayModes.dataTable) {
      if (section.binding_name) {
        payload[`p_${section.binding_name}`] = Array.isArray(data) ? data : []
      }
    }
  }

  // Inject p_id from the URL when editing, if no schema control already emitted it
  if (recordId && !('p_id' in payload)) {
    const ids = recordId.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    payload['p_id'] = ids.length === 1 ? ids[0] : ids
  }

  return payload
}

export function DynamicPage({ routeName }: Props) {
  const searchParams = useSearchParams()
  const recordId     = searchParams.get('id') ?? undefined

  const [schema,     setSchema]    = useState<PageSchema | null>(null)
  const [loading,    setLoading]   = useState(true)
  const [error,      setError]     = useState<string | null>(null)
  const [isSaving,   setIsSaving]  = useState(false)
  const [saveMsg,    setSaveMsg]   = useState<{ text: string; ok: boolean } | null>(null)
  const [viewTrigger, setViewTrigger] = useState(0)
  const [deleting,        setDeleting]        = useState(false)
  const [deleteMsg,       setDeleteMsg]       = useState<{ text: string; ok: boolean } | null>(null)
  const [pendingDelete,   setPendingDelete]   = useState<string | null>(null)
  // Pre-fetched record data loaded at page level so form + table sections share one RPC call
  const [initialRecordData, setInitialRecordData] = useState<Record<string, unknown> | null>(null)
  const [loadingRecord,     setLoadingRecord]      = useState(!!recordId)

  // Accumulates the latest data from each section (keyed by section.id)
  const sectionDataRef = useRef(new Map<number, unknown>())
  // Merged flat data from all sections — used for cross-section cascade resolution
  const [sharedData, setSharedData] = useState<Record<string, unknown>>({})

  const router = useRouter()

  // Must be before any early returns — Rules of Hooks
  const { setSidebarOpen, editMode, setEditMode, canEditMode } = useAppStore()

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

  // Load the record data once at page level so DynamicForm and DynamicTable share a single RPC call
  useEffect(() => {
    if (!recordId || !schema?.binding_name_get) { setLoadingRecord(false); return }
    setLoadingRecord(true)
    const ids = recordId.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    HttpHelper.rpc(schema.binding_name_get, { p_id: ids.length === 1 ? ids[0] : ids })
      .then(({ data }) => {
        const env = data as unknown as RpcEnvelope<Record<string, unknown>[]>
        setInitialRecordData(env?.is_success && env.data?.[0] ? env.data[0] : {})
      })
      .finally(() => setLoadingRecord(false))
  }, [schema?.binding_name_get, recordId])

  // Called by each section whenever its data changes
  const handleSectionData = useCallback((sectionId: number, data: unknown) => {
    const prevData = sectionDataRef.current.get(sectionId)
    if (isEqualData(prevData, data)) return
    sectionDataRef.current.set(sectionId, data)
    // Rebuild merged flat data for cross-section cascade resolution
    const merged: Record<string, unknown> = {}
    for (const [, sData] of sectionDataRef.current) {
      if (typeof sData === 'object' && sData !== null) Object.assign(merged, sData)
    }
    setSharedData(prev => shallowEqualRecords(prev, merged) ? prev : merged)
  }, [])

  // Single page-level save — builds payload from schema controls across all sections
  const handleSave = useCallback(async () => {
    if (!schema?.binding_name_post) return
    setIsSaving(true); setSaveMsg(null)
    try {
      const payload = buildPayload(
        schema,
        sectionDataRef.current,
        recordId,
        APP_CONSTANTS.child_display_modes,
      )
      const { data, error } = await HttpHelper.rpc(schema.binding_name_post, payload)
      if (error) throw new Error(error)
      const env = data as unknown as RpcEnvelope
      if (!env?.is_success) throw new Error(env?.message ?? 'Save failed')
      setSaveMsg({ text: env.message ?? 'Saved successfully', ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally {
      setIsSaving(false)
    }
  }, [schema, recordId])

  const handleDelete = useCallback(async (bindingName: string) => {
    if (!recordId) return
    setDeleting(true); setDeleteMsg(null)
    try {
      const ids = recordId.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
      const { data, error: err } = await HttpHelper.rpc(bindingName, { p_id: ids.length === 1 ? ids[0] : ids })
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

  if (loading || loadingRecord) return (
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
              <p className="hidden sm:block text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{schema.descr}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          {/* Page-level edit / add-section — only in edit mode, shown before the toggle */}
          {editMode && (
            <>
              <button type="button"
                onClick={() => router.push(`/page?id=${schema.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] transition hover:bg-[var(--c-hover)]"
                style={{ borderColor: 'var(--c-border)', color: 'var(--c-t3)' }}>
                <Pencil size={11} /> Edit Page
              </button>
              <button type="button"
                onClick={() => router.push(`/page_section?page_id=${schema.id}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] transition hover:bg-[var(--c-hover)]"
                style={{ borderColor: 'var(--c-border)', color: 'var(--c-t3)' }}>
                <Plus size={11} /> Add Section
              </button>
            </>
          )}

          {/* Edit mode toggle — only for users with show_editor permission */}
          {canEditMode && <button type="button"
            onClick={() => setEditMode(!editMode)}
            className="p-1.5 rounded-lg border transition"
            title={editMode ? 'Exit edit mode' : 'Enter edit mode'}
            style={{
              borderColor: editMode ? 'var(--c-primary)' : 'var(--c-border)',
              background:  editMode ? 'color-mix(in srgb, var(--c-primary) 12%, transparent)' : 'transparent',
              color:       editMode ? 'var(--c-primary)' : 'var(--c-t4)',
            }}>
            <Pencil size={14} />
          </button>}

          {/* Delete — only when editing a record that has a delete binding */}
          {showDelete && (
            <button type="button" disabled={deleting}
              onClick={() => setPendingDelete(schema.binding_name_delete!)}
              title={deleting ? 'Deleting…' : 'Delete'}
              className="flex items-center gap-1.5 px-2 py-2 sm:px-4 rounded-xl border text-[13px] font-medium transition disabled:opacity-60"
              style={{ borderColor: '#fca5a5', color: '#ef4444', background: 'rgba(239,68,68,0.06)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}>
              {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              <span className="hidden sm:inline">{deleting ? 'Deleting…' : 'Delete'}</span>
            </button>
          )}

          {/* Save / Update — single page-level submission */}
          {showSave && (
            <button type="button" disabled={isSaving || deleting}
              onClick={handleSave}
              title={isSaving ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}
              className="flex items-center gap-1.5 px-2 py-2 sm:px-4 btn-primary rounded-xl text-[13px] font-semibold transition disabled:opacity-60">
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              <span className="hidden sm:inline">{isSaving ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}</span>
            </button>
          )}

          {/* View — triggers a refresh of all report table sections */}
          {showView && (
            <button type="button"
              onClick={() => setViewTrigger(n => n + 1)}
              title="View"
              className="flex items-center gap-1.5 px-2 py-2 sm:px-4 rounded-xl border text-[13px] font-medium transition"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
              <Eye size={13} />
              <span className="hidden sm:inline">View</span>
            </button>
          )}

          <NotificationBadge />
        </div>
      </div>

      {/* Save feedback banner */}
      {saveMsg && (
        <div className="shrink-0 px-6 py-2.5 text-[12px] border-b"
          style={saveMsg.ok
            ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.2)' }
            : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
          {saveMsg.text}
        </div>
      )}

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
                viewTrigger={showView ? viewTrigger : undefined}
                onDataChange={handleSectionData}
                sharedData={sharedData}
                initialData={initialRecordData ?? undefined}
              />
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete record"
        message="Are you sure you want to delete this record? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { const b = pendingDelete!; setPendingDelete(null); handleDelete(b) }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}

// ── Section router ─────────────────────────────────────────────────────────────

function SectionRenderer({
  section,
  schema,
  recordId,
  viewTrigger,
  onDataChange,
  sharedData,
  initialData,
}: {
  section: PageSection
  schema: PageSchema
  recordId?: string
  viewTrigger?: number
  onDataChange: (sectionId: number, data: unknown) => void
  sharedData?: Record<string, unknown>
  initialData?: Record<string, unknown>
}) {
  const { child_display_modes } = APP_CONSTANTS

  switch (section.child_display_mode_id) {
    case child_display_modes.form:
      return (
        <DynamicForm
          section={section}
          schema={schema}
          recordId={recordId}
          onDataChange={data => onDataChange(section.id, data)}
          sharedData={sharedData}
          initialData={initialData}
        />
      )

    case child_display_modes.dataTableReport:
    case child_display_modes.dataTableReportAdvance:
      if (section.binding_name || schema.binding_name_get) {
        return <DynamicReportTable section={section} schema={schema} viewTrigger={viewTrigger} />
      }
      return (
        <DynamicTable
          section={section}
          onDataChange={rows => onDataChange(section.id, rows)}
        />
      )

    case child_display_modes.dataTable:
      // Editable table — cells are DynamicControl; schema + recordId enable loading existing rows
      return (
        <DynamicTable
          section={section}
          schema={schema}
          recordId={recordId}
          onDataChange={rows => onDataChange(section.id, rows)}
          initialData={initialData}
        />
      )

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
