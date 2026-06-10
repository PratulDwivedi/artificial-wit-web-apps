'use client'

import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import type {
  LabelTemplate, CanvasElement,
  QrElement, BarcodeElement, TextElement,
  RectElement, LineElement, ImageElement,
} from '@/lib/label-template'

// ── Element renderers (pure, positioned absolutely) ───────────────────────────

function QrEl({ el, scale }: { el: QrElement; scale: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    let cancelled = false
    const val = el.value_template?.trim() || 'QR'
    QRCode.toString(val, {
      type: 'svg',
      color: { dark: el.fg || '#000000', light: el.transparent_bg ? '#00000000' : (el.bg || '#ffffff') },
      errorCorrectionLevel: el.error_correction || 'M',
      margin: 1,
    } as Parameters<typeof QRCode.toString>[1]).then(s => {
      if (!cancelled) setSvg(s.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"'))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [el.value_template, el.fg, el.bg, el.error_correction, el.transparent_bg])

  return (
    <div style={{
      position: 'absolute',
      left: el.x_mm * scale, top: el.y_mm * scale,
      width: el.w_mm * scale, height: el.h_mm * scale,
      background: el.transparent_bg ? 'transparent' : (el.bg || '#fff'),
      overflow: 'hidden',
    }}
    // eslint-disable-next-line react/no-danger
    dangerouslySetInnerHTML={{ __html: svg || '' }} />
  )
}

function BarcodeEl({ el, scale }: { el: BarcodeElement; scale: number }) {
  const ref  = useRef<SVGSVGElement>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    const val = el.value_template?.trim() || '0000000'
    try {
      setErr(false)
      JsBarcode(ref.current, val, {
        format: el.format || 'CODE128', lineColor: el.fg || '#000000', background: el.bg || '#ffffff',
        displayValue: el.show_value, width: 1.5, height: 40, margin: 4, fontSize: 11,
      })
    } catch { setErr(true) }
  }, [el.value_template, el.fg, el.bg, el.format, el.show_value])

  return (
    <div style={{
      position: 'absolute',
      left: el.x_mm * scale, top: el.y_mm * scale,
      width: el.w_mm * scale, height: el.h_mm * scale,
      background: el.bg || '#fff',
      overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {err
        ? <span style={{ fontSize: 9, opacity: 0.4 }}>Invalid</span>
        : <svg ref={ref} style={{ width: '100%', height: '100%' }} />}
    </div>
  )
}

function TextEl({ el, scale }: { el: TextElement; scale: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: el.x_mm * scale, top: el.y_mm * scale,
      width: el.w_mm * scale, height: el.h_mm * scale,
      color: el.color || '#000', fontSize: el.font_size || 12,
      fontWeight: el.font_weight || 'normal', textAlign: el.align || 'left',
      fontFamily: el.font_family || 'system-ui',
      overflow: 'hidden', display: 'flex', alignItems: 'center',
      justifyContent: el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start',
      wordBreak: 'break-word', padding: '0 1px',
    }}>
      {el.content || 'Text'}
    </div>
  )
}

function RectEl({ el, scale }: { el: RectElement; scale: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: el.x_mm * scale, top: el.y_mm * scale,
      width: el.w_mm * scale, height: el.h_mm * scale,
      background: el.fill || '#f3f4f6',
      border: `${el.stroke_width || 1}px solid ${el.stroke || '#9ca3af'}`,
      borderRadius: el.radius || 0,
      boxSizing: 'border-box',
    }} />
  )
}

function LineEl({ el, scale }: { el: LineElement; scale: number }) {
  return (
    <div style={{
      position: 'absolute',
      left: el.x_mm * scale, top: el.y_mm * scale,
      width: el.w_mm * scale, height: el.h_mm * scale,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {el.direction === 'v'
        ? <div style={{ width: el.thickness || 1, height: '100%', background: el.color || '#374151', margin: '0 auto' }} />
        : <div style={{ width: '100%', height: el.thickness || 1, background: el.color || '#374151' }} />}
    </div>
  )
}

function ImageEl({ el, scale }: { el: ImageElement; scale: number }) {
  if (!el.url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={el.url} alt="" style={{
    position: 'absolute',
    left: el.x_mm * scale, top: el.y_mm * scale,
    width: el.w_mm * scale, height: el.h_mm * scale,
    objectFit: el.fit || 'contain',
  }} />
}

function ElRenderer({ el, scale }: { el: CanvasElement; scale: number }) {
  switch (el.type) {
    case 'qr':      return <QrEl      el={el} scale={scale} />
    case 'barcode': return <BarcodeEl el={el} scale={scale} />
    case 'text':    return <TextEl    el={el} scale={scale} />
    case 'rect':    return <RectEl    el={el} scale={scale} />
    case 'line':    return <LineEl    el={el} scale={scale} />
    case 'image':   return <ImageEl   el={el} scale={scale} />
  }
}

// ── CodePreview ───────────────────────────────────────────────────────────────

interface Props {
  template:   LabelTemplate
  /** px per mm — default 3.78 (96 dpi equivalent) */
  scale?:     number
  className?: string
}

export function CodePreview({ template, scale = 3.78, className = '' }: Props) {
  const { canvas, elements } = template
  return (
    <div
      className={className}
      style={{
        position:   'relative',
        width:      canvas.width_mm  * scale,
        height:     canvas.height_mm * scale,
        background: canvas.background_color || '#fff',
        flexShrink: 0,
        overflow:   'hidden',
      }}
    >
      {elements.map(el => (
        <ElRenderer key={el.id} el={el} scale={scale} />
      ))}
    </div>
  )
}
