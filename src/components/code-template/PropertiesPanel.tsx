'use client'

import { useRef } from 'react'
import { Search } from 'lucide-react'
import type {
  CanvasElement, QrElement, BarcodeElement, TextElement,
  RectElement, LineElement, ImageElement,
  LabelTemplate, CanvasConfig,
} from '@/lib/label-template'

// ── PageField type (mirrors TemplatePage) ─────────────────────────────────────

export interface PageField {
  id:                      number
  name:                    string
  binding_name:            string
  control_type:            string
  control_type_id:         number
  binding_list_route_name: string | null
}

// ── Shared primitive controls ─────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--c-t5)' }}>
      {children}
    </label>
  )
}

const INPUT_S: React.CSSProperties = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }
const INPUT_C = 'w-full rounded-lg px-2 py-1.5 text-[12px] border transition focus:outline-none focus:ring-1 focus:ring-[var(--c-primary)]'

function ColorPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <Label>{label}</Label>
      <button type="button" onClick={() => ref.current?.click()}
        className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg border text-[12px] transition"
        style={INPUT_S}>
        <span className="w-4 h-4 rounded shrink-0 border" style={{ background: value, borderColor: 'var(--c-border-strong)' }} />
        <span className="font-mono text-[11px]">{value}</span>
      </button>
      <input ref={ref} type="color" value={value} onChange={e => onChange(e.target.value)} className="sr-only" />
    </div>
  )
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex items-center gap-2.5 w-full">
      <div className="w-9 h-5 rounded-full relative shrink-0 transition-colors"
        style={{ background: value ? 'var(--c-primary)' : '#d1d5db' }}>
        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-[12px]" style={{ color: 'var(--c-t2)' }}>{label}</span>
    </button>
  )
}

function SegBtn({ options, value, onChange }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="flex gap-1">
      {options.map(o => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className="flex-1 py-1.5 rounded-lg border text-[11px] font-semibold transition"
          style={{
            borderColor: value === o.value ? 'var(--c-primary)' : 'var(--c-border-strong)',
            background:  value === o.value ? 'var(--c-active)'  : 'var(--c-hover)',
            color:       value === o.value ? 'var(--c-primary)' : 'var(--c-t3)',
          }}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

// ── Field insertion list ──────────────────────────────────────────────────────

function FieldList({ fields, onInsert }: { fields: PageField[]; onInsert: (b: string) => void }) {
  if (fields.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--c-border)' }}>
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--c-t5)' }}>
        Insert Field
      </p>
      <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
        {fields.map(f => (
          <button key={f.id} type="button"
            onMouseDown={e => { e.preventDefault(); onInsert(f.binding_name) }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg border text-left transition text-[11px]"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border)', color: 'var(--c-t2)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)'; e.currentTarget.style.color = 'var(--c-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.color = 'var(--c-t2)' }}>
            <span className="flex-1 truncate">{f.name}</span>
            <code className="text-[9px] font-mono opacity-50">{`{{${f.binding_name}}}`}</code>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Per-element property forms ────────────────────────────────────────────────

function QrProps({ el, onChange, fields }: { el: QrElement; onChange: (p: Partial<QrElement>) => void; fields: PageField[] }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const insertField = (b: string) => {
    const ta  = ref.current
    const ph  = `{{${b}}}`
    const cur = el.value_template
    if (ta) {
      const s = ta.selectionStart ?? cur.length
      const e = ta.selectionEnd   ?? cur.length
      const next = cur.slice(0, s) + ph + cur.slice(e)
      onChange({ value_template: next })
      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + ph.length, s + ph.length) })
    } else {
      onChange({ value_template: cur + ph })
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Value / Data</Label>
        <textarea ref={ref}
          value={el.value_template} rows={2}
          onChange={e => onChange({ value_template: e.target.value })}
          placeholder={`e.g. {{asset_tag}}`}
          className={`${INPUT_C} font-mono text-[11px] resize-y`} style={INPUT_S} />
      </div>
      <div>
        <Label>Error Correction</Label>
        <SegBtn
          options={[{value:'L',label:'L'},{value:'M',label:'M'},{value:'Q',label:'Q'},{value:'H',label:'H'}]}
          value={el.error_correction} onChange={v => onChange({ error_correction: v as QrElement['error_correction'] })} />
      </div>
      <ColorPick label="Foreground" value={el.fg} onChange={v => onChange({ fg: v })} />
      <ColorPick label="Background" value={el.bg} onChange={v => onChange({ bg: v })} />
      <Toggle label="Transparent background" value={el.transparent_bg} onChange={v => onChange({ transparent_bg: v })} />
      <FieldList fields={fields} onInsert={insertField} />
    </div>
  )
}

const BARCODE_FORMATS = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC', 'ITF14', 'MSI']

function BarcodeProps({ el, onChange, fields }: { el: BarcodeElement; onChange: (p: Partial<BarcodeElement>) => void; fields: PageField[] }) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const insertField = (b: string) => {
    const ta  = ref.current
    const ph  = `{{${b}}}`
    const cur = el.value_template
    if (ta) {
      const s = ta.selectionStart ?? cur.length
      const e = ta.selectionEnd   ?? cur.length
      const next = cur.slice(0, s) + ph + cur.slice(e)
      onChange({ value_template: next })
      requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s + ph.length, s + ph.length) })
    } else {
      onChange({ value_template: cur + ph })
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Value / Data</Label>
        <textarea ref={ref}
          value={el.value_template} rows={2}
          onChange={e => onChange({ value_template: e.target.value })}
          placeholder="e.g. {{barcode_id}}"
          className={`${INPUT_C} font-mono text-[11px] resize-y`} style={INPUT_S} />
      </div>
      <div>
        <Label>Format</Label>
        <select value={el.format} onChange={e => onChange({ format: e.target.value })}
          className={`${INPUT_C} appearance-none`} style={INPUT_S}>
          {BARCODE_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <ColorPick label="Foreground" value={el.fg}  onChange={v => onChange({ fg: v })} />
      <ColorPick label="Background" value={el.bg}  onChange={v => onChange({ bg: v })} />
      <Toggle    label="Show value" value={el.show_value} onChange={v => onChange({ show_value: v })} />
      <FieldList fields={fields} onInsert={insertField} />
    </div>
  )
}

const FONTS = ['system-ui', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'monospace']

function TextProps({ el, onChange, fields }: { el: TextElement; onChange: (p: Partial<TextElement>) => void; fields: PageField[] }) {
  const ref = useRef<HTMLInputElement>(null)

  const insertField = (b: string) => {
    const inp = ref.current
    const ph  = `{{${b}}}`
    const cur = el.content
    if (inp) {
      const s = inp.selectionStart ?? cur.length
      const e = inp.selectionEnd   ?? cur.length
      const next = cur.slice(0, s) + ph + cur.slice(e)
      onChange({ content: next })
      requestAnimationFrame(() => { inp.focus(); inp.setSelectionRange(s + ph.length, s + ph.length) })
    } else {
      onChange({ content: cur + ph })
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Content</Label>
        <input ref={ref} type="text" value={el.content}
          onChange={e => onChange({ content: e.target.value })}
          placeholder="e.g. Asset Tag: {{tag}}"
          className={INPUT_C} style={INPUT_S} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Font Size (px)</Label>
          <input type="number" min={6} max={72} value={el.font_size}
            onChange={e => onChange({ font_size: +e.target.value })}
            className={INPUT_C} style={INPUT_S} />
        </div>
        <div>
          <Label>Weight</Label>
          <SegBtn options={[{value:'normal',label:'Reg'},{value:'bold',label:'Bold'}]}
            value={el.font_weight} onChange={v => onChange({ font_weight: v as TextElement['font_weight'] })} />
        </div>
      </div>
      <div>
        <Label>Alignment</Label>
        <SegBtn options={[{value:'left',label:'L'},{value:'center',label:'C'},{value:'right',label:'R'}]}
          value={el.align} onChange={v => onChange({ align: v as TextElement['align'] })} />
      </div>
      <ColorPick label="Color" value={el.color} onChange={v => onChange({ color: v })} />
      <div>
        <Label>Font Family</Label>
        <select value={el.font_family} onChange={e => onChange({ font_family: e.target.value })}
          className={`${INPUT_C} appearance-none`} style={INPUT_S}>
          {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>
      <FieldList fields={fields} onInsert={insertField} />
    </div>
  )
}

function RectProps({ el, onChange }: { el: RectElement; onChange: (p: Partial<RectElement>) => void }) {
  return (
    <div className="space-y-3">
      <ColorPick label="Fill" value={el.fill} onChange={v => onChange({ fill: v })} />
      <ColorPick label="Border Color" value={el.stroke} onChange={v => onChange({ stroke: v })} />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Border Width (px)</Label>
          <input type="number" min={0} max={20} value={el.stroke_width}
            onChange={e => onChange({ stroke_width: +e.target.value })}
            className={INPUT_C} style={INPUT_S} />
        </div>
        <div>
          <Label>Corner Radius</Label>
          <input type="number" min={0} max={999} value={el.radius}
            onChange={e => onChange({ radius: +e.target.value })}
            className={INPUT_C} style={INPUT_S} />
        </div>
      </div>
    </div>
  )
}

function LineProps({ el, onChange }: { el: LineElement; onChange: (p: Partial<LineElement>) => void }) {
  return (
    <div className="space-y-3">
      <ColorPick label="Color" value={el.color} onChange={v => onChange({ color: v })} />
      <div>
        <Label>Thickness (px)</Label>
        <input type="number" min={1} max={20} value={el.thickness}
          onChange={e => onChange({ thickness: +e.target.value })}
          className={INPUT_C} style={INPUT_S} />
      </div>
      <div>
        <Label>Direction</Label>
        <SegBtn options={[{value:'h',label:'Horizontal'},{value:'v',label:'Vertical'}]}
          value={el.direction} onChange={v => onChange({ direction: v as LineElement['direction'] })} />
      </div>
    </div>
  )
}

function ImageProps({ el, onChange }: { el: ImageElement; onChange: (p: Partial<ImageElement>) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)

  const readFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => onChange({ url: e.target?.result as string })
    reader.readAsDataURL(file)
  }

  const onPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) { e.preventDefault(); readFile(file) }
        break
      }
    }
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) readFile(file)
  }

  return (
    <div className="space-y-3">
      {/* Upload / paste / drag-drop zone */}
      <div
        tabIndex={0}
        role="button"
        onPaste={onPaste}
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => fileRef.current?.click()}
        className="relative w-full h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition overflow-hidden focus:outline-none"
        style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)' }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--c-primary)' }}
        onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--c-border-strong)' }}
        onDragEnter={e => { e.currentTarget.style.borderColor = 'var(--c-primary)' }}
        onDragLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border-strong)' }}
      >
        {el.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={el.url} alt="" className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ objectFit: 'contain' }} />
        ) : (
          <div className="flex flex-col items-center gap-1.5 pointer-events-none">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: 'var(--c-t5)' }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <path d="M21 15l-5-5L5 21"/>
            </svg>
            <p className="text-[10px] text-center leading-snug" style={{ color: 'var(--c-t5)' }}>
              Click to upload<br />or paste / drag &amp; drop
            </p>
          </div>
        )}
      </div>

      {el.url && (
        <button type="button" onClick={() => onChange({ url: '' })}
          className="w-full py-1.5 rounded-lg border text-[11px] font-semibold transition"
          style={{ borderColor: '#fca5a5', color: '#ef4444', background: 'rgba(239,68,68,0.06)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}>
          Remove image
        </button>
      )}

      <div>
        <Label>Fit</Label>
        <SegBtn options={[{value:'contain',label:'Contain'},{value:'cover',label:'Cover'},{value:'fill',label:'Fill'}]}
          value={el.fit} onChange={v => onChange({ fit: v as ImageElement['fit'] })} />
      </div>

      <p className="text-[10px]" style={{ color: 'var(--c-t5)' }}>
        Select element then press ⌘V / Ctrl+V anywhere to paste from clipboard
      </p>

      <input ref={fileRef} type="file" accept="image/*" className="sr-only"
        onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = '' }} />
    </div>
  )
}

// ── Canvas properties (nothing selected) ─────────────────────────────────────

function CanvasProps({ canvas, onChange }: { canvas: CanvasConfig; onChange: (p: Partial<CanvasConfig>) => void }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Width (mm)</Label>
          <input type="number" min={10} max={500} value={canvas.width_mm}
            onChange={e => onChange({ width_mm: +e.target.value })}
            className={INPUT_C} style={INPUT_S} />
        </div>
        <div>
          <Label>Height (mm)</Label>
          <input type="number" min={10} max={500} value={canvas.height_mm}
            onChange={e => onChange({ height_mm: +e.target.value })}
            className={INPUT_C} style={INPUT_S} />
        </div>
      </div>
      <ColorPick label="Background" value={canvas.background_color} onChange={v => onChange({ background_color: v })} />
      <div>
        <Label>Grid (mm)</Label>
        <input type="number" min={1} max={50} value={canvas.grid_mm}
          onChange={e => onChange({ grid_mm: +e.target.value })}
          className={INPUT_C} style={INPUT_S} />
      </div>
      <Toggle label="Show grid" value={canvas.show_grid} onChange={v => onChange({ show_grid: v })} />
    </div>
  )
}

// ── Geometry section (shared for all elements) ────────────────────────────────

function GeometrySection({ el, onChange }: { el: CanvasElement; onChange: (p: Partial<CanvasElement>) => void }) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>X (mm)</Label>
          <input type="number" step="0.5" value={el.x_mm.toFixed(1)}
            onChange={e => onChange({ x_mm: +e.target.value } as Partial<CanvasElement>)}
            className={INPUT_C} style={INPUT_S} />
        </div>
        <div>
          <Label>Y (mm)</Label>
          <input type="number" step="0.5" value={el.y_mm.toFixed(1)}
            onChange={e => onChange({ y_mm: +e.target.value } as Partial<CanvasElement>)}
            className={INPUT_C} style={INPUT_S} />
        </div>
        <div>
          <Label>W (mm)</Label>
          <input type="number" min={1} step="0.5" value={el.w_mm.toFixed(1)}
            onChange={e => onChange({ w_mm: +e.target.value } as Partial<CanvasElement>)}
            className={INPUT_C} style={INPUT_S} />
        </div>
        <div>
          <Label>H (mm)</Label>
          <input type="number" min={1} step="0.5" value={el.h_mm.toFixed(1)}
            onChange={e => onChange({ h_mm: +e.target.value } as Partial<CanvasElement>)}
            className={INPUT_C} style={INPUT_S} />
        </div>
      </div>
    </div>
  )
}

// ── PropertiesPanel ───────────────────────────────────────────────────────────

interface Props {
  template:   LabelTemplate
  selectedId: string | null
  fields:     PageField[]
  fieldSearch: string
  onFieldSearchChange: (v: string) => void
  onCanvasChange:  (p: Partial<CanvasConfig>) => void
  onElementChange: (id: string, p: Partial<CanvasElement>) => void
}

export function PropertiesPanel({
  template, selectedId, fields, fieldSearch, onFieldSearchChange, onCanvasChange, onElementChange,
}: Props) {
  const el = template.elements.find(e => e.id === selectedId) ?? null
  const filteredFields = fieldSearch
    ? fields.filter(f => f.name.toLowerCase().includes(fieldSearch.toLowerCase()) || f.binding_name.toLowerCase().includes(fieldSearch.toLowerCase()))
    : fields

  const patch = (p: Partial<CanvasElement>) => { if (el) onElementChange(el.id, p) }

  return (
    <div className="flex flex-col border-l overflow-hidden"
      style={{ width: 240, background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

      {/* Header */}
      <div className="px-3 py-2.5 border-b shrink-0" style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--c-t1)' }}>
          {el ? `${el.type.charAt(0).toUpperCase() + el.type.slice(1)} Properties` : 'Canvas'}
        </p>
        <p className="text-[10px]" style={{ color: 'var(--c-t5)' }}>
          {el ? `Element — ${el.w_mm.toFixed(0)}×${el.h_mm.toFixed(0)} mm` : `${template.canvas.width_mm}×${template.canvas.height_mm} mm`}
        </p>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4">

        {/* Element geometry */}
        {el && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--c-t5)' }}>Position &amp; Size</p>
            <GeometrySection el={el} onChange={patch} />
          </div>
        )}

        {/* Element-specific properties */}
        <div>
          {el ? (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--c-t5)' }}>
                {el.type.charAt(0).toUpperCase() + el.type.slice(1)} Settings
              </p>
              {el.type === 'qr'      && <QrProps      el={el} onChange={patch} fields={filteredFields} />}
              {el.type === 'barcode' && <BarcodeProps  el={el} onChange={patch} fields={filteredFields} />}
              {el.type === 'text'    && <TextProps     el={el} onChange={patch} fields={filteredFields} />}
              {el.type === 'rect'    && <RectProps     el={el} onChange={p => patch(p)} />}
              {el.type === 'line'    && <LineProps     el={el} onChange={p => patch(p)} />}
              {el.type === 'image'   && <ImageProps    el={el} onChange={p => patch(p)} />}
            </>
          ) : (
            <>
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--c-t5)' }}>Canvas Settings</p>
              <CanvasProps canvas={template.canvas} onChange={onCanvasChange} />
            </>
          )}
        </div>

        {/* Field search — show when no element or element supports it */}
        {(!el || ['qr', 'barcode', 'text'].includes(el.type)) && fields.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--c-t5)' }}>Available Fields</p>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border mb-2"
              style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
              <Search size={10} style={{ color: 'var(--c-t5)', flexShrink: 0 }} />
              <input type="text" value={fieldSearch} onChange={e => onFieldSearchChange(e.target.value)}
                placeholder="Search…"
                className="flex-1 bg-transparent outline-none text-[11px]"
                style={{ color: 'var(--c-t1)' }} />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
