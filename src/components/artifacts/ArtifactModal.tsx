'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Plus, Pencil, Trash2, ShieldCheck, Loader2, ArrowLeft, Upload, CheckCircle2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import AccessControl from '@/components/common/AccessControl'

// ── Types ──────────────────────────────────────────────────────────────────────

interface AcData {
  scope: 'private' | 'protected' | 'public'
  roles: number[]
}

interface ArtifactRecord {
  id:             number
  name:           string
  title:          string
  icon:           string | null
  section:        string
  url:            string
  description:    string | null
  sort_order:     number
  is_active:      boolean
  access_control: AcData | null
}

interface ArtifactForm {
  id?:         number
  name:        string
  title:       string
  icon:        string
  section:     string
  url:         string
  description: string
  sort_order:  number
}

const EMPTY_FORM: ArtifactForm = {
  name: '', title: '', icon: '📄', section: 'Dashboards', url: '', description: '', sort_order: 0,
}

// ── Scope badge ────────────────────────────────────────────────────────────────

const SCOPE_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  private:   { bg: 'rgba(220,38,38,0.08)',  color: '#dc2626', border: 'rgba(220,38,38,0.2)',  label: 'Private'   },
  protected: { bg: 'rgba(234,179,8,0.08)',  color: '#ca8a04', border: 'rgba(234,179,8,0.25)', label: 'Protected' },
  public:    { bg: 'rgba(22,163,74,0.08)',  color: '#16a34a', border: 'rgba(22,163,74,0.2)',  label: 'Public'    },
}

function ScopeBadge({ scope }: { scope?: string }) {
  const s = scope ?? 'private'
  const { bg, color, border, label } = SCOPE_STYLE[s] ?? SCOPE_STYLE.private
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border"
      style={{ background: bg, color, borderColor: border }}>
      {label}
    </span>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  open:     boolean
  onClose:  () => void
  onSaved?: () => void
}

export default function ArtifactModal({ open, onClose, onSaved }: Props) {
  const [artifacts,   setArtifacts]   = useState<ArtifactRecord[]>([])
  const [loading,     setLoading]     = useState(false)
  const [view,        setView]        = useState<'list' | 'form'>('list')
  const [form,        setForm]        = useState<ArtifactForm>(EMPTY_FORM)
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [delConfirm,  setDelConfirm]  = useState<number | null>(null)
  const [deleting,    setDeleting]    = useState(false)
  const [acArtifact,  setAcArtifact]  = useState<ArtifactRecord | null>(null)

  // Upload state
  const [dragOver,    setDragOver]    = useState(false)
  const [uploadFile,  setUploadFile]  = useState<File | null>(null)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadDone,  setUploadDone]  = useState(false)

  const loadArtifacts = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await HttpHelper.rpc<ArtifactRecord[]>('fn_get_artifacts')
      if (data?.is_success) setArtifacts(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setView('list'); setForm(EMPTY_FORM); setError(null); setDelConfirm(null)
    loadArtifacts()
  }, [open, loadArtifacts])

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Escape') return
    if (acArtifact) return
    if (view === 'form') { setView('list'); setError(null) }
    else onClose()
  }, [onClose, view, acArtifact])

  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, handleKey])

  function resetUpload() {
    setUploadFile(null); setUploading(false)
    setUploadError(null); setUploadDone(false)
  }

  function openAdd() {
    setForm(EMPTY_FORM); setError(null); resetUpload(); setView('form')
  }

  function openEdit(a: ArtifactRecord) {
    setForm({
      id: a.id, name: a.name, title: a.title,
      icon: a.icon ?? '📄', section: a.section,
      url: a.url, description: a.description ?? '',
      sort_order: a.sort_order,
    })
    setError(null); resetUpload(); setView('form')
  }

  function pickFile(file: File) {
    if (!file.name.endsWith('.html') && file.type !== 'text/html') {
      setUploadError('Only .html files are supported.'); return
    }
    setUploadFile(file); setUploadError(null); setUploadDone(false)
  }

  async function handleUpload() {
    if (!uploadFile) return
    setUploading(true); setUploadError(null)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile, uploadFile.name)
      const res  = await fetch('/api/artifacts/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!data.success) { setUploadError(data.error ?? 'Upload failed'); return }
      setForm(f => ({ ...f, url: data.url }))
      setUploadDone(true)
    } catch (err) {
      setUploadError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.url) { setError('HTML File is required. Please upload a file first.'); return }
    setSaving(true); setError(null)
    try {
      const { data, error } = await HttpHelper.rpc('fn_save_artifact', {
        p_id:          form.id          ?? null,
        p_name:        form.name,
        p_title:       form.title,
        p_icon:        form.icon        ?? null,
        p_section:     form.section     ?? 'Dashboards',
        p_url:         form.url,
        p_description: form.description ?? null,
        p_sort_order:  form.sort_order  ?? 0,
        p_data:        {},
      })
      if (error || !data?.is_success) { setError(data?.message ?? error ?? 'Save failed'); return }
      await loadArtifacts()
      setView('list'); onSaved?.()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: number) {
    setDeleting(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_delete_artifact', { p_id: id })
      if (error || !data?.is_success) { alert(data?.message ?? error ?? 'Delete failed'); return }
      setDelConfirm(null)
      await loadArtifacts(); onSaved?.()
    } finally {
      setDeleting(false)
    }
  }

  if (!open) return null

  const isEdit     = Boolean(form.id)
  const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition'
  const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
          onMouseDown={e => { if (!acArtifact && view === 'list') onClose() }} />

        <div className={`relative rounded-2xl shadow-2xl flex flex-col border max-h-[90vh] w-full ${view === 'form' ? 'max-w-2xl' : 'max-w-xl'}`}
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

          {/* Header */}
          <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b flex-shrink-0"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
            {view === 'form' && (
              <button onClick={() => { setView('list'); setError(null) }}
                className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]"
                style={{ color: 'var(--c-t4)' }}>
                <ArrowLeft size={15} />
              </button>
            )}
            <h2 className="text-[15px] font-semibold flex-1" style={{ color: 'var(--c-t1)' }}>
              {view === 'list' ? 'Artifacts' : isEdit ? 'Edit Artifact' : 'New Artifact'}
            </h2>
            {view === 'list' && (
              <button onClick={openAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 btn-primary text-[12px] font-semibold rounded-lg transition">
                <Plus size={13} /> Add
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t4)' }}>
              <X size={15} />
            </button>
          </div>

          {/* ── List view ── */}
          {view === 'list' && (
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
                </div>
              ) : artifacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--c-t2)' }}>No artifacts yet</p>
                  <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
                    Click <strong>+ Add</strong> to create one.
                  </p>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr_80px_80px] px-5 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
                    style={{ borderColor: 'var(--c-border)', color: 'var(--c-t5)', background: 'var(--c-topbar)' }}>
                    <span>Name</span>
                    <span>Access</span>
                    <span>Actions</span>
                  </div>

                  {artifacts.map(a => {
                    const isConfirming = delConfirm === a.id
                    return (
                      <div key={a.id}
                        className="grid grid-cols-[1fr_80px_80px] items-center px-5 py-3 border-b"
                        style={{ borderColor: 'var(--c-border)', background: isConfirming ? 'rgba(220,38,38,0.04)' : undefined }}
                        onMouseEnter={e => { if (!isConfirming) e.currentTarget.style.background = 'var(--c-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = isConfirming ? 'rgba(220,38,38,0.04)' : '' }}>

                        {/* Name + meta */}
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{a.icon ?? '📄'}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>{a.title}</p>
                            <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{a.section} · {a.name}</p>
                          </div>
                        </div>

                        {/* Access */}
                        <div>
                          <ScopeBadge scope={a.access_control?.scope} />
                        </div>

                        {/* Actions */}
                        <div>
                          {isConfirming ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => handleDelete(a.id)} disabled={deleting}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-600 hover:bg-red-500 text-white transition">
                                {deleting ? <Loader2 size={9} className="animate-spin" /> : 'Yes'}
                              </button>
                              <button onClick={() => setDelConfirm(null)}
                                className="px-2 py-0.5 rounded text-[11px] transition hover:bg-[var(--c-hover)]"
                                style={{ color: 'var(--c-t4)' }}>No</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => setAcArtifact(a)} title="Access control"
                                className="p-1.5 rounded-lg transition hover:bg-[var(--c-active)]"
                                style={{ color: 'var(--c-t4)' }}>
                                <ShieldCheck size={14} />
                              </button>
                              <button onClick={() => openEdit(a)} title="Edit"
                                className="p-1.5 rounded-lg transition hover:bg-[var(--c-active)]"
                                style={{ color: 'var(--c-t4)' }}>
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => setDelConfirm(a.id)} title="Delete"
                                className="p-1.5 rounded-lg transition hover:bg-red-500/10"
                                style={{ color: 'var(--c-t4)' }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}

          {/* ── Form view ── */}
          {view === 'form' && (
            <>
              <form id="artifact-form" onSubmit={handleSave}
                className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                      style={{ color: 'var(--c-t4)' }}>
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      required autoFocus={!isEdit} placeholder="machines"
                      className={inputCls} style={inputStyle} />
                    <p className="text-[11px] mt-1" style={{ color: 'var(--c-t5)' }}>Unique identifier, no spaces</p>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                      style={{ color: 'var(--c-t4)' }}>
                      Icon
                    </label>
                    <input value={form.icon}
                      onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                      placeholder="📄" className={inputCls} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                    style={{ color: 'var(--c-t4)' }}>
                    Title <span className="text-red-500">*</span>
                  </label>
                  <input value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required placeholder="Scanned Machines"
                    className={inputCls} style={inputStyle} />
                </div>

                {/* Upload zone */}
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                    style={{ color: 'var(--c-t4)' }}>
                    HTML File <span className="text-red-500">*</span>
                  </label>

                  {!uploadDone && (
                    <div
                      className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center py-8 px-4 cursor-pointer transition"
                      style={{
                        borderColor: dragOver ? 'var(--c-primary)' : 'var(--c-border-strong)',
                        background:  dragOver ? 'var(--c-primary-light)' : 'var(--c-hover)',
                      }}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) pickFile(f) }}
                      onClick={() => document.getElementById('artifact-file-input')?.click()}
                    >
                      <input id="artifact-file-input" type="file" accept=".html,text/html"
                        style={{ display: 'none' }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) pickFile(f) }} />

                      {uploadFile ? (
                        <div className="flex items-center gap-3">
                          <span style={{ fontSize: 24 }}>📄</span>
                          <div>
                            <p className="text-[13px] font-medium" style={{ color: 'var(--c-t1)' }}>{uploadFile.name}</p>
                            <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>{(uploadFile.size / 1024).toFixed(1)} KB</p>
                          </div>
                          <button type="button"
                            onClick={e => { e.stopPropagation(); handleUpload() }}
                            disabled={uploading}
                            className="ml-2 flex items-center gap-1.5 px-3 py-1.5 btn-primary text-[12px] font-medium rounded-lg transition disabled:opacity-60">
                            {uploading
                              ? <><Loader2 size={12} className="animate-spin" /> Uploading…</>
                              : <><Upload size={12} /> Upload</>}
                          </button>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2 text-center">
                          <span style={{ fontSize: 32 }}>📂</span>
                          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
                            Drop your <strong>.html</strong> file here or{' '}
                            <span style={{ color: 'var(--c-primary)' }}>browse</span>
                          </p>
                          {form.url && (
                            <p className="text-[11px]" style={{ color: 'var(--c-t5)' }}>
                              Current: {form.url.split('/').pop()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-[12px] mt-1.5" style={{ color: '#ef4444' }}>{uploadError}</p>
                  )}

                  {uploadDone && (
                    <div className="flex items-center gap-3 rounded-xl border px-4 py-3"
                      style={{ borderColor: 'rgba(22,163,74,0.3)', background: 'rgba(22,163,74,0.06)' }}>
                      <CheckCircle2 size={16} style={{ color: '#16a34a', flexShrink: 0 }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium" style={{ color: '#16a34a' }}>Uploaded successfully</p>
                        <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{form.url}</p>
                      </div>
                      <button type="button" onClick={resetUpload}
                        className="text-[11px] px-2 py-1 rounded-lg border transition hover:bg-[var(--c-hover)]"
                        style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t4)' }}>
                        Replace
                      </button>
                    </div>
                  )}

                  {!form.url && !uploadDone && (
                    <p className="text-[11px] mt-1" style={{ color: 'var(--c-t5)' }}>
                      Upload an HTML file — the URL will be set automatically.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-[1fr_80px] gap-3">
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                      style={{ color: 'var(--c-t4)' }}>
                      Section
                    </label>
                    <input value={form.section}
                      onChange={e => setForm(f => ({ ...f, section: e.target.value }))}
                      placeholder="Dashboards" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                      style={{ color: 'var(--c-t4)' }}>
                      Order
                    </label>
                    <input type="number" min={0} value={form.sort_order}
                      onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                      className={inputCls} style={inputStyle} />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                    style={{ color: 'var(--c-t4)' }}>
                    Description
                  </label>
                  <textarea value={form.description} rows={2}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Optional description"
                    className={`${inputCls} resize-none`} style={inputStyle} />
                </div>
              </form>

              {/* Sticky form footer */}
              <div className="flex flex-col gap-2 px-6 py-4 border-t flex-shrink-0"
                style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
                {error && (
                  <div className="text-[12px] rounded-lg px-3 py-2 border"
                    style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
                    {error}
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => { setView('list'); setError(null) }}
                    className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
                    style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
                    Cancel
                  </button>
                  <button type="submit" form="artifact-form" disabled={saving}
                    className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                               transition flex items-center justify-center gap-2">
                    {saving && <Loader2 size={14} className="animate-spin" />}
                    {isEdit ? 'Update' : 'Create'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {acArtifact && (
        <AccessControl
          recordId={acArtifact.id}
          resourceName={acArtifact.title}
          routeName="live_artifacts"
          accessControl={acArtifact.access_control ?? undefined}
          onClose={() => setAcArtifact(null)}
          onSaved={async () => { await loadArtifacts(); onSaved?.() }}
        />
      )}
    </>
  )
}
