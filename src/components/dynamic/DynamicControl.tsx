'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, GripVertical, Pencil, Plus, Trash2, Eye } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend,
} from 'chart.js'
import { Bar, Line, Pie } from 'react-chartjs-2'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import type { DropdownOption } from '@/lib/schema'
import { SearchableDropdown } from './SearchableDropdown'
import { TreeViewSelect } from './TreeViewSelect'
import { FieldConditionTable } from '@/components/common/FieldConditionTable'
import { FilePreview } from '@/components/common/FilePreview'

ChartJS.register(
  CategoryScale, LinearScale,
  BarElement, PointElement, LineElement, ArcElement,
  Title, Tooltip, Legend
)

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  id: number
  name: string
  binding_name: string
  control_type_id: number
  display_mode_id: number
  value: unknown
  onChange: (binding_name: string, value: unknown) => void
  binding_list_route_name?: string
  cascade_from_binding_name?: string
  cascadeValue?: unknown
  data?: Record<string, unknown>
  /** When true, renders only the input element — no label, no grid wrapper. For table cell use. */
  compact?: boolean
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const INPUT_CLASS =
  'w-full rounded-xl px-3 py-2 text-[13px] border focus:outline-none ' +
  'focus:ring-2 focus:ring-[var(--c-primary)] transition ' +
  'disabled:opacity-50 disabled:cursor-not-allowed'

const INPUT_STYLE: React.CSSProperties = {
  background: 'var(--c-hover)',
  borderColor: 'var(--c-border-strong)',
  color: 'var(--c-t1)',
}

// ── Chart data helper ─────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#4f46e5','#7c3aed','#2563eb','#0891b2',
  '#059669','#65a30d','#ca8a04','#ea580c',
  '#dc2626','#db2777','#6366f1','#0d9488',
  '#0284c7','#9333ea',
]

function getPrimaryColor(): string {
  if (typeof window === 'undefined') return '#4f46e5'
  return getComputedStyle(document.documentElement).getPropertyValue('--c-primary').trim() || '#4f46e5'
}

function toChartData(raw: unknown, perSliceColors = false) {
  const rows = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : []
  const primary = getPrimaryColor()
  const singleBg = perSliceColors ? CHART_COLORS : primary
  if (rows.length === 0) return { labels: [], datasets: [{ data: [], backgroundColor: singleBg, borderRadius: 6, borderWidth: 0 }], isMulti: false }

  const first = rows[0]

  // Find label key: prefer 'label' > 'name', then first string field
  const labelKey = 'label' in first ? 'label'
    : 'name' in first ? 'name'
    : Object.keys(first).find(k => typeof first[k] === 'string') ?? ''

  const labels = rows.map(r => String(r[labelKey] ?? ''))

  // Numeric keys (excluding the label key)
  const numKeys = Object.keys(first).filter(k => k !== labelKey && typeof first[k] === 'number')

  // Single-series: bars use primary color; pie/doughnut use per-slice CHART_COLORS
  if ('value' in first || 'count' in first || numKeys.length <= 1) {
    const vKey = 'value' in first ? 'value' : 'count' in first ? 'count' : (numKeys[0] ?? 'value')
    return {
      labels,
      isMulti: false,
      datasets: [{
        data: rows.map(r => Number(r[vKey] ?? 0)),
        backgroundColor: singleBg,
        borderRadius: 6,
        borderWidth: 0,
      }],
    }
  }

  // Multi-series: each numeric field becomes its own dataset from the palette
  return {
    labels,
    isMulti: true,
    datasets: numKeys.map((key, i) => ({
      label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      data: rows.map(r => Number(r[key] ?? 0)),
      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
      borderRadius: 4,
      borderWidth: 0,
    })),
  }
}

const AXIS_COLOR = 'rgba(107,114,128,0.7)'

const BASE_CHART_OPTIONS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: { enabled: true },
  },
  scales: {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: { color: AXIS_COLOR, font: { size: 11 } },
    },
    y: {
      grid: { color: 'rgba(107,114,128,0.12)', drawBorder: false },
      border: { display: false, dash: [4, 4] },
      ticks: { color: AXIS_COLOR, font: { size: 11 } },
    },
  },
}

function chartOptions(isMulti: boolean) {
  if (!isMulti) return BASE_CHART_OPTIONS
  return {
    ...BASE_CHART_OPTIONS,
    plugins: {
      ...BASE_CHART_OPTIONS.plugins,
      legend: {
        display: true,
        position: 'top' as const,
        labels: { color: AXIS_COLOR, font: { size: 11 }, padding: 10, boxWidth: 10, boxHeight: 10 },
      },
    },
  }
}

// ── ReorderList (free-text items, no binding) ─────────────────────────────────

function ReorderList({ value, onChange, disabled }: {
  value: unknown; onChange: (v: unknown) => void; disabled: boolean
}) {
  const items: string[] = Array.isArray(value) ? (value as unknown[]).map(String) : []
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const move = (from: number, to: number) => {
    const next = [...items]
    const [el] = next.splice(from, 1)
    next.splice(to, 0, el)
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-1">
      {items.map((item, i) => (
        <div key={i}
          draggable={!disabled}
          onDragStart={() => setDragIdx(i)}
          onDragOver={e => { e.preventDefault() }}
          onDrop={() => { if (dragIdx != null && dragIdx !== i) move(dragIdx, i); setDragIdx(null) }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] transition"
          style={{
            borderColor: 'var(--c-border-strong)',
            background: dragIdx === i ? 'var(--c-active)' : 'var(--c-hover)',
            color: 'var(--c-t2)',
            cursor: disabled ? 'default' : 'grab',
          }}>
          {!disabled && <GripVertical size={13} style={{ color: 'var(--c-t5)' }} className="shrink-0" />}
          <span className="flex-1">{item}</span>
          {!disabled && (
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              <Trash2 size={12} style={{ color: 'var(--c-t5)' }} className="hover:text-red-500 transition" />
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <button type="button"
          onClick={() => onChange([...items, ''])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] transition"
          style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t4)', background: 'var(--c-hover)' }}>
          <Plus size={11} /> Add item
        </button>
      )}
    </div>
  )
}

// ── BindReorderList (items from API, no add/remove, names shown) ──────────────

interface DropdownOptionShape { id: number | string; name: string; [k: string]: unknown }

function BindReorderList({ options, value, onChange, disabled, loading }: {
  options: DropdownOptionShape[]
  value: unknown
  onChange: (items: { id: number | string; display_order: number }[]) => void
  disabled: boolean
  loading: boolean
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  // Build id→name lookup
  const nameMap = new Map(options.map(o => [String(o.id), o.name]))

  // Derive ordered IDs from value (supports both plain-id array and {id,display_order}[] format)
  const orderedIds: string[] = (() => {
    const optionIds = options.map(o => String(o.id))
    if (!Array.isArray(value) || (value as unknown[]).length === 0) return optionIds
    const items = value as unknown[]
    // Detect {id, display_order} format
    const isObjects = items.length > 0 && typeof items[0] === 'object' && items[0] !== null && 'id' in (items[0] as object)
    const valueIds: string[] = isObjects
      ? [...(items as { id: unknown; display_order?: unknown }[])]
          .sort((a, b) => Number(a.display_order ?? 0) - Number(b.display_order ?? 0))
          .map(item => String(item.id))
      : items.map(v => String(v))
    const optionSet = new Set(optionIds)
    const valueSet  = new Set(valueIds)
    return [
      ...valueIds.filter(id => optionSet.has(id)),
      ...optionIds.filter(id => !valueSet.has(id)),
    ]
  })()

  function move(from: number, to: number) {
    const next = [...orderedIds]
    const [el] = next.splice(from, 1)
    next.splice(to, 0, el)
    onChange(next.map((id, i) => {
      const orig = options.find(o => String(o.id) === id)
      return { id: orig ? orig.id : id, display_order: i + 1 }
    }))
  }

  if (loading) return (
    <div className="flex items-center gap-2 py-3 text-[12px]" style={{ color: 'var(--c-t4)' }}>
      <Loader2 size={13} className="animate-spin" /> Loading…
    </div>
  )

  if (orderedIds.length === 0) return (
    <p className="text-[12px] py-2" style={{ color: 'var(--c-t5)' }}>No items</p>
  )

  return (
    <div className="flex flex-col gap-1">
      {orderedIds.map((id, i) => (
        <div key={id}
          draggable={!disabled}
          onDragStart={() => setDragIdx(i)}
          onDragOver={e => e.preventDefault()}
          onDrop={() => { if (dragIdx != null && dragIdx !== i) move(dragIdx, i); setDragIdx(null) }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border text-[13px] transition select-none"
          style={{
            borderColor: 'var(--c-border-strong)',
            background: dragIdx === i ? 'var(--c-active)' : 'var(--c-hover)',
            color: 'var(--c-t2)',
            cursor: disabled ? 'default' : 'grab',
          }}>
          {!disabled && <GripVertical size={13} style={{ color: 'var(--c-t5)' }} className="shrink-0" />}
          <span className="flex-1">{nameMap.get(id) ?? id}</span>
        </div>
      ))}
    </div>
  )
}

// ── EditableList ──────────────────────────────────────────────────────────────

function EditableList({ value, onChange, disabled }: {
  value: unknown; onChange: (v: unknown) => void; disabled: boolean
}) {
  const items: string[] = Array.isArray(value) ? (value as unknown[]).map(String) : []
  const [input, setInput] = useState('')

  const add = () => {
    const v = input.trim()
    if (!v) return
    onChange([...items, v])
    setInput('')
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5 min-h-[38px] rounded-xl px-3 py-2 border"
        style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
        {items.map((item, i) => (
          <span key={i}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
            style={{ background: 'var(--c-active)', color: 'var(--c-primary)' }}>
            {item}
            {!disabled && (
              <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="hover:opacity-60">✕</button>
            )}
          </span>
        ))}
        {items.length === 0 && (
          <span className="text-[13px]" style={{ color: 'var(--c-t5)' }}>No items</span>
        )}
      </div>
      {!disabled && (
        <div className="flex gap-2">
          <input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder="Add item…"
            className={`${INPUT_CLASS} flex-1`} style={INPUT_STYLE} />
          <button type="button" onClick={add}
            className="px-3 py-2 rounded-xl border text-[12px] font-medium transition"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}>
            Add
          </button>
        </div>
      )}
    </div>
  )
}

// ── DynamicControl ────────────────────────────────────────────────────────────

export function DynamicControl({
  id,
  name,
  binding_name,
  control_type_id,
  display_mode_id,
  value,
  onChange,
  binding_list_route_name,
  cascade_from_binding_name,
  cascadeValue,
  data,
  compact = false,
}: Props) {
  const { control_types, control_display_modes } = APP_CONSTANTS
  const router   = useRouter()
  const editMode = useAppStore(s => s.editMode)

  const isHidden   = display_mode_id === control_display_modes.none_hidden
  const isDisabled = display_mode_id === control_display_modes.disabled
                  || display_mode_id === control_display_modes.display_read_only
  const isRequired = display_mode_id === control_display_modes.require

  // Dropdown / chart options loaded via binding_list_route_name
  const [options,        setOptions]        = useState<DropdownOption[]>([])
  const [loadingOptions, setLoadingOptions] = useState(false)
  const [uploading,      setUploading]      = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const needsOptions =
    control_type_id === control_types.dropdown ||
    control_type_id === control_types.dropdownMultiselect ||
    control_type_id === control_types.reorderList ||
    control_type_id === control_types.barChart ||
    control_type_id === control_types.lineChart ||
    control_type_id === control_types.pieChart

  useEffect(() => {
    if (!binding_list_route_name || !needsOptions) return
    setLoadingOptions(true)
    const params: Record<string, unknown> = {}
    if (cascade_from_binding_name && cascadeValue != null) {
      params[`p_${cascade_from_binding_name}`] = cascadeValue
    }
    HttpHelper.rpc(binding_list_route_name, params)
      .then(({ data: env }) => {
        const e = env as unknown as { is_success: boolean; data: DropdownOption[] }
        if (e?.is_success) setOptions(e.data ?? [])
      })
      .finally(() => setLoadingOptions(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [binding_list_route_name, cascade_from_binding_name, cascadeValue])

  // When options load for a bound reorderList and value is empty, initialise with natural order
  useEffect(() => {
    if (control_type_id !== control_types.reorderList || !binding_list_route_name) return
    if (options.length === 0) return
    if (Array.isArray(value) && (value as unknown[]).length > 0) return
    const defaultOrder = options.map((o, i) => ({ id: o.id, display_order: i + 1 }))
    onChange(binding_name, defaultOrder)
  }, [binding_list_route_name, binding_name, control_type_id, options, value, onChange])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/profile-pics/upload', { method: 'POST', body: form })
      const json = await res.json() as { success: boolean; url?: string }
      if (json.success && json.url) onChange(binding_name, json.url)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  if (isHidden) return null

  // Grid span: data.width >= 12 → full width (col-span-2), else single col
  const colSpan = (data?.width as number ?? 6) >= 12 ? 'col-span-2' : 'col-span-1'

  const renderInput = () => {
    switch (control_type_id) {

      // ── Text family ────────────────────────────────────────────────────────
      case control_types.alphaNumeric:
      case control_types.alphaOnly:
      case control_types.url:
        return (
          <input type="text" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      case control_types.email:
        return (
          <input type="email" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      case control_types.password:
        return (
          <input type="password" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      case control_types.phoneNumber:
        return (
          <input type="tel" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      // ── Number family ──────────────────────────────────────────────────────
      case control_types.integer:
        return (
          <input type="number" step="1"
            value={value != null ? String(value) : ''}
            onChange={e => onChange(binding_name, e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      case control_types.decimal:
      case control_types.currency:
        return (
          <input type="number"
            value={value != null ? String(value) : ''}
            onChange={e => onChange(binding_name, e.target.value ? parseFloat(e.target.value) : null)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      // ── Date/time family ───────────────────────────────────────────────────
      case control_types.date:
        return (
          <input type="date" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      case control_types.dateAndTime:
        return (
          <input type="datetime-local" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      case control_types.time:
        return (
          <input type="time" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      case control_types.month:
        return (
          <input type="month" value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            className={INPUT_CLASS} style={INPUT_STYLE} />
        )

      // ── Long text ──────────────────────────────────────────────────────────
      case control_types.textArea:
        return (
          <textarea value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            rows={4}
            className={`${INPUT_CLASS} resize-y`} style={INPUT_STYLE} />
        )

      // ── Toggle controls ────────────────────────────────────────────────────
      case control_types.checkbox:
        return (
          <div className="pt-1">
            <input type="checkbox" id={`ctrl-${id}`}
              checked={(value as boolean) ?? false}
              onChange={e => onChange(binding_name, e.target.checked)}
              disabled={isDisabled}
              className="w-4 h-4 rounded accent-[var(--c-primary)]" />
          </div>
        )

      case control_types.switch: {
        const on = (value as boolean) ?? false
        return (
          <div className="pt-1">
            <button type="button" role="switch" aria-checked={on}
              disabled={isDisabled}
              onClick={() => !isDisabled && onChange(binding_name, !on)}
              className="relative w-10 h-5 rounded-full transition-colors disabled:opacity-50"
              style={{ background: on ? 'var(--c-primary)' : 'var(--c-border-strong)' }}>
              <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: on ? 'translateX(1.25rem)' : 'translateX(0.125rem)' }} />
            </button>
          </div>
        )
      }

      // ── Searchable dropdowns ───────────────────────────────────────────────
      case control_types.dropdown:
        return (
          <SearchableDropdown
            options={options}
            value={value}
            onChange={v => onChange(binding_name, v)}
            loading={loadingOptions}
            disabled={isDisabled}
            required={isRequired}
            multiple={false}
          />
        )

      case control_types.dropdownMultiselect:
        return (
          <SearchableDropdown
            options={options}
            value={value}
            onChange={v => onChange(binding_name, v)}
            loading={loadingOptions}
            disabled={isDisabled}
            required={isRequired}
            multiple
          />
        )

      // ── Tree view ──────────────────────────────────────────────────────────
      case control_types.treeViewSingle:
        return (
          <TreeViewSelect
            value={value}
            onChange={v => onChange(binding_name, v)}
            binding_list_route_name={binding_list_route_name}
            cascade_from_binding_name={cascade_from_binding_name}
            cascadeValue={cascadeValue}
            disabled={isDisabled}
            required={isRequired}
            multiple={false}
          />
        )

      case control_types.treeViewMulti:
        return (
          <TreeViewSelect
            value={value}
            onChange={v => onChange(binding_name, v)}
            binding_list_route_name={binding_list_route_name}
            cascade_from_binding_name={cascade_from_binding_name}
            cascadeValue={cascadeValue}
            disabled={isDisabled}
            required={isRequired}
            multiple
          />
        )

      // ── File / image ───────────────────────────────────────────────────────
      case control_types.fileUpload:
      case control_types.image: {
        const filename = value as string | null
        const src = filename
          ? `/api/profile-pics/download?filename=${encodeURIComponent(filename)}`
          : null
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const [previewing, setPreviewing] = useState(false)
        return (
          <>
            <div className="flex items-center gap-3">
              {control_type_id === control_types.image && src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name} className="h-12 w-12 rounded-xl object-cover border"
                  style={{ borderColor: 'var(--c-border-strong)' }} />
              )}
              {control_type_id === control_types.fileUpload && filename && (
                <span className="text-[12px] truncate max-w-[160px]" style={{ color: 'var(--c-t3)' }}>
                  {filename.split('/').pop()}
                </span>
              )}
              <input ref={fileRef} type="file"
                accept={control_type_id === control_types.image ? 'image/*' : undefined}
                className="hidden" onChange={handleFileUpload} />
              {src && (
                <button type="button" onClick={() => setPreviewing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition"
                  style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}>
                  <Eye size={11} /> Preview
                </button>
              )}
              {!isDisabled && (
                <button type="button" disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition disabled:opacity-50"
                  style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}>
                  {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                  {uploading ? 'Uploading…' : filename ? 'Replace' : 'Upload'}
                </button>
              )}
            </div>
            {previewing && src && filename && (
              <FilePreview url={src} filename={filename} onClose={() => setPreviewing(false)} />
            )}
          </>
        )
      }

      // ── Hyperlink ──────────────────────────────────────────────────────────
      case control_types.hyperlink: {
        const href = (data?.default_value as string) ?? '#'
        return (
          <a href={href} className="text-[13px] underline" style={{ color: 'var(--c-primary)' }}>
            {name}
          </a>
        )
      }

      // ── Color picker ───────────────────────────────────────────────────────
      case control_types.colorPicker:
        return (
          <div className="flex items-center gap-2">
            <input type="color"
              value={(value as string) ?? '#6366f1'}
              onChange={e => onChange(binding_name, e.target.value)}
              disabled={isDisabled}
              className="h-10 w-14 rounded-xl border cursor-pointer p-0.5"
              style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)' }} />
            <span className="text-[12px] font-mono" style={{ color: 'var(--c-t3)' }}>
              {(value as string) ?? '#6366f1'}
            </span>
          </div>
        )

      // ── Geo location ───────────────────────────────────────────────────────
      case control_types.geoLocation: {
        const geo = (value as { lat?: number; lng?: number }) ?? {}
        return (
          <div className="flex gap-2">
            <input type="number" placeholder="Latitude"
              value={geo.lat ?? ''} step="any"
              onChange={e => onChange(binding_name, { ...geo, lat: e.target.value ? parseFloat(e.target.value) : undefined })}
              disabled={isDisabled}
              className={`${INPUT_CLASS} flex-1`} style={INPUT_STYLE} />
            <input type="number" placeholder="Longitude"
              value={geo.lng ?? ''} step="any"
              onChange={e => onChange(binding_name, { ...geo, lng: e.target.value ? parseFloat(e.target.value) : undefined })}
              disabled={isDisabled}
              className={`${INPUT_CLASS} flex-1`} style={INPUT_STYLE} />
          </div>
        )
      }

      // ── HTML editor (basic) ────────────────────────────────────────────────
      case control_types.htmlEditor:
        return (
          <textarea value={(value as string) ?? ''}
            onChange={e => onChange(binding_name, e.target.value)}
            disabled={isDisabled} required={isRequired}
            rows={6}
            placeholder="Enter HTML…"
            className={`${INPUT_CLASS} resize-y font-mono text-[12px]`} style={INPUT_STYLE} />
        )

      // ── HTML parser ────────────────────────────────────────────────────────
      case control_types.htmlParser: {
        const html = (value as string) ?? ''
        return (
          <div
            className="rounded-xl border px-3 py-2 text-[13px] prose prose-sm max-w-none"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', color: 'var(--c-t2)' }}
            dangerouslySetInnerHTML={{ __html: html }} // eslint-disable-line react/no-danger
          />
        )
      }

      // ── Markdown parser ────────────────────────────────────────────────────
      case control_types.markdownParser: {
        const md = (value as string) ?? ''
        return (
          <div className="rounded-xl border px-3 py-2 text-[13px]"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', color: 'var(--c-t2)' }}>
            <ReactMarkdown>{md}</ReactMarkdown>
          </div>
        )
      }

      // ── Reorder list ───────────────────────────────────────────────────────
      case control_types.reorderList:
        // Bound variant: items come from API, names shown, no add/remove
        if (binding_list_route_name) {
          return (
            <BindReorderList
              options={options as DropdownOptionShape[]}
              value={value}
              onChange={ids => onChange(binding_name, ids)}
              disabled={isDisabled}
              loading={loadingOptions}
            />
          )
        }
        // Free-text variant: items are raw strings with add/remove
        return (
          <ReorderList
            value={value}
            onChange={v => onChange(binding_name, v)}
            disabled={isDisabled}
          />
        )

      // ── Tag list ───────────────────────────────────────────────────────────
      case control_types.list:
        return (
          <EditableList
            value={value}
            onChange={v => onChange(binding_name, v)}
            disabled={isDisabled}
          />
        )

      // ── Charts ─────────────────────────────────────────────────────────────
      case control_types.barChart: {
        const chartData = toChartData(loadingOptions ? [] : options.length ? options : value)
        return loadingOptions
          ? <div className="h-40 flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-t4)' }} /></div>
          : <div className="w-full pt-1" style={{ height: 220 }}>
              <Bar data={chartData} options={chartOptions(chartData.isMulti) as never} />
            </div>
      }

      case control_types.lineChart: {
        const chartData = toChartData(loadingOptions ? [] : options.length ? options : value)
        const lineData = chartData.isMulti
          ? {
              ...chartData,
              datasets: chartData.datasets.map((ds, i) => ({
                ...ds,
                tension: 0.4,
                fill: false,
                borderColor: CHART_COLORS[i % CHART_COLORS.length],
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '22',
                pointBackgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                pointRadius: 3,
              })),
            }
          : {
              ...chartData,
              datasets: [{
                ...chartData.datasets[0],
                tension: 0.4,
                fill: true,
                borderColor: CHART_COLORS[0],
                backgroundColor: CHART_COLORS[0] + '14',
                pointBackgroundColor: CHART_COLORS[0],
                pointRadius: 3,
              }],
            }
        return loadingOptions
          ? <div className="h-40 flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-t4)' }} /></div>
          : <div className="w-full pt-1">
              <Line data={lineData} options={chartOptions(chartData.isMulti) as never} />
            </div>
      }

      case control_types.pieChart: {
        const chartData = toChartData(loadingOptions ? [] : options.length ? options : value, true)
        const PIE_OPTIONS = {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: {
              display: true,
              position: 'bottom' as const,
              labels: { color: AXIS_COLOR, font: { size: 11 }, padding: 12, boxWidth: 12, boxHeight: 12 },
            },
            tooltip: { enabled: true },
          },
        }
        return loadingOptions
          ? <div className="h-40 flex items-center justify-center"><Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-t4)' }} /></div>
          : <div className="w-full pt-1 flex justify-center">
              <div style={{ width: '100%', maxWidth: 260 }}>
                <Pie data={chartData} options={PIE_OPTIONS as never} />
              </div>
            </div>
      }

      // ── Table row actions (used in table context, no-op in forms) ──────────
      case control_types.addTableRow:
        return (
          <button type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}>
            <Plus size={12} /> {name}
          </button>
        )

      case control_types.deleteTableRow:
        return (
          <button type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition text-red-500 border-red-200 hover:bg-red-50">
            <Trash2 size={12} /> {name}
          </button>
        )

      // ── Submit (rendered by DynamicForm, not here) ─────────────────────────
      case control_types.submit:
      case control_types.hyperlinkRow:
        return null

      // ── Field condition table ──────────────────────────────────────────────
      case control_types.fieldConditionTable:
        return (
          <FieldConditionTable
            value={value}
            onChange={v => onChange(binding_name, v)}
            binding_list_route_name={binding_list_route_name}
            cascade_from_binding_name={cascade_from_binding_name}
            cascadeValue={cascadeValue}
            disabled={isDisabled}
          />
        )

      default:
        return (
          <div className="rounded-xl border px-3 py-2 text-[12px] italic"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', color: 'var(--c-t5)' }}>
            Control type {control_type_id} not yet supported
          </div>
        )
    }
  }

  // Compact mode: table cells — just the raw input, no label or grid wrapper
  if (compact) return <>{renderInput()}</>

  return (
    <div className={colSpan}>
      <label htmlFor={`ctrl-${id}`}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--c-t4)' }}>
        {name}
        {isRequired && <span className="ml-0.5" style={{ color: '#ef4444' }}>*</span>}
        {editMode && (
          <button type="button"
            onClick={e => { e.preventDefault(); router.push(`/page_section_control?id=${id}`) }}
            className="ml-auto p-0.5 rounded transition hover:bg-[var(--c-hover)] opacity-50 hover:opacity-100"
            title="Edit control">
            <Pencil size={10} />
          </button>
        )}
      </label>
      {renderInput()}
    </div>
  )
}
