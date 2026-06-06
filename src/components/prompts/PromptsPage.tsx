'use client'

import { useState, useEffect, useMemo } from 'react'
import { Pencil, Trash2, ShieldCheck, Loader2, X, FileText } from 'lucide-react'
import MarkdownEditor from '@/components/common/MarkdownEditor'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import { useEditParam } from '@/lib/useEditParam'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Prompt {
  id: number
  name: string
  prompt: string
  data: Record<string, unknown>
  access_control: { scope?: string; roles?: number[] }
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

function SavePromptModal({
  prompt,
  onClose,
  onSaved,
}: {
  prompt: Prompt | null
  onClose: () => void
  onSaved: (p: Prompt) => void
}) {
  const isEdit = prompt !== null

  const [name,          setName]          = useState(prompt?.name ?? '')
  const [promptContent, setPromptContent] = useState(prompt?.prompt ?? '')
  const [saving,        setSaving]        = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const inputStyle = {
    background:  'var(--c-hover)',
    borderColor: 'var(--c-border-strong)',
    color:       'var(--c-t1)',
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_prompt', {
        p_id:     isEdit ? prompt.id : null,
        p_name:   name.trim(),
        p_prompt: promptContent.trim(),
        p_data:   {},
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: Prompt[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved(env.data[0])
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save prompt')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border max-h-[90vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <FileText size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit Prompt' : 'Add Prompt'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                {isEdit ? 'Update this reusable prompt template.' : 'Create a new reusable prompt template.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form id="prompt-modal-form" onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Name */}
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
              placeholder="e.g. Customer Support Assistant"
              className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition"
              style={inputStyle}
            />
          </div>

          <MarkdownEditor
            label="Prompt Template"
            value={promptContent}
            onChange={setPromptContent}
            placeholder={'Write your prompt template here.\nUse {{VARIABLE_NAME}} for dynamic values.'}
            rows={10}
            minHeight="220px"
          />

          {error && (
            <div className="text-[12px] rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {error}
            </div>
          )}

        </form>

        {/* Footer — frozen */}
        <div className="flex gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Cancel
          </button>
          <button type="submit" form="prompt-modal-form" disabled={saving}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                       transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Update Prompt' : 'Add Prompt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Prompt row ─────────────────────────────────────────────────────────────────

function PromptRow({
  prompt,
  index,
  onEdit,
  onDeleted,
  onAccessUpdated,
}: {
  prompt: Prompt
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
      const { data, error } = await HttpHelper.rpc('fn_delete_prompt', { p_id: prompt.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(prompt.id)
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
        <span className="text-[12px] font-mono" style={{ color: 'var(--c-t5)' }}>
          {index}
        </span>
      </td>

      {/* Prompt */}
      <td className="px-4 py-1.5">
        <p className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
          {prompt.name || <span style={{ color: 'var(--c-t5)' }}>—</span>}
        </p>
      </td>

      {/* Scope */}
      <td className="px-4 py-1.5 whitespace-nowrap">
        <AccessBadge scope={prompt.access_control?.scope} />
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
        resourceName={`Prompt #${prompt.id}`}
        recordId={prompt.id}
        routeName="prompts"
        accessControl={prompt.access_control}
        onClose={() => setShowAccess(false)}
        onSaved={ac => { onAccessUpdated(prompt.id, ac); setShowAccess(false) }}
      />
    )}
  </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const PROMPT_COLUMNS: Column<Prompt>[] = [
  { key: 'prompt', label: 'Prompt', exportValue: p => p.name },
  { key: 'access', label: 'Access', filterValue: p => (p.access_control?.scope ?? 'private').charAt(0).toUpperCase() + (p.access_control?.scope ?? 'private').slice(1), exportValue: p => p.access_control?.scope ?? 'private' },
  { key: 'actions', label: 'Actions' },
]

export function PromptsPage() {

  const [prompts,  setPrompts]  = useState<Prompt[]>([])
  const [loading,  setLoading]  = useState(true)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_get_prompts')
      if (error) throw error
      const env = data as { is_success: boolean; data: Prompt[] }
      if (env.is_success) setPrompts(env.data ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--c-panel)' }}>

      <PageHeader
        icon={<FileText size={20} style={{ color: 'var(--c-primary)' }} />}
        title="Prompts"
        description="Define reusable prompt templates exposed as MCP prompt resources to AI models."
        addLabel="Add Prompt"
        onAdd={() => openEdit('new')}
      />

      <DataTable
        columns={PROMPT_COLUMNS}
        rows={prompts}
        loading={loading}
        searchPlaceholder="Search prompts..."
        searchFields={p => `${p.name} ${p.prompt ?? ''}`}
        exportFilename="prompts"
        emptyIcon={<FileText size={24} style={{ color: 'var(--c-t5)' }} />}
        emptyTitle="No prompts yet"
        emptyDescription="Create your first prompt template to get started."
        onAddClick={() => openEdit('new')}
        addLabel="Add Prompt"
        renderRow={(p, i) => (
          <PromptRow
            prompt={p}
            index={i}
            onEdit={() => openEdit(p.id)}
            onDeleted={id => setPrompts(prev => prev.filter(x => x.id !== id))}
            onAccessUpdated={(id, ac) =>
              setPrompts(prev => prev.map(x => x.id === id ? { ...x, access_control: ac } : x))
            }
          />
        )}
      />

      {editId !== null && (
        <SavePromptModal
          prompt={editId === 'new' ? null : prompts.find(p => String(p.id) === editId) ?? null}
          onClose={closeEdit}
          onSaved={saved => {
            setPrompts(prev => {
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
