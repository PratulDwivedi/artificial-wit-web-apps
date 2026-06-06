'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Search, Pencil, Trash2, ShieldCheck, Loader2, X, Package, ChevronRight, Check } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import { useEditParam } from '@/lib/useEditParam'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'
import ResourceContentEditor from '@/components/common/ResourceContentEditor'

// ── MIME type options ──────────────────────────────────────────────────────────

const MIME_GROUPS: { group: string; types: string[] }[] = [
  {
    group: 'Text',
    types: ['text/plain', 'text/html', 'text/css', 'text/csv', 'text/markdown', 'text/xml'],
  },
  {
    group: 'Application',
    types: [
      'application/json',
      'application/ld+json',
      'application/xml',
      'application/pdf',
      'application/zip',
      'application/gzip',
      'application/octet-stream',
      'application/x-www-form-urlencoded',
    ],
  },
  {
    group: 'Image',
    types: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml'],
  },
  {
    group: 'Audio / Video',
    types: ['audio/mpeg', 'audio/wav', 'video/mp4', 'video/webm'],
  },
]

const ALL_MIME_TYPES = MIME_GROUPS.flatMap(g => g.types)

// ── Searchable grouped MIME type select ────────────────────────────────────────

function MimeTypeSelect({ value, onChange }: {
  value: string
  onChange: (v: string) => void
}) {
  const [open,       setOpen]       = useState(false)
  const [rect,       setRect]       = useState<DOMRect | null>(null)
  const [query,      setQuery]      = useState('')
  const [expanded,   setExpanded]   = useState<Set<string>>(() => new Set(MIME_GROUPS.map(g => g.group)))
  const [showCustom, setShowCustom] = useState(!!(value && !ALL_MIME_TYPES.includes(value)))
  const [custom,     setCustom]     = useState(value && !ALL_MIME_TYPES.includes(value) ? value : '')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef  = useRef<HTMLInputElement>(null)

  const displayVal = showCustom ? (custom || value) : value

  const openDropdown = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => searchRef.current?.focus())
  }
  const close = () => { setOpen(false); setQuery('') }

  const select = (v: string) => {
    if (v === '__custom__') {
      setShowCustom(true); setCustom(''); onChange(''); close()
    } else {
      setShowCustom(false); onChange(v); close()
    }
  }

  const toggleGroup = (g: string) => setExpanded(prev => {
    const next = new Set(prev)
    next.has(g) ? next.delete(g) : next.add(g)
    return next
  })

  const filteredGroups = query
    ? MIME_GROUPS.map(g => ({ ...g, types: g.types.filter(t => t.includes(query.toLowerCase())) }))
        .filter(g => g.types.length > 0)
    : MIME_GROUPS

  const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

  return (
    <>
      <button type="button" ref={triggerRef} onClick={openDropdown}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-[13px] border text-left transition"
        style={inputStyle}>
        <span className="flex-1 truncate font-mono text-[12px]"
          style={{ color: displayVal ? 'var(--c-t1)' : 'var(--c-t5)' }}>
          {displayVal || 'Select MIME type…'}
        </span>
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {value && (
            <span role="button" onClick={e => { e.stopPropagation(); setShowCustom(false); setCustom(''); onChange('') }}
              className="hover:opacity-70 cursor-pointer" style={{ color: 'var(--c-t4)' }}>
              <X size={11} />
            </span>
          )}
          <ChevronRight size={11} className={`transition-transform ${open ? 'rotate-90' : ''}`}
            style={{ color: 'var(--c-t4)' }} />
        </div>
      </button>

      {showCustom && (
        <input value={custom}
          onChange={e => { setCustom(e.target.value); onChange(e.target.value) }}
          autoFocus placeholder="e.g. application/vnd.custom+json"
          className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition mt-2 font-mono"
          style={inputStyle} />
      )}

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={close} />
          <div className="fixed z-[201] rounded-xl border shadow-2xl flex flex-col overflow-hidden"
            style={{
              top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 280),
              maxHeight: 320, background: 'var(--c-panel)', borderColor: 'var(--c-border)',
            }}>
            {/* Search */}
            <div className="px-3 py-2 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t4)' }} />
                <input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search MIME types…"
                  className="w-full pl-6 pr-2 bg-transparent text-[12px] focus:outline-none"
                  style={{ color: 'var(--c-t1)' }} />
              </div>
            </div>

            {/* Groups */}
            <div className="overflow-y-auto flex-1">
              {filteredGroups.map(g => {
                const isExpanded = query ? true : expanded.has(g.group)
                return (
                  <div key={g.group}>
                    <button type="button" onClick={() => !query && toggleGroup(g.group)}
                      className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition hover:bg-[var(--c-hover)]"
                      style={{ cursor: query ? 'default' : 'pointer' }}>
                      <ChevronRight size={10}
                        className={`transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                        style={{ color: 'var(--c-t5)' }} />
                      <span className="text-[10px] font-bold uppercase tracking-wider flex-1"
                        style={{ color: 'var(--c-t4)' }}>{g.group}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: 'var(--c-hover)', color: 'var(--c-t5)' }}>
                        {g.types.length}
                      </span>
                    </button>
                    {isExpanded && g.types.map(t => (
                      <button key={t} type="button" onClick={() => select(t)}
                        className="w-full flex items-center justify-between px-3 py-2 pl-8 text-left text-[12px] font-mono transition hover:bg-[var(--c-hover)]"
                        style={{ color: t === value ? 'var(--c-primary)' : 'var(--c-t2)', fontWeight: t === value ? 600 : undefined }}>
                        <span className="truncate">{t}</span>
                        {t === value && <Check size={11} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />}
                      </button>
                    ))}
                  </div>
                )
              })}
              <button type="button" onClick={() => select('__custom__')}
                className="w-full flex items-center px-3 py-2 text-left text-[12px] transition hover:bg-[var(--c-hover)] border-t"
                style={{ borderColor: 'var(--c-border)', color: 'var(--c-t4)', fontStyle: 'italic' }}>
                Custom MIME type…
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface McpResource {
  id: number
  name: string
  uri: string
  mime_type: string
  description: string | null
  text: string | null
  meta: Record<string, unknown>
  data: Record<string, unknown>
  access_control: { scope?: string; roles?: number[] }
  created_at: string
  updated_at: string | null
}

// ── Access badge ───────────────────────────────────────────────────────────────

function AccessBadge({ scope }: { scope?: string }) {
  const s = scope ?? 'private'
  const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
    private:   { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', border: 'rgba(220,38,38,0.25)',  label: 'Private'   },
    protected: { bg: 'rgba(234,179,8,0.10)',  color: '#ca8a04', border: 'rgba(234,179,8,0.30)',  label: 'Protected' },
    public:    { bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', border: 'rgba(22,163,74,0.25)',  label: 'Public'    },
  }
  const { bg, color, border, label } = styles[s] ?? styles.private
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border"
      style={{ background: bg, color, borderColor: border }}>
      {label}
    </span>
  )
}


// ── Save Modal ─────────────────────────────────────────────────────────────────

function SaveResourceModal({
  resource,
  onClose,
  onSaved,
}: {
  resource: McpResource | null
  onClose: () => void
  onSaved: (r: McpResource) => void
}) {
  const isEdit = resource !== null

  const [name,        setName]        = useState(resource?.name ?? '')
  const [uri,         setUri]         = useState(resource?.uri ?? '')
  const [mimeType,    setMimeType]    = useState(resource?.mime_type ?? '')
  const [description, setDescription] = useState(resource?.description ?? '')
  const [text,        setText]        = useState(resource?.text ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const inputStyle = {
    background:  'var(--c-hover)',
    borderColor: 'var(--c-border-strong)',
    color:       'var(--c-t1)',
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_mcp_resource', {
        p_id:           isEdit ? resource.id : null,
        p_name:         name.trim(),
        p_uri:          uri.trim(),
        p_mime_type:   mimeType.trim(),
        p_description: description.trim() || null,
        p_text:        text || null,
        p_meta:        {},
        p_data:        {},
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: McpResource[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved(env.data[0])
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save resource')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <form onSubmit={submit}
        className="relative rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col border"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)', height: '90vh' }}>

        {/* Header — frozen */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Package size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit Resource' : 'Add Resource'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                {isEdit ? 'Update this MCP resource.' : 'Create a new MCP resource.'}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-4">

            {/* Row 1: Name · URI · MIME Type */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  autoFocus={!isEdit}
                  placeholder="e.g. product-catalog"
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>
                  URI <span className="text-red-500">*</span>
                </label>
                <input
                  value={uri}
                  onChange={e => setUri(e.target.value)}
                  required
                  placeholder="e.g. resource://catalog"
                  className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
                  style={inputStyle}
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>
                  MIME Type <span className="text-red-500">*</span>
                </label>
                <MimeTypeSelect value={mimeType} onChange={setMimeType} />
              </div>
            </div>

            {/* Row 2: Description */}
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>
                Description
              </label>
              <input
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
                style={inputStyle}
              />
            </div>

            {/* Row 3: Content editor — behaviour driven by MIME type */}
            {mimeType && (
              <ResourceContentEditor
                mimeType={mimeType}
                value={text}
                onChange={setText}
              />
            )}
          </div>
        </div>

        {/* Footer — frozen */}
        <div className="flex-shrink-0 px-6 py-4 border-t flex flex-col gap-3"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          {error && (
            <div className="text-[12px] rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {error}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                         transition flex items-center justify-center gap-2">
              {saving && <Loader2 size={14} className="animate-spin" />}
              {isEdit ? 'Update Resource' : 'Add Resource'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

// ── Resource row ───────────────────────────────────────────────────────────────

function ResourceRow({
  resource,
  index,
  onEdit,
  onDeleted,
  onAccessUpdated,
}: {
  resource: McpResource
  index: number
  onEdit: () => void
  onDeleted: (id: number) => void
  onAccessUpdated: (id: number, ac: AccessControlValue) => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [showAccess, setShowAccess] = useState(false)

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_delete_mcp_resource', { p_id: resource.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(resource.id)
    } catch { /* ignore */ } finally {
      setDeleting(false); setConfirmDel(false)
    }
  }

  return (
    <>
      <tr className="border-b group" style={{ borderColor: 'var(--c-border)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}>

        {/* # */}
        <td className="px-4 py-1.5 whitespace-nowrap w-16">
          <span className="text-[12px] font-mono" style={{ color: 'var(--c-t5)' }}>{index}</span>
        </td>

        {/* Name */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--c-primary)' }}>
            {resource.name}
          </span>
          {resource.description && (
            <p className="text-[11px] mt-0.5 truncate max-w-[220px]" style={{ color: 'var(--c-t4)' }}>
              {resource.description}
            </p>
          )}
        </td>

        {/* URI */}
        <td className="px-4 py-1.5">
          <span className="text-[12px] font-mono truncate block max-w-[200px]" style={{ color: 'var(--c-t3)' }}>
            {resource.uri}
          </span>
        </td>

        {/* MIME type */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <span className="text-[11px] px-2 py-0.5 rounded border font-mono"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t4)' }}>
            {resource.mime_type}
          </span>
        </td>

        {/* Scope */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <AccessBadge scope={resource.access_control?.scope} />
        </td>

        {/* Actions */}
        <td className="px-4 py-1.5 whitespace-nowrap w-28">
          {confirmDel ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]" style={{ color: 'var(--c-t4)' }}>Delete?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[11px] rounded-md transition">
                {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="px-2 py-0.5 rounded-md text-[11px] transition hover:bg-[var(--c-hover)]"
                style={{ color: 'var(--c-t4)' }}>
                No
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5">
              <button onClick={() => setShowAccess(true)} title="Access Control"
                className="p-1.5 rounded-lg transition hover:bg-[var(--c-active)]"
                style={{ color: 'var(--c-t4)' }}>
                <ShieldCheck size={15} />
              </button>
              <button onClick={onEdit} title="Edit"
                className="p-1.5 rounded-lg transition hover:bg-[var(--c-active)]"
                style={{ color: 'var(--c-t4)' }}>
                <Pencil size={15} />
              </button>
              <button onClick={() => setConfirmDel(true)} title="Delete"
                className="p-1.5 rounded-lg transition hover:bg-red-500/10"
                style={{ color: 'var(--c-t4)' }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}
        </td>
      </tr>

      {showAccess && (
        <AccessControl
          resourceName={`Resource #${resource.id}`}
          recordId={resource.id}
          routeName="mcp_resource"
          accessControl={resource.access_control}
          onClose={() => setShowAccess(false)}
          onSaved={ac => { onAccessUpdated(resource.id, ac); setShowAccess(false) }}
        />
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const RESOURCE_COLUMNS: Column<McpResource>[] = [
  { key: 'name',      label: 'Name',      exportValue: r => r.name },
  { key: 'uri',       label: 'URI',       exportValue: r => r.uri },
  { key: 'mime_type', label: 'MIME Type', filterValue: r => r.mime_type, exportValue: r => r.mime_type },
  { key: 'access',    label: 'Access',    filterValue: r => (r.access_control?.scope ?? 'private').charAt(0).toUpperCase() + (r.access_control?.scope ?? 'private').slice(1), exportValue: r => r.access_control?.scope ?? 'private' },
  { key: 'actions',   label: 'Actions' },
]

export function ResourcesPage() {

  const [resources, setResources] = useState<McpResource[]>([])
  const [loading,   setLoading]   = useState(true)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_get_mcp_resources')
      if (error) throw error
      const env = data as { is_success: boolean; data: McpResource[] }
      if (env.is_success) setResources(env.data ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--c-panel)' }}>

      <PageHeader
        icon={<Package size={20} style={{ color: 'var(--c-primary)' }} />}
        title="Resources"
        description="Manage MCP resources — structured data objects exposed to AI models."
        addLabel="Add Resource"
        onAdd={() => openEdit('new')}
      />

      <DataTable
        columns={RESOURCE_COLUMNS}
        rows={resources}
        loading={loading}
        searchPlaceholder="Search resources..."
        searchFields={r => `${r.name} ${r.uri} ${r.description ?? ''}`}
        exportFilename="resources"
        emptyIcon={<Package size={24} style={{ color: 'var(--c-t5)' }} />}
        emptyTitle="No resources yet"
        emptyDescription="Create your first MCP resource to get started."
        onAddClick={() => openEdit('new')}
        addLabel="Add Resource"
        renderRow={(r, i) => (
          <ResourceRow
            resource={r}
            index={i}
            onEdit={() => openEdit(r.id)}
            onDeleted={id => setResources(prev => prev.filter(x => x.id !== id))}
            onAccessUpdated={(id, ac) =>
              setResources(prev => prev.map(x => x.id === id ? { ...x, access_control: ac } : x))
            }
          />
        )}
      />

      {editId !== null && (
        <SaveResourceModal
          resource={editId === 'new' ? null : resources.find(r => String(r.id) === editId) ?? null}
          onClose={closeEdit}
          onSaved={saved => {
            setResources(prev => {
              const exists = prev.find(x => x.id === saved.id)
              return exists ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]
            })
            closeEdit()
          }}
        />
      )}
    </div>
  )
}
