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
  /** Incremented by the page header Save button to trigger this form */
  saveTrigger?: number
  /** Notifies the parent when this form's saving state changes */
  onSavingChange?: (saving: boolean) => void
}

export function DynamicForm({ section, schema, recordId, saveTrigger, onSavingChange }: Props) {
  const { section_display_modes, control_display_modes } = APP_CONSTANTS

  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [loading,  setLoading]  = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)
  const [expanded, setExpanded] = useState(
    section.display_mode_id !== section_display_modes.collapse
  )

  const visibleControls = [...(section.controls ?? [])]
    .filter(c => c.display_mode_id !== control_display_modes.none_hidden)
    .sort((a, b) => a.display_order - b.display_order)

  // Load record when editing
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
    setExpanded(true)   // ensure feedback is visible
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

  // Fire when the page-level Save button is clicked
  useEffect(() => {
    if (!saveTrigger) return
    doSubmit()
  // doSubmit is stable (useCallback); saveTrigger is the real dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveTrigger])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    doSubmit()
  }

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>

      {/* Section header */}
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
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {visibleControls.map(control => (
                  <DynamicControl
                    key={control.id}
                    {...control}
                    value={formData[control.binding_name]}
                    onChange={handleChange}
                    cascadeValue={
                      control.cascade_from_binding_name
                        ? formData[control.cascade_from_binding_name]
                        : undefined
                    }
                  />
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
          )}
        </form>
      )}
    </div>
  )
}
