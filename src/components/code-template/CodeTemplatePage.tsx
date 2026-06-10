'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Menu, Save, Eye, Loader2, Undo2, Redo2,
  ZoomIn, ZoomOut, RotateCcw, LayoutTemplate,
} from 'lucide-react'
import QRCode from 'qrcode'
import JsBarcode from 'jsbarcode'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import { TreeViewSelect } from '@/components/dynamic/TreeViewSelect'
import { NotificationBadge } from '@/components/common/NotificationBadge'
import { CanvasBoard } from './CanvasBoard'
import { ElementToolbar } from './ElementToolbar'
import { PropertiesPanel, type PageField } from './PropertiesPanel'
import {
  DEFAULT_TEMPLATE,
  makeQr, makeBarcode, makeText, makeRect, makeLine, makeImage, newId,
  type LabelTemplate, type CanvasElement, type CanvasConfig,
} from '@/lib/label-template'

// ── CodeTemplatePage ──────────────────────────────────────────────────────────

export function CodeTemplatePage() {
  const [template,     setTemplate]     = useState<LabelTemplate>({ ...DEFAULT_TEMPLATE })
  const [selectedId,   setSelectedId]   = useState<string | null>(null)
  const [zoom,         setZoom]         = useState(1)
  const [history,      setHistory]      = useState<LabelTemplate[]>([{ ...DEFAULT_TEMPLATE }])
  const [histIdx,      setHistIdx]      = useState(0)
  const [pageFields,   setPageFields]   = useState<PageField[]>([])
  const [fieldSearch,  setFieldSearch]  = useState('')
  const [loadingFields, setLoadingFields] = useState(false)
  const [isSaving,     setIsSaving]     = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ text: string; ok: boolean } | null>(null)

  const histIdxRef  = useRef(0)
  const historyRef  = useRef<LabelTemplate[]>([{ ...DEFAULT_TEMPLATE }])
  const templateRef = useRef<LabelTemplate>(template)
  templateRef.current = template

  const searchParams = useSearchParams()
  const idParam      = searchParams.get('id') ?? undefined
  const recordId     = idParam && idParam !== 'new' ? idParam : undefined
  const isEditing    = !!recordId
  const { setSidebarOpen } = useAppStore()

  // ── History management ────────────────────────────────────────────────────

  const commitTemplate = useCallback((t: LabelTemplate) => {
    const base    = historyRef.current.slice(0, histIdxRef.current + 1)
    const next    = [...base, t].slice(-50)
    historyRef.current  = next
    histIdxRef.current  = next.length - 1
    setHistory(next)
    setHistIdx(next.length - 1)
    setTemplate(t)
  }, [])

  const undo = useCallback(() => {
    if (histIdxRef.current <= 0) return
    const idx = histIdxRef.current - 1
    histIdxRef.current = idx
    setHistIdx(idx)
    setTemplate(historyRef.current[idx])
    setSelectedId(null)
  }, [])

  const redo = useCallback(() => {
    if (histIdxRef.current >= historyRef.current.length - 1) return
    const idx = histIdxRef.current + 1
    histIdxRef.current = idx
    setHistIdx(idx)
    setTemplate(historyRef.current[idx])
    setSelectedId(null)
  }, [])

  const canUndo = histIdx > 0
  const canRedo = histIdx < history.length - 1

  // ── Load existing template ────────────────────────────────────────────────

  useEffect(() => {
    if (!recordId) return
    HttpHelper.rpc('fn_get_code_templates', { p_id: parseInt(recordId, 10) })
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: { name: string; page_id: number | null; canvas: LabelTemplate | string | null }[] }
        if (!env?.is_success || !env.data?.length) return
        const row = env.data[0]
        let loaded: LabelTemplate = { ...DEFAULT_TEMPLATE }
        if (row.canvas) {
          try {
            loaded = typeof row.canvas === 'string'
              ? JSON.parse(row.canvas)
              : row.canvas
          } catch { /* ignore */ }
        }
        loaded = { ...loaded, name: row.name ?? '', page_id: row.page_id ?? null }
        const initial = [loaded]
        historyRef.current  = initial
        histIdxRef.current  = 0
        setHistory(initial)
        setHistIdx(0)
        setTemplate(loaded)
      })
  }, [recordId])

  // ── Load page fields ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!template.page_id) { setPageFields([]); setFieldSearch(''); return }
    setFieldSearch('')
    setLoadingFields(true)
    HttpHelper.rpc('fn_get_page_controls', { p_page_id: template.page_id })
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: PageField[] }
        if (env?.is_success) setPageFields(env.data ?? [])
        else setPageFields([])
      })
      .catch(() => setPageFields([]))
      .finally(() => setLoadingFields(false))
  }, [template.page_id])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        const t = templateRef.current
        commitTemplate({ ...t, elements: t.elements.filter(el => el.id !== selectedId) })
        setSelectedId(null)
      }

      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo() }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo() }

      if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
        e.preventDefault()
        if (!selectedId) return
        const t = templateRef.current
        const src = t.elements.find(el => el.id === selectedId)
        if (!src) return
        const clone: CanvasElement = { ...src, id: newId(), x_mm: src.x_mm + 5, y_mm: src.y_mm + 5 }
        commitTemplate({ ...t, elements: [...t.elements, clone] })
        setSelectedId(clone.id)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedId, undo, redo, commitTemplate])

  // ── Global paste → image element ─────────────────────────────────────────

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const sel = selectedId
      if (!sel) return
      const el = templateRef.current.elements.find(x => x.id === sel)
      if (!el || el.type !== 'image') return
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (!file) continue
          e.preventDefault()
          const reader = new FileReader()
          reader.onload = ev => {
            const dataUrl = ev.target?.result as string
            const t = templateRef.current
            commitTemplate({ ...t, elements: t.elements.map(x => x.id === sel ? { ...x, url: dataUrl } : x) })
          }
          reader.readAsDataURL(file)
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [selectedId, commitTemplate])

  // ── Element operations ────────────────────────────────────────────────────

  const handleAdd = useCallback((type: CanvasElement['type']) => {
    const t = templateRef.current
    let el: CanvasElement
    switch (type) {
      case 'qr':      el = makeQr(t.canvas);      break
      case 'barcode': el = makeBarcode(t.canvas);  break
      case 'text':    el = makeText(t.canvas);     break
      case 'rect':    el = makeRect(t.canvas);     break
      case 'line':    el = makeLine(t.canvas);     break
      case 'image':   el = makeImage(t.canvas);    break
    }
    commitTemplate({ ...t, elements: [...t.elements, el] })
    setSelectedId(el.id)
  }, [commitTemplate])

  const handleDelete = useCallback((id: string) => {
    const t = templateRef.current
    commitTemplate({ ...t, elements: t.elements.filter(el => el.id !== id) })
    if (selectedId === id) setSelectedId(null)
  }, [commitTemplate, selectedId])

  const handleToggleLock = useCallback((id: string) => {
    const t = templateRef.current
    commitTemplate({ ...t, elements: t.elements.map(el => el.id === id ? { ...el, locked: !el.locked } : el) })
  }, [commitTemplate])

  const handleReorder = useCallback((id: string, dir: 'up' | 'down') => {
    const t = templateRef.current
    const arr = [...t.elements]
    const i = arr.findIndex(el => el.id === id)
    if (i < 0) return
    if (dir === 'up'   && i < arr.length - 1) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]] }
    if (dir === 'down' && i > 0)               { [arr[i], arr[i - 1]] = [arr[i - 1], arr[i]] }
    commitTemplate({ ...t, elements: arr })
  }, [commitTemplate])

  // ── Canvas + element property changes ─────────────────────────────────────

  const handleCanvasChange = useCallback((patch: Partial<CanvasConfig>) => {
    const t = templateRef.current
    commitTemplate({ ...t, canvas: { ...t.canvas, ...patch } })
  }, [commitTemplate])

  const handleElementChange = useCallback((id: string, patch: Partial<CanvasElement>) => {
    const t = templateRef.current
    commitTemplate({ ...t, elements: t.elements.map(el => el.id === id ? { ...el, ...patch } as CanvasElement : el) })
  }, [commitTemplate])

  // ── CanvasBoard live + committed updates ──────────────────────────────────

  const handleElements = useCallback((els: CanvasElement[], commit: boolean) => {
    const t = templateRef.current
    const updated = { ...t, elements: els }
    if (commit) commitTemplate(updated)
    else setTemplate(updated)
  }, [commitTemplate])

  // ── Name / page updates (no history) ─────────────────────────────────────

  const setName = (name: string) => {
    const t = templateRef.current
    const updated = { ...t, name }
    templateRef.current = updated
    setTemplate(updated)
    // also update current history entry so save picks up new name
    const h = [...historyRef.current]
    h[histIdxRef.current] = updated
    historyRef.current = h
    setHistory(h)
  }

  const setPageId = (id: number | null) => {
    const t = templateRef.current
    const updated = { ...t, page_id: id }
    templateRef.current = updated
    setTemplate(updated)
  }

  // ── Print / Preview ───────────────────────────────────────────────────────

  const handlePrint = useCallback(async () => {
    const win = window.open('', '_blank', 'width=700,height=600')
    if (!win) return
    const { canvas, elements } = templateRef.current

    const htmlParts = await Promise.all(elements.map(async el => {
      const b = `position:absolute;left:${el.x_mm}mm;top:${el.y_mm}mm;width:${el.w_mm}mm;height:${el.h_mm}mm;overflow:hidden;`

      if (el.type === 'qr') {
        const val = el.value_template?.trim() || 'QR'
        try {
          const url = await QRCode.toDataURL(val, {
            color: { dark: el.fg, light: el.transparent_bg ? '#00000000' : el.bg },
            errorCorrectionLevel: el.error_correction,
            margin: 1, scale: 8,
          } as Parameters<typeof QRCode.toDataURL>[1])
          return `<img src="${url}" style="${b}object-fit:contain;" />`
        } catch { return `<div style="${b}background:${el.bg};"></div>` }
      }

      if (el.type === 'barcode') {
        const val = el.value_template?.trim() || '0000000'
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        try {
          JsBarcode(svg, val, {
            format: el.format, lineColor: el.fg, background: el.bg,
            displayValue: el.show_value, width: 1.5, height: 40, margin: 4, fontSize: 11,
          })
          const inner = svg.outerHTML.replace(/width="[^"]*"/, 'width="100%"').replace(/height="[^"]*"/, 'height="100%"')
          return `<div style="${b}background:${el.bg};display:flex;align-items:center;justify-content:center;">${inner}</div>`
        } catch { return `<div style="${b}background:${el.bg};"></div>` }
      }

      if (el.type === 'text') {
        const jc = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start'
        return `<div style="${b}font-size:${el.font_size}px;font-weight:${el.font_weight};color:${el.color};font-family:${el.font_family};display:flex;align-items:center;justify-content:${jc};word-break:break-word;">${el.content}</div>`
      }

      if (el.type === 'rect') {
        return `<div style="${b}background:${el.fill};border:${el.stroke_width}px solid ${el.stroke};border-radius:${el.radius}px;box-sizing:border-box;"></div>`
      }

      if (el.type === 'line') {
        const ls = el.direction === 'h'
          ? `width:100%;height:${el.thickness}px;background:${el.color};margin:auto;`
          : `width:${el.thickness}px;height:100%;background:${el.color};margin:0 auto;`
        return `<div style="${b}display:flex;align-items:center;justify-content:center;"><div style="${ls}"></div></div>`
      }

      if (el.type === 'image') {
        return `<img src="${el.url}" style="${b}object-fit:${el.fit};" />`
      }

      return ''
    }))

    const name = templateRef.current.name || 'Label Template'
    win.document.write(`<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>${name}</title>
  <style>
    @page{size:${canvas.width_mm}mm ${canvas.height_mm}mm;margin:0}
    *{box-sizing:border-box;margin:0;padding:0}
    body{width:${canvas.width_mm}mm;height:${canvas.height_mm}mm;background:${canvas.background_color};}
    .canvas{position:relative;width:${canvas.width_mm}mm;height:${canvas.height_mm}mm;overflow:hidden;}
    .no-print{position:fixed;top:8px;right:8px;z-index:9999;}
    @media print{.no-print{display:none;}}
  </style>
</head><body>
  <button class="no-print" onclick="window.print()"
    style="padding:5px 14px;background:#4f46e5;color:#fff;border:none;border-radius:7px;font-size:12px;font-weight:600;cursor:pointer;">
    Print
  </button>
  <div class="canvas">
    ${htmlParts.join('\n    ')}
  </div>
</body></html>`)
    win.document.close()
    win.focus()
  }, [])

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    setIsSaving(true); setSaveMsg(null)
    try {
      const t = templateRef.current
      const payload = {
        ...(recordId ? { p_id: parseInt(recordId, 10) } : {}),
        p_name:        t.name,
        p_page_id:     t.page_id,
        p_canvas: t,
      }
      const { data, error } = await HttpHelper.rpc('fn_save_code_template', payload)
      if (error) throw new Error(error as string)
      const env = data as unknown as { is_success: boolean; message: string }
      if (!env?.is_success) throw new Error(env?.message ?? 'Save failed')
      setSaveMsg({ text: env.message ?? 'Saved', ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setIsSaving(false) }
  }, [recordId])

  // ── Zoom helpers ──────────────────────────────────────────────────────────

  const zoomIn  = () => setZoom(z => Math.min(3, parseFloat((z + 0.25).toFixed(2))))
  const zoomOut = () => setZoom(z => Math.max(0.25, parseFloat((z - 0.25).toFixed(2))))
  const zoomReset = () => setZoom(1)

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b gap-3"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>

        {/* Left: menu + icon + name */}
        <div className="flex items-center gap-2 min-w-0">
          <button type="button" onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0"
            style={{ color: 'var(--c-t3)' }}>
            <Menu size={17} />
          </button>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-active)' }}>
            <LayoutTemplate size={14} style={{ color: 'var(--c-primary)' }} />
          </div>
          <input
            type="text"
            value={template.name}
            onChange={e => setName(e.target.value)}
            placeholder="Template name…"
            className="bg-transparent outline-none text-[14px] font-semibold w-48 truncate"
            style={{ color: 'var(--c-t1)' }}
          />
          {isEditing && (
            <span className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--c-hover)', color: 'var(--c-t5)' }}>
              #{recordId}
            </span>
          )}
        </div>

        {/* Centre: Page selector */}
        <div className="flex-1 min-w-0 max-w-xs hidden md:block">
          <TreeViewSelect
            value={template.page_id}
            onChange={v => setPageId(v == null ? null : Number(v))}
            binding_list_route_name="fn_get_page_list"
          />
        </div>

        {/* Right: zoom, undo, redo, preview, save, notifs */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Zoom */}
          <div className="flex items-center gap-0.5 border rounded-lg overflow-hidden"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)' }}>
            <button type="button" onClick={zoomOut}
              className="p-1.5 transition hover:bg-[var(--c-active)]" title="Zoom out"
              style={{ color: 'var(--c-t3)' }}>
              <ZoomOut size={13} />
            </button>
            <button type="button" onClick={zoomReset}
              className="px-2 text-[11px] font-mono font-semibold min-w-[42px] text-center transition hover:bg-[var(--c-active)]"
              style={{ color: 'var(--c-t2)' }} title="Reset zoom">
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={zoomIn}
              className="p-1.5 transition hover:bg-[var(--c-active)]" title="Zoom in"
              style={{ color: 'var(--c-t3)' }}>
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Undo / Redo */}
          <button type="button" onClick={undo} disabled={!canUndo}
            className="p-1.5 rounded-lg border transition disabled:opacity-30"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', color: 'var(--c-t3)' }}
            title="Undo (⌘Z)"
            onMouseEnter={e => { if (canUndo) e.currentTarget.style.background = 'var(--c-active)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
            <Undo2 size={13} />
          </button>
          <button type="button" onClick={redo} disabled={!canRedo}
            className="p-1.5 rounded-lg border transition disabled:opacity-30"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-hover)', color: 'var(--c-t3)' }}
            title="Redo (⌘Y)"
            onMouseEnter={e => { if (canRedo) e.currentTarget.style.background = 'var(--c-active)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
            <Redo2 size={13} />
          </button>

          {/* Preview */}
          <button type="button" onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-semibold transition"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
            <Eye size={12} /> Preview
          </button>

          {/* Save */}
          <button type="button" disabled={isSaving} onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 btn-primary rounded-lg text-[12px] font-semibold transition disabled:opacity-60">
            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {isSaving ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}
          </button>

          <NotificationBadge />
        </div>
      </div>

      {/* Save feedback */}
      {saveMsg && (
        <div className="shrink-0 px-5 py-2 text-[12px] border-b"
          style={saveMsg.ok
            ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.2)' }
            : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
          {saveMsg.text}
        </div>
      )}

      {/* Loading indicator */}
      {loadingFields && (
        <div className="shrink-0 px-5 py-1.5 text-[11px] border-b flex items-center gap-2"
          style={{ borderColor: 'var(--c-border)', color: 'var(--c-t5)', background: 'var(--c-panel)' }}>
          <Loader2 size={11} className="animate-spin" />
          Loading page fields…
        </div>
      )}

      {/* ── Main 3-panel layout ──────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: element toolbar + layers */}
        <ElementToolbar
          template={template}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={handleAdd}
          onDelete={handleDelete}
          onToggleLock={handleToggleLock}
          onReorder={handleReorder}
        />

        {/* Centre: canvas */}
        <CanvasBoard
          template={template}
          selectedId={selectedId}
          zoom={zoom}
          onSelect={setSelectedId}
          onElements={handleElements}
        />

        {/* Right: properties panel */}
        <PropertiesPanel
          template={template}
          selectedId={selectedId}
          fields={pageFields}
          fieldSearch={fieldSearch}
          onFieldSearchChange={setFieldSearch}
          onCanvasChange={handleCanvasChange}
          onElementChange={handleElementChange}
        />

      </div>
    </div>
  )
}
