'use client'

import { useState, useEffect } from 'react'
import { HttpHelper } from '@/lib/http'
import type { FormBlock } from './types'
import SearchableSelect from '@/components/common/SearchableSelect'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Option { value: string; label: string }

// ── Fetch MCP tool options ─────────────────────────────────────────────────────

function extractArray(data: unknown): unknown[] | null {
  if (Array.isArray(data)) return data

  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>
    // Common wrappers: .data, .result, .items, .rows
    for (const key of ['data', 'result', 'items', 'rows', 'content', 'records']) {
      if (Array.isArray(d[key])) return d[key] as unknown[]
    }
  }
  return null
}

async function fetchMcpOptions(toolName: string, authToken: string): Promise<Option[]> {
  try {
    const res = await fetch('/api/mcp', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        method: 'tools/call',
        params: { name: toolName, arguments: {} },
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      console.warn(`[BlockForm] MCP "${toolName}" HTTP ${res.status}:`, data)
      return []
    }

    // Log the raw MCP response so the caller can see its exact shape
    console.log(`[BlockForm] MCP "${toolName}" raw response:`, JSON.stringify(data).slice(0, 500))

    // Walk through known MCP response shapes to find a stringified-JSON text field
    const textCandidates: unknown[] = [
      data?.result?.content?.[0]?.text,
      data?.content?.[0]?.text,
      data?.result?.content?.[0],
      data?.result,
      data?.data,
      data,
    ]

    let arr: unknown[] | null = null

    for (const candidate of textCandidates) {
      if (candidate == null) continue

      let resolved: unknown = candidate

      // If it's a string, try parsing it as JSON
      if (typeof candidate === 'string') {
        const t = candidate.trim()
        if (!t) continue
        try { resolved = JSON.parse(t) } catch { continue }
      }

      // Try to extract an array from the resolved value
      arr = extractArray(resolved)
      if (arr && arr.length > 0) break
    }

    if (!arr || arr.length === 0) {
      console.warn(`[BlockForm] MCP "${toolName}" — could not find array in response. Full shape:`, data)
      return []
    }

    const first = arr[0] as Record<string, unknown>
    const keys  = Object.keys(first)

    const valueKey = keys.find(k => /^id$|_id$/i.test(k)) ?? keys[0]
    const labelKey =
      keys.find(k => /name|title|label|text/i.test(k) && k !== valueKey) ??
      keys.find(k => k !== valueKey) ??
      keys[0]

    return (arr as Record<string, unknown>[]).map(item => ({
      value: String(item[valueKey] ?? ''),
      label: String(item[labelKey] ?? item[valueKey] ?? ''),
    }))
  } catch (err) {
    console.error(`[BlockForm] MCP "${toolName}" fetch error:`, err)
    return []
  }
}

// ── BlockForm ──────────────────────────────────────────────────────────────────

export default function BlockForm({ block }: { block: FormBlock }) {
  const [values,    setValues]    = useState<Record<string, string>>({})
  const [options,   setOptions]   = useState<Record<string, Option[]>>({})
  const [loading,   setLoading]   = useState<Record<string, boolean>>({})
  const [submitted, setSubmitted] = useState(false)

  const inputCls   = `w-full rounded-xl px-3 py-2 text-[12px] border focus:outline-none transition`
  const inputStyle: React.CSSProperties = {
    background:  'var(--c-base)',
    borderColor: 'var(--c-border-strong)',
    color:       'var(--c-t1)',
  }

  // Load MCP options on mount
  useEffect(() => {
    const selectFields = block.fields.filter(f => f.fieldType === 'select' && f.mcpSource)
    if (selectFields.length === 0) return

    setLoading(prev => {
      const next = { ...prev }
      selectFields.forEach(f => { next[f.name] = true })
      return next
    })

    const token = HttpHelper.getToken() ?? ''
    Promise.all(
      selectFields.map(async f => ({ name: f.name, opts: await fetchMcpOptions(f.mcpSource!, token) }))
    ).then(results => {
        setOptions(prev => {
          const next = { ...prev }
          results.forEach(({ name, opts }) => { next[name] = opts })
          return next
        })
        setLoading(prev => {
          const next = { ...prev }
          results.forEach(({ name }) => { next[name] = false })
          return next
        })
      })
  }, [block.id])

  const handleSubmit = () => {
    const missing = block.fields.filter(f => f.required && !values[f.name]?.trim())
    if (missing.length > 0) return
    setSubmitted(true)
  }

  return (
    // No overflow-hidden here — lets the portal dropdown escape
    <div className="rounded-xl border mt-2"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>

      {/* Header */}
      <div className="px-4 py-3 border-b text-[13px] font-semibold rounded-t-xl"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', color: 'var(--c-t1)' }}>
        {block.title}
      </div>

      {/* Two-column grid — textareas span full width */}
      <div className="px-4 py-4 grid grid-cols-2 gap-3">
        {block.fields.map(f => {
          const isFullWidth = f.fieldType === 'textarea'
          return (
            <div key={f.name} className={isFullWidth ? 'col-span-2' : ''}>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>
                {f.label}
                {f.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>

              {f.fieldType === 'select' ? (
                <SearchableSelect
                  options={options[f.name] ?? []}
                  loading={!!loading[f.name]}
                  value={values[f.name] ?? ''}
                  placeholder={`Select ${f.label}…`}
                  onChange={v => setValues(prev => ({ ...prev, [f.name]: v }))}
                />
              ) : f.fieldType === 'textarea' ? (
                <textarea
                  value={values[f.name] ?? ''}
                  rows={3}
                  onChange={e => setValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                  className={`${inputCls} resize-none`}
                  style={inputStyle}
                />
              ) : (
                <input
                  value={values[f.name] ?? ''}
                  type={f.fieldType === 'number' ? 'number' : 'text'}
                  onChange={e => setValues(prev => ({ ...prev, [f.name]: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                />
              )}
            </div>
          )
        })}

        {/* Submit spans full width */}
        <div className="col-span-2">
          {submitted ? (
            <p className="text-[12px] text-emerald-500 font-medium">Submitted successfully!</p>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-2 btn-primary text-[12px] font-semibold rounded-xl transition"
            >
              {block.submitLabel ?? 'Submit'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
