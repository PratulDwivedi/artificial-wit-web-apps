'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import type { PageSection, PageSchema, RpcEnvelope } from '@/lib/schema'
import { DynamicControl } from './DynamicControl'

interface Props {
  section: PageSection
  schema: PageSchema
  recordId?: string
  saveTrigger?: number
  onSavingChange?: (saving: boolean) => void
}

function colSpan(width: unknown, defaultSpan = 6): number {
  const n = parseInt(String(width ?? defaultSpan), 10)
  return isNaN(n) ? defaultSpan : Math.min(16, Math.max(1, n))
}

export function DynamicForm({ section, schema, recordId, saveTrigger, onSavingChange }: Props) {
  const { section_display_modes, control_display_modes } = APP_CONSTANTS

  const isNoneMode = section.display_mode_id === section_display_modes.none

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)
  const [expanded, setExpanded] = useState(
    isNoneMode || section.display_mode_id !== section_display_modes.collapse
  )

  const visibleControls = [...(section.controls ?? [])]
    .filter(c => c.display_mode_id !== control_display_modes.none_hidden)
    .sort((a, b) => a.display_order - b.display_order)

  useEffect(() => {
    if (!recordId || !schema.binding_name_get) return
    setLoading(true)
    HttpHelper.rpc(schema.binding_name_get, { p_id: parseInt(recordId, 10) })
      .then(({ data }) => {
        const env = data as unknown as RpcEnvelope<Record<string, unknown>[]>
        if (env?.is_success && env.data?.[0]) setFormData(env.data[0])
      })
      .finally(() => setLoading(false))
  }, [recordId, schema.binding_name_get])

  const handleChange = useCallback((name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }, [])

  const doSubmit = useCallback(async () => {
    if (!schema.binding_name_post) return
    setExpanded(true)
    setSaving(true)
    onSavingChange?.(true)
    setMsg(null)
    try {
      const payload: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(formData)) {
        payload[`p_${k}`] = v
      }
      const { data, error } = await HttpHelper.rpc(schema.binding_name_post, payload)
      if (error) throw new Error(error)
      const env = data as unknown as RpcEnvelope
      if (!env?.is_success) throw new Error(env?.message ?? 'Save failed')
      setMsg({ text: env.message ?? 'Saved successfully', ok: true })
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Save failed', ok: false })
    } finally {
      setSaving(false)
      onSavingChange?.(false)
    }
  }, [schema.binding_name_post, formData, onSavingChange])

  useEffect(() => {
    if (!saveTrigger) return
    doSubmit()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger])

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); doSubmit() }

  const formBody = loading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  ) : (
    <>
      {/* 16-col dynamic grid for controls */}
      <div className="dyn-grid" style={{ gap: '12px 20px' }}>
        {visibleControls.map(control => (
          <div
            key={control.id}
            style={{ '--col-span': colSpan(control.data?.width) } as React.CSSProperties}
          >
            <DynamicControl
              {...control}
              value={formData[control.binding_name]}
              onChange={handleChange}
              cascadeValue={
                control.cascade_from_binding_name
                  ? formData[control.cascade_from_binding_name]
                  : undefined
              }
            />
          </div>
        ))}
      </div>

      {msg && (
        <div className="mt-4 text-[12px] rounded-xl px-3 py-2.5 border"
          style={msg.ok
            ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.3)' }
            : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
          {msg.text}
        </div>
      )}
    </>
  )

  /* display_mode none (30) → no collapsible header, content always visible */
  if (isNoneMode) {
    return (
      <form onSubmit={handleSubmit} className="p-4">
        {formBody}
      </form>
    )
  }

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
        {saving && <Loader2 size={12} className="ml-auto animate-spin" style={{ color: 'var(--c-t4)' }} />}
      </button>

      {expanded && (
        <form onSubmit={handleSubmit} className="p-4">
          {formBody}
        </form>
      )}
    </div>
  )
}
