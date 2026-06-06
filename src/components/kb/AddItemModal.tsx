'use client'
import { useState, useRef } from 'react'
import { X, File, Globe, Upload, Loader2, Library } from 'lucide-react'
import clsx from 'clsx'
import { addKbUrlItem, addKbFileItem, type KbItem, type KbNode } from '@/lib/kb-api'

type Tab = 'file' | 'website'

export function AddItemModal({ kb, onClose, onAdded }: {
  kb: KbNode
  onClose: () => void
  onAdded: (item: KbItem) => void
}) {
  const [tab, setTab]       = useState<Tab>('file')
  const [name, setName]     = useState('')
  const [url, setUrl]       = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const uploadFiles = async (files: FileList) => {
    if (!files.length) return
    setSaving(true); setError(null)
    for (const file of Array.from(files)) {
      const form = new FormData()
      form.append('file', file)
      let uploadRes: Response
      try {
        uploadRes = await fetch('/api/kb/upload', { method: 'POST', body: form })
      } catch (e: any) {
        setError(`Network error: ${e.message}`)
        setSaving(false); return
      }
      const json = await uploadRes.json()
      if (!json.success) {
        setError(json.error ?? 'Upload failed')
        setSaving(false); return
      }
      const ext = file.name.includes('.') ? file.name.split('.').pop()! : ''
      const item = await addKbFileItem(
        kb.id,
        json.original_filename ?? file.name,
        file.type || ext,
        json.file_size_bytes ?? file.size,
        json.stored_filename,
      )
      if (!item) { setError('Failed to register file. Please try again.'); setSaving(false); return }
      onAdded(item)
    }
    setSaving(false)
    onClose()
  }

  const addUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    setSaving(true); setError(null)
    const item = await addKbUrlItem(kb.id, name.trim() || url, url.trim())
    setSaving(false)
    if (!item) { setError('Failed to add URL. Please try again.'); return }
    onAdded(item)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-[520px] rounded-2xl shadow-2xl overflow-hidden border"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Library size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>Add Item</h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                Add a file or URL to{' '}
                <span className="font-medium" style={{ color: 'var(--c-t2)' }}>{kb.name}</span>.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--c-hover)] transition-colors"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex shrink-0 border-b" style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
          {([{ id: 'file', label: 'File', Icon: File }, { id: 'website', label: 'Website', Icon: Globe }] as { id: Tab; label: string; Icon: React.ElementType }[]).map(({ id, label, Icon }) => {
            const isActive = tab === id
            return (
              <button key={id} onClick={() => setTab(id)}
                className="relative px-5 py-3 text-[13px] font-medium transition flex items-center gap-1.5"
                style={{ color: isActive ? 'var(--c-primary)' : 'var(--c-t4)' }}>
                <Icon size={13} />
                {label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                    style={{ background: 'var(--c-primary)' }} />
                )}
              </button>
            )
          })}
        </div>

        {/* Content */}
        <div className="px-6 pt-4 pb-6">
          {tab === 'file' ? (
            <div>
              <input ref={fileRef} type="file" multiple className="hidden"
                accept=".txt,.md,.csv,.json,.html,.pdf,.png,.jpg,.jpeg,.webp,.gif"
                onChange={e => { if (e.target.files) uploadFiles(e.target.files) }} />
              <button
                disabled={saving}
                onClick={() => fileRef.current?.click()}
                onDragEnter={() => setDragging(true)}
                onDragLeave={() => setDragging(false)}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files) uploadFiles(e.dataTransfer.files) }}
                className={clsx(
                  'w-full rounded-xl border-2 border-dashed py-10 flex flex-col items-center gap-3 transition-colors disabled:opacity-60',
                  dragging ? 'border-blue-500 bg-blue-500/5' : 'hover:bg-[var(--c-hover)]'
                )}
                style={{ borderColor: dragging ? undefined : 'var(--c-border-strong)' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--c-hover)' }}>
                  {saving ? <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t3)' }} /> : <Upload size={20} style={{ color: 'var(--c-t3)' }} />}
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-medium" style={{ color: 'var(--c-t2)' }}>
                    {saving ? 'Uploading…' : 'Click to choose files or drag & drop'}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                    TXT, MD, CSV, JSON, HTML, PDF, images supported
                    <br />(multiple allowed)
                  </p>
                </div>
              </button>
              {error && (
                <p className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-3">{error}</p>
              )}
            </div>
          ) : (
            <form onSubmit={addUrl} className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--c-t3)' }}>Name (optional)</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Friendly name for this source"
                  className="w-full rounded-lg px-3 py-2 text-[12px] border focus:outline-none focus:border-blue-500/50"
                  style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: 'var(--c-t3)' }}>
                  Website URL <span className="text-red-500">*</span>
                </label>
                <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com"
                  type="url" required autoFocus
                  className="w-full rounded-lg px-3 py-2 text-[12px] font-mono border focus:outline-none focus:border-blue-500/50"
                  style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
              </div>
              {error && (
                <p className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
              )}
              <button type="submit" disabled={saving}
                className="w-full py-2.5 btn-primary disabled:opacity-60 text-white text-[12px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-1">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Adding…' : 'Add URL'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
