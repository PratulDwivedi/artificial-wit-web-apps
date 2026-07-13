'use client'

import { useEffect } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
import { formatDateTimeValue } from '@/lib/datetime'
import { HtmlParser } from '@/components/common/HtmlParser'
import ReactMarkdown from 'react-markdown'

type Row = Record<string, unknown>

export interface ViewControl {
  id: number
  name: string
  binding_name: string
  control_type_id: number
  data?: Record<string, unknown> | null
}

interface Props {
  row: Row
  controls: ViewControl[]
  title?: string
  onClose: () => void
}

function resolvePath(row: Row, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, key) => {
    if (cur != null && typeof cur === 'object') return (cur as Row)[key]
    return undefined
  }, row)
}

function FieldValue({ control, row }: { control: ViewControl; row: Row }) {
  const { control_types } = APP_CONSTANTS
  const datetimeFormat = useAppStore(s => s.datetimeFormat)
  const timeZone       = useAppStore(s => s.timeZone)
  const raw = resolvePath(row, control.binding_name)
  const ct  = control.control_type_id

  if (raw === null || raw === undefined) {
    return <span className="text-[13px]" style={{ color: 'var(--c-t5)' }}>—</span>
  }

  // Date / DateTime — same tenant format + timezone as the report table cells
  if (ct === control_types.date || ct === control_types.dateAndTime) {
    return (
      <span className="text-[13px]" style={{ color: 'var(--c-t1)' }}>
        {formatDateTimeValue(raw, datetimeFormat, timeZone, ct === control_types.date)}
      </span>
    )
  }

  // Boolean / checkbox / switch
  if (ct === control_types.checkbox || ct === control_types.switch || typeof raw === 'boolean') {
    const yes = raw === true || raw === 1 || raw === '1' || raw === 'true'
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold"
        style={{
          background: yes ? 'rgba(22,163,74,0.12)' : 'rgba(107,114,128,0.1)',
          color:      yes ? '#16a34a'               : 'var(--c-t4)',
        }}>
        {yes ? 'Yes' : 'No'}
      </span>
    )
  }

  // HTML editor / parser — render in isolated iframe
  if (ct === control_types.htmlEditor || ct === control_types.htmlParser) {
    return (
      <HtmlParser
        html={String(raw)}
        className="rounded-lg border text-[13px]"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}
      />
    )
  }

  // Markdown
  if (ct === control_types.markdownParser) {
    return (
      <div className="prose prose-sm max-w-none text-[13px]" style={{ color: 'var(--c-t2)' }}>
        <ReactMarkdown>{String(raw)}</ReactMarkdown>
      </div>
    )
  }

  // Image
  if (ct === control_types.image) {
    const src = String(raw)
    return (
      <img src={src} alt={control.name}
        className="max-h-40 rounded-lg border object-contain"
        style={{ borderColor: 'var(--c-border)' }} />
    )
  }

  // URL / hyperlink — clickable
  if (ct === control_types.url || ct === control_types.hyperlink) {
    const href = String(raw)
    return (
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[13px] underline underline-offset-2 transition hover:opacity-70"
        style={{ color: 'var(--c-primary)' }}>
        <span className="truncate max-w-[280px]">{href}</span>
        <ExternalLink size={11} className="shrink-0" />
      </a>
    )
  }

  // Color picker
  if (ct === control_types.colorPicker) {
    const color = String(raw)
    return (
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded border shrink-0"
          style={{ background: color, borderColor: 'var(--c-border)' }} />
        <span className="text-[13px] font-mono" style={{ color: 'var(--c-t2)' }}>{color}</span>
      </div>
    )
  }

  // Textarea / long text — preserve whitespace
  if (ct === control_types.textArea) {
    return (
      <p className="text-[13px] whitespace-pre-wrap leading-relaxed" style={{ color: 'var(--c-t1)' }}>
        {String(raw)}
      </p>
    )
  }

  // Default — plain text
  return (
    <span className="text-[13px]" style={{ color: 'var(--c-t1)' }}>{String(raw)}</span>
  )
}

export function DynamicViewRecord({ row, controls, title, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // Filter out action-only controls (hyperlinks already included above as values, skip hyperlinkRow)
  const { control_types } = APP_CONSTANTS
  const SKIP = new Set<number>([control_types.hyperlinkRow, control_types.submit, control_types.addTableRow, control_types.deleteTableRow])
  const fields = controls.filter(c => !SKIP.has(c.control_type_id))

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[680px] max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b shrink-0"
          style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>
            {title ?? 'Record Details'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Fields */}
        <div className="overflow-y-auto flex-1 p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {fields.map(control => {
              const raw = resolvePath(row, control.binding_name)
              // Full-width for rich/long content types
              const fullWidth =
                control.control_type_id === control_types.htmlEditor  ||
                control.control_type_id === control_types.htmlParser  ||
                control.control_type_id === control_types.markdownParser ||
                control.control_type_id === control_types.textArea    ||
                control.control_type_id === control_types.image
              return (
                <div key={control.id} className={fullWidth ? 'sm:col-span-2' : ''}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-1"
                    style={{ color: 'var(--c-t4)' }}>
                    {control.name}
                  </p>
                  <div className="min-h-[22px]">
                    {(raw === null || raw === undefined)
                      ? <span className="text-[13px]" style={{ color: 'var(--c-t5)' }}>—</span>
                      : <FieldValue control={control} row={row} />
                    }
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 flex justify-end px-5 py-3 border-t"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-[13px] font-medium border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
