'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import type { PageSection, PageSchema, RpcEnvelope } from '@/lib/schema'
import { DynamicControl } from './DynamicControl'

interface Props {
  section: PageSection
  schema: PageSchema
  recordId?: string
  onDataChange?: (data: Record<string, unknown>) => void
  sharedData?: Record<string, unknown>
}

function colSpan(width: unknown, defaultSpan = 4): number {
  const n = parseInt(String(width), 10)
  return (isNaN(n) || n <= 0) ? defaultSpan : Math.min(12, n)
}

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
  return obj[path]
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const dot = path.indexOf('.')
  if (dot === -1) return { ...obj, [path]: value }
  const prefix = path.slice(0, dot)
  const rest   = path.slice(dot + 1)
  const child  = (obj[prefix] !== null && typeof obj[prefix] === 'object')
    ? (obj[prefix] as Record<string, unknown>)
    : {}
  return { ...obj, [prefix]: setNestedValue(child, rest, value) }
}

export function DynamicForm({ section, schema, recordId, onDataChange, sharedData }: Props) {
  const { section_display_modes, control_display_modes } = APP_CONSTANTS
  const router      = useRouter()
  const editMode    = useAppStore(s => s.editMode)
  const searchParams = useSearchParams()

  const isNoneMode = section.display_mode_id === section_display_modes.none

  // Pre-fill form with query params (e.g. ?section_id=27) when creating a new record
  const [formData, setFormData] = useState<Record<string, unknown>>(() => {
    if (recordId) return {}
    const init: Record<string, unknown> = {}
    searchParams.forEach((raw, key) => {
      if (key === 'id') return
      const n = Number(raw)
      init[key] = (!isNaN(n) && raw.trim() !== '') ? n : raw
    })
    return init
  })
  const [loading,  setLoading]  = useState(false)
  const [expanded, setExpanded] = useState(
    isNoneMode || section.display_mode_id !== section_display_modes.collapse
  )

  const visibleControls = [...(section.controls ?? [])]
    .filter(c => c.display_mode_id !== control_display_modes.none_hidden)
    .sort((a, b) => a.display_order - b.display_order)

  useEffect(() => {
    if (!recordId || !schema.binding_name_get) return
    setLoading(true)
    const ids = recordId.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))
    HttpHelper.rpc(schema.binding_name_get, { p_id: ids.length === 1 ? ids[0] : ids })
      .then(({ data }) => {
        const env = data as unknown as RpcEnvelope<Record<string, unknown>[]>
        if (env?.is_success && env.data?.[0]) setFormData(env.data[0])
      })
      .finally(() => setLoading(false))
  }, [recordId, schema.binding_name_get])

  // Keep a stable ref so the effect below doesn't re-fire when the callback
  // reference changes (e.g. when DynamicPage re-renders after sharedData update)
  const onDataChangeRef = useRef(onDataChange)
  onDataChangeRef.current = onDataChange

  // Report current form state to the page whenever it changes
  useEffect(() => {
    onDataChangeRef.current?.(formData)
  }, [formData]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = useCallback((name: string, value: unknown) => {
    setFormData(prev => setNestedValue(prev, name, value))
  }, [])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault() }

  const formBody = loading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  ) : (
    <>
      {/* 16-col dynamic grid for controls */}
      <div className="ctrl-grid" style={{ gap: '12px 20px' }}>
        {visibleControls.map(control => (
          <div
            key={control.id}
            style={{ '--col-span': colSpan(control.data?.width) } as React.CSSProperties}
          >
            <DynamicControl
              {...control}
              value={getNestedValue(formData, control.binding_name)}
              onChange={handleChange}
              cascadeValue={
                control.cascade_from_binding_name
                  ? (getNestedValue(formData, control.cascade_from_binding_name)
                      ?? (sharedData ? getNestedValue(sharedData, control.cascade_from_binding_name) : undefined))
                  : undefined
              }
            />
          </div>
        ))}
      </div>

    </>
  )

  /* display_mode none (30) → no collapsible header, content always visible */
  if (isNoneMode) {
    return (
      <form onSubmit={handleSubmit} className="relative p-4">
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
        {formBody}
      </form>
    )
  }

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

      {expanded && (
        <form onSubmit={handleSubmit} className="p-4">
          {formBody}
        </form>
      )}
    </div>
  )
}
