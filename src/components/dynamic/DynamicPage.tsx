'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertCircle, Eye, Loader2, Menu, Save } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import { resolveIcon } from '@/lib/icons'
import type { PageSchema, PageSection, RpcEnvelope } from '@/lib/schema'
import { DynamicForm } from './DynamicForm'
import { DynamicTable } from './DynamicTable'
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
  const [saveTrigger, setSaveTrigger] = useState(0)
  const [savingCount, setSavingCount] = useState(0)

  const searchParams = useSearchParams()
  const recordId     = searchParams.get('id') ?? undefined

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

  const { page_types } = APP_CONSTANTS
  const isFormPage   = schema.page_type_id === page_types.form
  const isReportPage = schema.page_type_id === page_types.report
  const isSaving     = savingCount > 0
  const Icon         = resolveIcon(schema.data?.item_icon)

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
          {/* Hamburger — only on mobile/tablet when sidebar is hidden */}
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
          {isFormPage && (
            <button type="button" disabled={isSaving}
              onClick={() => setSaveTrigger(n => n + 1)}
              className="flex items-center gap-1.5 px-4 py-2 btn-primary rounded-xl text-[13px] font-semibold transition disabled:opacity-60">
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          )}
          {isReportPage && (
            <button type="button"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-medium transition"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
              <Eye size={13} /> View
            </button>
          )}
        </div>
      </div>

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
                saveTrigger={isFormPage ? saveTrigger : undefined}
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
  onSavingChange,
}: {
  section: PageSection
  schema: PageSchema
  recordId?: string
  saveTrigger?: number
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

    case child_display_modes.dataTable:
    case child_display_modes.dataTableReport:
    case child_display_modes.dataTableReportAdvance:
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
