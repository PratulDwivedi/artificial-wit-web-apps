'use client'
import { useState } from 'react'
import { Eye, Pencil } from 'lucide-react'

// ── Content renderer (preview pane) ───────────────────────────────────────────

function ContentPreview({ mimeType, value }: { mimeType: string; value: string }) {
  const empty = !value.trim()

  const wrap = (children: React.ReactNode) => (
    <div className="w-full rounded-xl border overflow-hidden flex flex-col"
      style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', minHeight: '200px' }}>
      <div className="flex items-center gap-1.5 px-3 py-2 border-b flex-shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <Eye size={11} style={{ color: 'var(--c-t5)' }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t5)' }}>
          Preview
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3">{children}</div>
    </div>
  )

  if (empty) return wrap(
    <div className="flex flex-col items-center justify-center h-full gap-2 py-8" style={{ color: 'var(--c-t5)' }}>
      <Eye size={18} />
      <span className="text-[11px]">No content yet</span>
    </div>
  )

  if (mimeType.startsWith('image/')) return wrap(
    <div className="flex items-center justify-center h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={value} alt="Preview" className="max-w-full max-h-60 object-contain rounded" />
    </div>
  )

  if (mimeType === 'text/csv') {
    const rows = value.trim().split('\n').map(r =>
      r.split(',').map(c => c.trim().replace(/^"|"$/g, ''))
    )
    return wrap(
      <table className="w-full border-collapse text-[11px]">
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i === 0 ? 'font-semibold' : ''}>
              {row.map((cell, j) => (
                <td key={j} className="px-2 py-1 border"
                  style={{ borderColor: 'var(--c-border)', color: 'var(--c-t2)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (mimeType === 'application/json' || mimeType === 'application/ld+json') {
    let pretty = value
    try { pretty = JSON.stringify(JSON.parse(value), null, 2) } catch { /* keep raw */ }
    return wrap(
      <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all font-mono"
        style={{ color: 'var(--c-t2)' }}>
        {pretty}
      </pre>
    )
  }

  // XML, plain text, markdown, CSS, etc.
  return wrap(
    <pre className="text-[11px] leading-relaxed whitespace-pre-wrap break-all"
      style={{ color: 'var(--c-t2)', fontFamily: mimeType.includes('xml') ? 'monospace' : 'inherit' }}>
      {value}
    </pre>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

interface ResourceContentEditorProps {
  value: string
  onChange: (v: string) => void
  mimeType: string
  label?: string
}

export default function ResourceContentEditor({
  value,
  onChange,
  mimeType,
  label = 'Content',
}: ResourceContentEditorProps) {
  const [preview, setPreview] = useState(false)

  const inputStyle = {
    background:  'var(--c-hover)',
    borderColor: 'var(--c-border-strong)',
    color:       'var(--c-t1)',
  }

  const isHtml  = mimeType === 'text/html'
  const isImage = mimeType.startsWith('image/')

  const labelRow = (extra?: React.ReactNode) => (
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>
        {label}
      </label>
      {extra}
    </div>
  )

  const textarea = (mono = false) => (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      rows={12}
      placeholder={
        isImage
          ? 'Image URL or data:image/...;base64,... string'
          : `${mimeType || 'text'} content…`
      }
      className={`w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition resize-y${mono ? ' font-mono' : ''}`}
      style={{ ...inputStyle, minHeight: '200px' }}
    />
  )

  // ── text/html: Write / Preview tabs ─────────────────────────────────────────
  if (isHtml) {
    return (
      <div className="flex flex-col gap-1.5">
        {labelRow(
          <div className="flex items-center gap-0.5 rounded-lg border p-0.5"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
            {([{ id: 'write', Icon: Pencil }, { id: 'preview', Icon: Eye }] as const).map(({ id, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPreview(id === 'preview')}
                className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition capitalize"
                style={{
                  background: (id === 'preview') === preview ? 'var(--c-active)' : 'transparent',
                  color:      (id === 'preview') === preview ? 'var(--c-t1)'     : 'var(--c-t4)',
                }}>
                <Icon size={11} /> {id}
              </button>
            ))}
          </div>
        )}
        {preview ? (
          <div className="w-full rounded-xl border overflow-hidden"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', minHeight: '200px' }}>
            {value.trim() ? (
              <iframe srcDoc={value} sandbox="allow-scripts" title="HTML preview"
                className="w-full border-0" style={{ height: '300px' }} />
            ) : (
              <div className="flex items-center justify-center h-full py-16 gap-2" style={{ color: 'var(--c-t5)' }}>
                <Eye size={16} />
                <span className="text-[11px]">No content yet</span>
              </div>
            )}
          </div>
        ) : textarea(true)}
      </div>
    )
  }

  // ── image/*: input URL + inline image preview ────────────────────────────────
  if (isImage) {
    return (
      <div className="flex flex-col gap-1.5">
        {labelRow()}
        <div className="grid grid-cols-2 gap-3">
          {textarea()}
          <div className="rounded-xl border overflow-hidden flex flex-col"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', minHeight: '200px' }}>
            <div className="flex items-center gap-1.5 px-3 py-2 border-b flex-shrink-0"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
              <Eye size={11} style={{ color: 'var(--c-t5)' }} />
              <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t5)' }}>Preview</span>
            </div>
            <div className="flex-1 flex items-center justify-center p-3">
              {value.trim() ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={value} alt="Preview" className="max-w-full max-h-48 object-contain rounded" />
              ) : (
                <div className="flex flex-col items-center gap-2" style={{ color: 'var(--c-t5)' }}>
                  <Eye size={18} />
                  <span className="text-[11px]">No image yet</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Everything else: side-by-side write + preview ────────────────────────────
  const mono = mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('css')
  return (
    <div className="flex flex-col gap-1.5">
      {labelRow()}
      <div className="grid grid-cols-2 gap-3">
        {textarea(mono)}
        <ContentPreview mimeType={mimeType} value={value} />
      </div>
    </div>
  )
}
