'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileText, Loader2, Menu, Save, Eye,
  ChevronDown, X,
  Search, Calendar,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import { RichEditor } from '@/components/common/RichEditor'
import { FieldConditionTable } from '@/components/common/FieldConditionTable'
import type { ConditionEntry } from '@/components/common/FieldConditionTable'
import { TreeViewSelect } from '@/components/dynamic/TreeViewSelect'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LookupItem { id: number; name: string }
interface PageField  {
  id: number; name: string; binding_name: string
  control_type: string; control_type_id: number
  binding_list_route_name: string | null
}
interface TemplateRecord {
  id: number; name: string
  template_type_id: number | null; page_id: number | null
  language_id: number | null; page_orientation_id: number | null
  is_enabled: boolean
  page_header: string | null; page_body: string | null; page_footer: string | null
  conditions: ConditionEntry[]
}

// ── SearchableSelect ──────────────────────────────────────────────────────────

function SearchableSelect({
  options, value, onChange, placeholder = 'Select…',
}: {
  options: LookupItem[]; value: number | null
  onChange: (id: number | null) => void; placeholder?: string
}) {
  const [open, setOpen]     = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.id === value)
  const filtered = search ? options.filter(o => o.name.toLowerCase().includes(search.toLowerCase())) : options

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch('') }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div ref={ref} className="relative">
      <div onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl border cursor-pointer text-[13px]"
        style={{
          background: 'var(--c-hover)',
          borderColor: open ? 'var(--c-primary)' : 'var(--c-border-strong)',
          color: selected ? 'var(--c-t1)' : 'var(--c-t4)',
          boxShadow: open ? '0 0 0 3px var(--c-primary-light)' : undefined,
        }}>
        <span className="flex-1 truncate">{selected?.name ?? placeholder}</span>
        {selected && (
          <button type="button" onMouseDown={e => { e.stopPropagation(); onChange(null) }}
            className="shrink-0 hover:opacity-70" style={{ color: 'var(--c-t4)' }}>
            <X size={12} />
          </button>
        )}
        <ChevronDown size={13} className="shrink-0" style={{ color: 'var(--c-t4)' }} />
      </div>

      {open && (
        <div className="absolute z-20 top-full mt-1 w-full rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
          <div className="p-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--c-hover)' }}>
              <Search size={11} style={{ color: 'var(--c-t4)' }} />
              <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search…" className="flex-1 bg-transparent outline-none text-[12px]"
                style={{ color: 'var(--c-t1)' }} />
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
            {filtered.length === 0
              ? <div className="py-3 text-center text-[12px]" style={{ color: 'var(--c-t4)' }}>No results</div>
              : filtered.map(opt => (
                <button key={opt.id} type="button"
                  onClick={() => { onChange(opt.id); setOpen(false); setSearch('') }}
                  className="w-full px-3 py-2 text-left text-[13px] transition"
                  style={{ background: opt.id === value ? 'var(--c-active)' : undefined, color: opt.id === value ? 'var(--c-primary)' : 'var(--c-t2)' }}
                  onMouseEnter={e => { if (opt.id !== value) e.currentTarget.style.background = 'var(--c-hover)' }}
                  onMouseLeave={e => { if (opt.id !== value) e.currentTarget.style.background = '' }}>
                  {opt.name}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── TemplatePage ──────────────────────────────────────────────────────────────

export function TemplatePage() {
  const [templateName,   setTemplateName]   = useState('')
  const [templateTypeId, setTemplateTypeId] = useState<number | null>(null)
  const [pageId,         setPageId]         = useState<number | null>(null)
  const [languageId,     setLanguageId]     = useState<number | null>(null)
  const [orientationId,  setOrientationId]  = useState<number | null>(null)
  const [isEnabled,      setIsEnabled]      = useState(true)
  const [headerHtml,     setHeaderHtml]     = useState('')
  const [bodyHtml,       setBodyHtml]       = useState('')
  const [footerHtml,     setFooterHtml]     = useState('')
  const [conditions,     setConditions]     = useState<ConditionEntry[]>([])

  const [languages,      setLanguages]      = useState<LookupItem[]>([])
  const [templateTypes,  setTemplateTypes]  = useState<LookupItem[]>([])
  const [orientations,   setOrientations]   = useState<LookupItem[]>([])
  const [pageFields,     setPageFields]     = useState<PageField[]>([])

  const [fieldSearch,    setFieldSearch]    = useState('')
  const [isSaving,       setIsSaving]       = useState(false)
  const [saveMsg,        setSaveMsg]        = useState<{ text: string; ok: boolean } | null>(null)
  const [activeEditorName, setActiveEditorName] = useState<string>('Header')
  const [loadingFields,  setLoadingFields]  = useState(false)

  const headerEditorRef    = useRef<HTMLDivElement>(null)
  const bodyEditorRef      = useRef<HTMLDivElement>(null)
  const footerEditorRef    = useRef<HTMLDivElement>(null)
  const activeEditorDivRef = useRef<HTMLDivElement | null>(null)

  const searchParams = useSearchParams()
  const recordId     = searchParams.get('id') ?? undefined
  const isEditing    = !!recordId

  const { setSidebarOpen } = useAppStore()

  // Load dropdown data
  useEffect(() => {
    type Env<T> = { is_success: boolean; data: T }
    Promise.all([
      HttpHelper.rpc('fn_get_app_languages',    {}),
      HttpHelper.rpc('fn_get_template_types',   {}),
      HttpHelper.rpc('fn_get_page_orientations', {}),
    ]).then(([langRes, typeRes, orientRes]) => {
      const langEnv = langRes.data as unknown as Env<LookupItem[]>
      if (langEnv?.is_success) setLanguages(langEnv.data ?? [])

      const typeEnv = typeRes.data as unknown as Env<LookupItem[]>
      if (typeEnv?.is_success) setTemplateTypes(typeEnv.data ?? [])

      const orientEnv = orientRes.data as unknown as Env<LookupItem[]>
      if (orientEnv?.is_success) setOrientations(orientEnv.data ?? [])
    })
  }, [])

  // Load existing template when editing
  useEffect(() => {
    if (!recordId) return
    HttpHelper.rpc('fn_get_template', { p_id: parseInt(recordId, 10) })
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: TemplateRecord[] }
        if (!env?.is_success || !env.data?.length) return
        const t = env.data[0]
        setTemplateName(t.name ?? '')
        setTemplateTypeId(t.template_type_id ?? null)
        setPageId(t.page_id ?? null)
        setLanguageId(t.language_id ?? null)
        setOrientationId(t.page_orientation_id ?? null)
        setIsEnabled(t.is_enabled ?? true)
        setHeaderHtml(t.page_header ?? '')
        setBodyHtml(t.page_body ?? '')
        setFooterHtml(t.page_footer ?? '')
        setConditions(t.conditions ?? [])
      })
  }, [recordId])

  // Load page fields when page changes
  useEffect(() => {
    if (!pageId) { setPageFields([]); setFieldSearch(''); return }
    setFieldSearch('')
    setLoadingFields(true)
    HttpHelper.rpc('fn_get_page_controls', { p_page_id: pageId })
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: PageField[] }
        if (env?.is_success) setPageFields(env.data ?? [])
        else setPageFields([])
      })
      .catch(() => setPageFields([]))
      .finally(() => setLoadingFields(false))
  }, [pageId])

  // Insert field placeholder at cursor in active editor (onMouseDown prevents blur)
  const insertField = useCallback((placeholder: string) => {
    const editor = activeEditorDivRef.current
    if (!editor) return
    editor.focus()
    document.execCommand('insertHTML', false,
      `<span style="color:var(--c-primary);font-family:monospace;font-size:12px">${placeholder}</span>`)
    const html = editor.innerHTML
    if (editor === headerEditorRef.current) setHeaderHtml(html)
    else if (editor === bodyEditorRef.current) setBodyHtml(html)
    else if (editor === footerEditorRef.current) setFooterHtml(html)
  }, [])

  const handleSave = useCallback(async () => {
    setIsSaving(true); setSaveMsg(null)
    try {
      const payload = {
        ...(recordId ? { p_id: parseInt(recordId, 10) } : {}),
        p_name:             templateName,
        p_template_type_id: templateTypeId,
        p_page_id:          pageId,
        p_language_id:          languageId,
        p_page_orientation_id:  orientationId,
        p_is_enabled:           isEnabled,
        p_page_header:      headerHtml,
        p_page_body:        bodyHtml,
        p_page_footer:      footerHtml,
        p_conditions:       conditions,
      }
      const { data, error } = await HttpHelper.rpc('fn_save_template', payload)
      if (error) throw new Error(error)
      const env = data as unknown as { is_success: boolean; message: string }
      if (!env?.is_success) throw new Error(env?.message ?? 'Save failed')
      setSaveMsg({ text: env.message ?? 'Template saved successfully', ok: true })
    } catch (e) {
      setSaveMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally { setIsSaving(false) }
  }, [templateName, templateTypeId, pageId, languageId, orientationId, isEnabled, headerHtml, bodyHtml, footerHtml, conditions, recordId])

  const handlePrint = useCallback(() => {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${templateName || 'Template'}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; font-size: 13px; color: #111; }
    .section-label { font-size: 9px; font-weight: 700; text-transform: uppercase;
      letter-spacing: 0.1em; color: #999; margin-bottom: 10px; }
    .header-section, .footer-section { padding: 24px 32px; background: #f9f9f9; }
    .body-section { padding: 28px 32px; }
    .divider { border: none; border-top: 1px solid #e5e7eb; }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="padding:12px 24px;background:#f3f4f6;border-bottom:1px solid #e5e7eb;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:13px;font-weight:600;color:#374151;">${templateName || 'Template'} — Preview</span>
    <button onclick="window.print()" style="padding:6px 16px;background:#4f46e5;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;">Print</button>
  </div>
  ${headerHtml ? `<div class="header-section"><div class="section-label">Header</div>${headerHtml}</div><hr class="divider"/>` : ''}
  ${bodyHtml   ? `<div class="body-section">${bodyHtml}</div>` : ''}
  ${footerHtml ? `<hr class="divider"/><div class="footer-section"><div class="section-label">Footer</div>${footerHtml}</div>` : ''}
</body>
</html>`)
    win.document.close()
    win.focus()
  }, [templateName, headerHtml, bodyHtml, footerHtml])

  function fieldIsDate(f: PageField) {
    return f.control_type_id === 4 || f.control_type?.toLowerCase().includes('date')
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0"
            style={{ color: 'var(--c-t3)' }}>
            <Menu size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-active)' }}>
            <FileText size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--c-t1)' }}>
              {templateName || 'Template'}
            </h1>
            <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>
              {isEditing ? `Editing #${recordId}` : 'Create a new template'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border text-[13px] font-semibold transition"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
            <Eye size={13} /> Preview
          </button>
          <button type="button" disabled={isSaving} onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 btn-primary rounded-xl text-[13px] font-semibold transition disabled:opacity-60">
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {isSaving ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save')}
          </button>
        </div>
      </div>

      {/* Save feedback */}
      {saveMsg && (
        <div className="shrink-0 px-6 py-2.5 text-[12px] border-b"
          style={saveMsg.ok
            ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.2)' }
            : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
          {saveMsg.text}
        </div>
      )}

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Scrollable left content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Template Settings */}
          <section className="rounded-2xl border p-5"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
            <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--c-t1)' }}>Template Settings</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Template Name */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--c-t4)' }}>
                  Template Name <span style={{ color: 'var(--c-primary)' }}>*</span>
                </label>
                <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)}
                  placeholder="e.g. My First Template"
                  className="w-full rounded-xl px-3 py-2 text-[13px] border transition"
                  style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
              </div>

              {/* Template Type */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--c-t4)' }}>
                  Template Type <span style={{ color: 'var(--c-primary)' }}>*</span>
                </label>
                <SearchableSelect options={templateTypes} value={templateTypeId}
                  onChange={setTemplateTypeId} placeholder="Select type…" />
              </div>

              {/* Page */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--c-t4)' }}>
                  Page <span style={{ color: 'var(--c-primary)' }}>*</span>
                </label>
                <TreeViewSelect
                  value={pageId}
                  onChange={v => setPageId(v == null ? null : Number(v))}
                  binding_list_route_name="fn_get_page_list"
                />
              </div>

              {/* Language */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--c-t4)' }}>
                  Language <span style={{ color: 'var(--c-primary)' }}>*</span>
                </label>
                <SearchableSelect options={languages} value={languageId}
                  onChange={setLanguageId} placeholder="Select language…" />
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5" style={{ color: 'var(--c-t4)' }}>
                  Orientation <span style={{ color: 'var(--c-primary)' }}>*</span>
                </label>
                <SearchableSelect options={orientations} value={orientationId}
                  onChange={setOrientationId} placeholder="Select orientation…" />
              </div>

              {/* Enable toggle */}
              <div className="flex items-end pb-0.5">
                <button type="button" onClick={() => setIsEnabled(v => !v)}
                  className="flex items-center gap-3 cursor-pointer">
                  <div className="w-10 h-5 rounded-full relative transition-colors"
                    style={{ background: isEnabled ? 'var(--c-primary)' : '#d1d5db' }}>
                    <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 shadow-sm transition-transform ${isEnabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                  <span className="text-[13px] font-medium" style={{ color: 'var(--c-t2)' }}>Enable Template</span>
                </button>
              </div>
            </div>
          </section>

          {/* Page Content */}
          <section className="rounded-2xl border p-5 space-y-5"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>Page Content</h2>

            {(['Header', 'Body', 'Footer'] as const).map(section => {
              const ref     = section === 'Header' ? headerEditorRef : section === 'Body' ? bodyEditorRef : footerEditorRef
              const html    = section === 'Header' ? headerHtml : section === 'Body' ? bodyHtml : footerHtml
              const setHtml = section === 'Header' ? setHeaderHtml : section === 'Body' ? setBodyHtml : setFooterHtml
              return (
                <div key={section}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-t4)' }}>
                    Page {section}
                  </p>
                  <RichEditor
                    value={html}
                    onChange={setHtml}
                    editorRef={ref}
                    onFocus={() => {
                      setActiveEditorName(section)
                      activeEditorDivRef.current = ref.current
                    }}
                  />
                </div>
              )
            })}
          </section>

          {/* Conditions */}
          <section className="rounded-2xl border p-5"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
            <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--c-t1)' }}>Conditions</h2>
            <FieldConditionTable
              value={conditions}
              onChange={setConditions}
              binding_list_route_name="fn_get_page_controls"
              cascade_from_binding_name="page_id"
              cascadeValue={pageId}
            />
          </section>
        </div>

        {/* ── Right sidebar: Available Fields ────────────────────────────────── */}
        <aside className="w-72 shrink-0 border-l flex flex-col overflow-hidden"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
          <div className="p-4 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
            <h3 className="text-[13px] font-semibold mb-1" style={{ color: 'var(--c-t1)' }}>Available Fields</h3>
            <div className="flex items-center gap-1 mb-3">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'var(--c-hover)', color: 'var(--c-t4)' }}>✕</span>
              <span className="text-[11px]" style={{ color: 'var(--c-t3)' }}>
                Inserting to: <span className="font-semibold" style={{ color: 'var(--c-primary)' }}>{activeEditorName}</span>
              </span>
            </div>
            {/* Search box */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border"
              style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
              <Search size={11} style={{ color: 'var(--c-t4)', flexShrink: 0 }} />
              <input
                type="text"
                value={fieldSearch}
                onChange={e => setFieldSearch(e.target.value)}
                placeholder="Search fields…"
                className="flex-1 bg-transparent outline-none text-[12px]"
                style={{ color: 'var(--c-t1)' }}
              />
              {fieldSearch && (
                <button type="button" onClick={() => setFieldSearch('')}
                  className="opacity-50 hover:opacity-100 transition">
                  <X size={10} style={{ color: 'var(--c-t4)' }} />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {!pageId ? (
              <div className="py-10 text-center">
                <FileText size={22} className="mx-auto mb-2" style={{ color: 'var(--c-t5)' }} />
                <p className="text-[12px]" style={{ color: 'var(--c-t5)' }}>Select a page to see available fields</p>
              </div>
            ) : loadingFields ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
              </div>
            ) : pageFields.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[12px]" style={{ color: 'var(--c-t5)' }}>No fields for this page</p>
              </div>
            ) : (() => {
              const q = fieldSearch.toLowerCase()
              const visible = fieldSearch
                ? pageFields.filter(f => f.name.toLowerCase().includes(q) || f.binding_name.toLowerCase().includes(q))
                : pageFields
              return visible.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-[12px]" style={{ color: 'var(--c-t5)' }}>No matching fields</p>
                </div>
              ) : (
              <div className="space-y-1">
                {visible.map(field => (
                  <button key={field.id} type="button"
                    onMouseDown={e => { e.preventDefault(); insertField(`{{${field.binding_name}}}`) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left transition"
                    style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border)', color: 'var(--c-t2)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)'; e.currentTarget.style.borderColor = 'var(--c-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)'; e.currentTarget.style.borderColor = 'var(--c-border)' }}>
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: 'var(--c-panel)' }}>
                      {fieldIsDate(field)
                        ? <Calendar size={12} style={{ color: 'var(--c-t4)' }} />
                        : <span className="text-[11px] font-bold" style={{ color: 'var(--c-t4)', fontFamily: 'serif' }}>T</span>}
                    </div>
                    <span className="flex-1 text-[12px] font-medium truncate">{field.name}</span>
                    <code className="text-[9px] shrink-0 font-mono" style={{ color: 'var(--c-t5)' }}>
                      {`{{${field.binding_name}}}`}
                    </code>
                  </button>
                ))}
              </div>
              )
            })()}
          </div>
        </aside>
      </div>

    </div>
  )
}
