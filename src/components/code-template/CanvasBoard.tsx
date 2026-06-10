'use client'

import { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { Lock } from 'lucide-react'
import type {
  CanvasElement, QrElement, BarcodeElement, TextElement,
  RectElement, LineElement, ImageElement,
  LabelTemplate, HandleType,
} from '@/lib/label-template'

// ── Element content renderers ─────────────────────────────────────────────────

function QrContent({ el }: { el: QrElement }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let cancelled = false
    const val = el.value_template?.trim() || 'QR Preview'
    QRCode.toString(val, {
      type: 'svg',
      color: {
        dark:  el.fg || '#000000',
        light: el.transparent_bg ? '#00000000' : (el.bg || '#ffffff'),
      },
      errorCorrectionLevel: el.error_correction || 'M',
      margin: 1,
    } as Parameters<typeof QRCode.toString>[1])
      .then(s => {
        if (!cancelled) setSvg(
          s.replace(/width="[^"]*"/, 'width="100%"')
           .replace(/height="[^"]*"/, 'height="100%"')
        )
      }).catch(() => {})
    return () => { cancelled = true }
  }, [el.value_template, el.fg, el.bg, el.error_correction, el.transparent_bg])

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      style={{ background: el.transparent_bg ? 'transparent' : el.bg || '#fff', overflow: 'hidden' }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg || '' }}
    />
  )
}

function BarcodeContent({ el }: { el: BarcodeElement }) {
  const ref = useRef<SVGSVGElement>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const val = el.value_template?.trim() || '0000000'
    try {
      setErr(false)
      JsBarcode(ref.current, val, {
        format:       el.format || 'CODE128',
        lineColor:    el.fg || '#000000',
        background:   el.bg || '#ffffff',
        displayValue: el.show_value,
        width:        1.5,
        height:       40,
        margin:       4,
        fontSize:     11,
      })
    } catch { setErr(true) }
  }, [el.value_template, el.fg, el.bg, el.format, el.show_value])

  if (err) return (
    <div className="absolute inset-0 flex items-center justify-center text-[9px] text-center px-2 opacity-40">
      Invalid value for {el.format}
    </div>
  )
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ background: el.bg || '#fff' }}>
      <svg ref={ref} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}

function TextContent({ el }: { el: TextElement }) {
  return (
    <div
      className="absolute inset-0 flex items-center overflow-hidden px-1 leading-tight"
      style={{
        color:       el.color       || '#000000',
        fontSize:    el.font_size   || 12,
        fontWeight:  el.font_weight || 'normal',
        textAlign:   el.align       || 'left',
        fontFamily:  el.font_family || 'system-ui',
        wordBreak:   'break-word',
        justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
      }}
    >
      {el.content || 'Text'}
    </div>
  )
}

function RectContent({ el }: { el: RectElement }) {
  return (
    <div className="absolute inset-0" style={{
      background:   el.fill         || '#f3f4f6',
      border:       `${el.stroke_width || 1}px solid ${el.stroke || '#9ca3af'}`,
      borderRadius: el.radius       || 0,
    }} />
  )
}

function LineContent({ el }: { el: LineElement }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {el.direction === 'v'
        ? <div style={{ width: el.thickness || 1, height: '100%', background: el.color || '#374151', margin: '0 auto' }} />
        : <div style={{ width: '100%', height: el.thickness || 1, background: el.color || '#374151' }} />
      }
    </div>
  )
}

function ImageContent({ el }: { el: ImageElement }) {
  if (!el.url) return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 border-2 border-dashed rounded"
      style={{ borderColor: '#d1d5db', color: '#9ca3af' }}>
      <span className="text-[10px]">Image</span>
    </div>
  )
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={el.url} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: el.fit || 'contain' }} />
}

function ElementContent({ el }: { el: CanvasElement }) {
  switch (el.type) {
    case 'qr':      return <QrContent      el={el} />
    case 'barcode': return <BarcodeContent el={el} />
    case 'text':    return <TextContent    el={el} />
    case 'rect':    return <RectContent    el={el} />
    case 'line':    return <LineContent    el={el} />
    case 'image':   return <ImageContent   el={el} />
  }
}

// ── Selection box + resize handles ───────────────────────────────────────────

const HANDLES: { id: HandleType; style: React.CSSProperties }[] = [
  { id: 'nw', style: { top: -5, left: -5, cursor: 'nw-resize' } },
  { id: 'n',  style: { top: -5, left: 'calc(50% - 4px)', cursor: 'n-resize' } },
  { id: 'ne', style: { top: -5, right: -5, cursor: 'ne-resize' } },
  { id: 'e',  style: { top: 'calc(50% - 4px)', right: -5, cursor: 'e-resize' } },
  { id: 'se', style: { bottom: -5, right: -5, cursor: 'se-resize' } },
  { id: 's',  style: { bottom: -5, left: 'calc(50% - 4px)', cursor: 's-resize' } },
  { id: 'sw', style: { bottom: -5, left: -5, cursor: 'sw-resize' } },
  { id: 'w',  style: { top: 'calc(50% - 4px)', left: -5, cursor: 'w-resize' } },
]

function SelectionBox({
  onHandleDown,
}: {
  onHandleDown: (e: React.PointerEvent<HTMLDivElement>, h: HandleType) => void
}) {
  return (
    <div className="absolute pointer-events-none" style={{ inset: -2, border: '2px solid #2563eb', zIndex: 50 }}>
      {HANDLES.map(h => (
        <div
          key={h.id}
          className="absolute pointer-events-auto"
          style={{
            ...h.style,
            width: 9, height: 9,
            background: '#fff',
            border: '2px solid #2563eb',
            borderRadius: 2,
            zIndex: 51,
          }}
          onPointerDown={e => { e.stopPropagation(); onHandleDown(e, h.id) }}
        />
      ))}
    </div>
  )
}

// ── CanvasBoard ───────────────────────────────────────────────────────────────

interface DragState {
  mode:    'move' | 'resize'
  handle?: HandleType
  id:      string
  sx:      number     // startClientX
  sy:      number     // startClientY
  ox:      number     // origX_mm
  oy:      number     // origY_mm
  ow:      number     // origW_mm
  oh:      number     // origH_mm
}

interface Props {
  template:   LabelTemplate
  selectedId: string | null
  zoom:       number
  onSelect:   (id: string | null) => void
  onElements: (els: CanvasElement[], commit: boolean) => void
}

const BASE_PX_PER_MM = 4

export function CanvasBoard({ template, selectedId, zoom, onSelect, onElements }: Props) {
  const scale = BASE_PX_PER_MM * zoom
  const { canvas } = template

  const [localEls, setLocalEls] = useState<CanvasElement[]>(template.elements)
  const dragRef        = useRef<DragState | null>(null)
  const localElsRef    = useRef<CanvasElement[]>(localEls)
  const onElementsRef  = useRef(onElements)
  const scaleRef       = useRef(scale)
  const canvasRef      = useRef(canvas)

  // Keep refs current
  localElsRef.current   = localEls
  onElementsRef.current = onElements
  scaleRef.current      = scale
  canvasRef.current     = canvas

  // Sync from parent when not dragging
  useEffect(() => {
    if (!dragRef.current) setLocalEls(template.elements)
  }, [template.elements])

  // Document-level pointer handlers (mounted once, read from refs)
  useEffect(() => {
    const MIN_MM = 3

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const s  = scaleRef.current
      const cv = canvasRef.current
      const dx = (e.clientX - d.sx) / s
      const dy = (e.clientY - d.sy) / s

      if (d.mode === 'move') {
        const nx = Math.max(0, Math.min(cv.width_mm  - d.ow, d.ox + dx))
        const ny = Math.max(0, Math.min(cv.height_mm - d.oh, d.oy + dy))
        setLocalEls(prev => prev.map(el =>
          el.id === d.id ? { ...el, x_mm: nx, y_mm: ny } as CanvasElement : el
        ))
      } else {
        const h = d.handle!
        let nx = d.ox, ny = d.oy, nw = d.ow, nh = d.oh

        if (h.includes('e')) nw = Math.max(MIN_MM, d.ow + dx)
        if (h.includes('s')) nh = Math.max(MIN_MM, d.oh + dy)
        if (h.includes('w')) { nw = Math.max(MIN_MM, d.ow - dx); nx = d.ox + (d.ow - nw) }
        if (h.includes('n')) { nh = Math.max(MIN_MM, d.oh - dy); ny = d.oy + (d.oh - nh) }

        nx = Math.max(0, nx); ny = Math.max(0, ny)
        nw = Math.min(nw, cv.width_mm  - nx)
        nh = Math.min(nh, cv.height_mm - ny)

        setLocalEls(prev => prev.map(el =>
          el.id === d.id ? { ...el, x_mm: nx, y_mm: ny, w_mm: nw, h_mm: nh } as CanvasElement : el
        ))
      }
    }

    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      onElementsRef.current(localElsRef.current, true)
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)
    }
  }, [])

  const startMove = (e: React.PointerEvent<HTMLDivElement>, el: CanvasElement) => {
    if (el.locked) return
    e.stopPropagation()
    onSelect(el.id)
    dragRef.current = { mode: 'move', id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x_mm, oy: el.y_mm, ow: el.w_mm, oh: el.h_mm }
  }

  const startResize = (e: React.PointerEvent<HTMLDivElement>, el: CanvasElement, handle: HandleType) => {
    e.stopPropagation()
    dragRef.current = { mode: 'resize', handle, id: el.id, sx: e.clientX, sy: e.clientY, ox: el.x_mm, oy: el.y_mm, ow: el.w_mm, oh: el.h_mm }
  }

  const cW = canvas.width_mm  * scale
  const cH = canvas.height_mm * scale

  return (
    <div
      className="flex-1 flex items-center justify-center overflow-auto p-10"
      style={{ background: 'var(--c-base)' }}
      onClick={e => { if (e.target === e.currentTarget) onSelect(null) }}
    >
      {/* Sticker surface */}
      <div
        className="relative shadow-2xl select-none"
        style={{ width: cW, height: cH, background: canvas.background_color, flexShrink: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onSelect(null) }}
      >
        {/* Grid */}
        {canvas.show_grid && (
          <svg className="absolute inset-0 pointer-events-none" width={cW} height={cH}>
            <defs>
              <pattern id="cg" width={canvas.grid_mm * scale} height={canvas.grid_mm * scale} patternUnits="userSpaceOnUse">
                <path d={`M ${canvas.grid_mm * scale} 0 L 0 0 0 ${canvas.grid_mm * scale}`}
                  fill="none" stroke="#d1d5db" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#cg)" />
          </svg>
        )}

        {/* Elements */}
        {localEls.map(el => (
          <div
            key={el.id}
            className="absolute"
            style={{
              left:    el.x_mm * scale,
              top:     el.y_mm * scale,
              width:   el.w_mm * scale,
              height:  el.h_mm * scale,
              cursor:  el.locked ? 'not-allowed' : 'move',
              zIndex:  10,
              overflow: 'visible',
            }}
            onPointerDown={e => startMove(e, el)}
          >
            {/* Content (clipped to element bounds) */}
            <div className="absolute inset-0 overflow-hidden">
              <ElementContent el={el} />
            </div>

            {/* Lock indicator */}
            {el.locked && (
              <div className="absolute top-0.5 right-0.5 z-20">
                <Lock size={8} style={{ color: '#6b7280' }} />
              </div>
            )}

            {/* Selection box */}
            {selectedId === el.id && (
              <SelectionBox onHandleDown={(e, h) => startResize(e, el, h)} />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
