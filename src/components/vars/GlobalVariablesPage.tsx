'use client'

import { useState, useEffect, useMemo } from 'react'
import { Eye, EyeOff, Pencil, Trash2, ShieldCheck, Loader2, X, Globe } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import { useEditParam } from '@/lib/useEditParam'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'

// ── Types ──────────────────────────────────────────────────────────────────────

type VarType = 'string' | 'secret' | 'boolean' | 'integer'

interface GlobalVariable {
  id: number
  name: string
  type: VarType
  value: string
  description: string
  access_control: { scope?: string; roles?: number[] }
  created_at: string
  updated_at: string
}

// ── Badges ─────────────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: VarType }) {
  const isSecret = type === 'secret'
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
      style={isSecret
        ? { background: 'rgba(217,119,6,0.1)', color: '#d97706', borderColor: 'rgba(217,119,6,0.25)' }
        : { background: 'var(--c-hover)', color: 'var(--c-t3)', borderColor: 'var(--c-border-strong)' }
      }
    >
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  )
}

function AccessBadge({ scope }: { scope?: string }) {
  const s = scope ?? 'private'

  const styles: Record<string, { bg: string; color: string; border: string; label: string }> = {
    private:   { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', border: 'rgba(220,38,38,0.25)',   label: 'Private'   },
    protected: { bg: 'rgba(234,179,8,0.10)',   color: '#ca8a04', border: 'rgba(234,179,8,0.30)',   label: 'Protected' },
    public:    { bg: 'rgba(22,163,74,0.10)',   color: '#16a34a', border: 'rgba(22,163,74,0.25)',   label: 'Public'    },
  }

  const { bg, color, border, label } = styles[s] ?? styles.private

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border"
      style={{ background: bg, color, borderColor: border }}
    >
      {label}
    </span>
  )
}

// ── Masked value ───────────────────────────────────────────────────────────────

function MaskedValue({ value }: { value: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[12px] truncate max-w-[220px]" style={{ color: 'var(--c-t2)' }}>
        {show ? value : '••••••••••••'}
      </span>
      <button onClick={() => setShow(v => !v)} style={{ color: 'var(--c-t4)' }}
        className="flex-shrink-0 hover:opacity-70 transition">
        {show ? <EyeOff size={13} /> : <Eye size={13} />}
      </button>
    </div>
  )
}

// ── Save Variable Modal ────────────────────────────────────────────────────────

type SaveModalProps = {
  variable: GlobalVariable | null
  onClose: () => void
  onSaved: (v: GlobalVariable) => void
}

const TYPE_OPTIONS: { value: VarType; label: string }[] = [
  { value: 'string',  label: 'String'  },
  { value: 'boolean', label: 'Boolean' },
  { value: 'integer', label: 'Integer' },
  { value: 'secret',  label: 'Secret'  },
]

function SaveVariableModal({ variable, onClose, onSaved }: SaveModalProps) {
  const isEdit = variable !== null

  const [name,        setName]    = useState(variable?.name ?? '')
  const [type,        setType]    = useState<VarType>(variable?.type ?? 'string')
  const [value,       setValue]   = useState(variable?.value ?? '')
  const [description, setDesc]    = useState(variable?.description ?? '')
  const [showVal,     setShowVal] = useState(false)
  const [saving,      setSaving]  = useState(false)
  const [error,       setError]   = useState<string | null>(null)

  const inputCls = `w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition`
  const inputStyle = {
    background:   'var(--c-hover)',
    borderColor:  'var(--c-border-strong)',
    color:        'var(--c-t1)',
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_global_variable', {
        p_id:          isEdit ? variable.id : null,
        p_name:        name.trim(),
        p_value:       value,
        p_type:        type,
        p_description: description.trim(),
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: GlobalVariable[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved(env.data[0])
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save variable')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-md flex flex-col border max-h-[90vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Globe size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit Variable' : 'Add Variable'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                {isEdit ? "Update this variable's properties." : 'Define a new reusable variable.'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--c-hover)] transition"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form id="var-modal-form" onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-t4)' }}>
              Name <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus={!isEdit}
              placeholder="e.g. API_BASE_URL" className={inputCls} style={inputStyle} />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-t4)' }}>
              Type
            </label>
            <div className="relative">
              <select value={type} onChange={e => setType(e.target.value as VarType)}
                className={`${inputCls} appearance-none cursor-pointer`} style={inputStyle}>
                {TYPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--c-t4)' }}>
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                  <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-t4)' }}>
              Value <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input value={value} onChange={e => setValue(e.target.value)} required
                type={type === 'secret' && !showVal ? 'password' : 'text'}
                placeholder={type === 'secret' ? '••••••••' : 'Enter value'}
                className={`${inputCls} font-mono pr-10`} style={inputStyle} />
              {type === 'secret' && (
                <button type="button" onClick={() => setShowVal(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition hover:opacity-70"
                  style={{ color: 'var(--c-t4)' }}>
                  {showVal ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-t4)' }}>
              Description
            </label>
            <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
              placeholder="What is this variable used for?"
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>

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
          <button type="submit" form="var-modal-form" disabled={saving}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                       transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Variable row ───────────────────────────────────────────────────────────────

function VarRow({
  variable, index, onEdit, onDeleted, onAccessUpdated,
}: {
  variable: GlobalVariable
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
      const { data, error } = await HttpHelper.rpc('fn_delete_global_variable', { p_id: variable.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(variable.id)
    } catch { /* silently ignore */ } finally {
      setDeleting(false); setConfirmDel(false)
    }
  }

  return (
    <>
      <tr className="border-b group" style={{ borderColor: 'var(--c-border)' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-hover)')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}>

        {/* # */}
        <td className="px-4 py-1.5 whitespace-nowrap w-14">
          <span className="text-[12px] font-mono" style={{ color: 'var(--c-t5)' }}>
            {index}
          </span>
        </td>

        {/* Name */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--c-primary)' }}>
            {`{{${variable.name}}}`}
          </span>
        </td>

        {/* Value */}
        <td className="px-4 py-1.5 max-w-[240px]">
          {variable.type === 'secret'
            ? <MaskedValue value={variable.value} />
            : <span className="font-mono text-[12px] truncate block max-w-[220px]"
                style={{ color: 'var(--c-t2)' }}>
                {variable.value}
              </span>
          }
        </td>

        {/* Type */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <TypeBadge type={variable.type} />
        </td>

        {/* Description */}
        <td className="px-4 py-1.5">
          <span className="text-[12px] line-clamp-1" style={{ color: 'var(--c-t4)' }}>
            {variable.description}
          </span>
        </td>

        {/* Access */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <AccessBadge scope={variable.access_control?.scope} />
        </td>

        {/* Actions */}
        <td className="px-4 py-1.5 whitespace-nowrap">
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
          resourceName={variable.name}
          recordId={variable.id}
          routeName="global_variables"
          accessControl={variable.access_control}
          onClose={() => setShowAccess(false)}
          onSaved={ac => { onAccessUpdated(variable.id, ac); setShowAccess(false) }}
        />
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const VAR_COLUMNS: Column<GlobalVariable>[] = [
  { key: 'name',        label: 'Name',        exportValue: v => v.name },
  { key: 'value',       label: 'Value',       exportValue: v => v.type === 'secret' ? '***' : v.value },
  { key: 'type',        label: 'Type',        filterValue: v => v.type.charAt(0).toUpperCase() + v.type.slice(1), exportValue: v => v.type },
  { key: 'description', label: 'Description', exportValue: v => v.description ?? '' },
  { key: 'access',      label: 'Access',      filterValue: v => (v.access_control?.scope ?? 'private').charAt(0).toUpperCase() + (v.access_control?.scope ?? 'private').slice(1), exportValue: v => v.access_control?.scope ?? 'private' },
  { key: 'actions',     label: 'Actions' },
]

export function GlobalVariablesPage() {

  const [variables, setVariables] = useState<GlobalVariable[]>([])
  const [loading,   setLoading]   = useState(true)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_get_global_variables', { p_id: null, p_search: null })
      if (error) throw error
      const env = data as { is_success: boolean; data: GlobalVariable[] }
      if (env.is_success) setVariables(env.data ?? [])
    } catch { /* silently ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--c-panel)' }}>

      <PageHeader
        icon={<span className="text-base font-bold" style={{ color: 'var(--c-primary)' }}>{'{x}'}</span>}
        title="Global Variables"
        description={<>Define reusable values referenced in prompts as{' '}
          <code className="font-mono text-[11px] px-1 py-0.5 rounded"
            style={{ background: 'var(--c-hover)', color: 'var(--c-t3)' }}>{'{{VARIABLE_NAME}}'}</code></>}
        addLabel="Add Variable"
        onAdd={() => openEdit('new')}
      />

      <DataTable
        columns={VAR_COLUMNS}
        rows={variables}
        loading={loading}
        searchPlaceholder="Search variables..."
        searchFields={v => `${v.name} ${v.description ?? ''}`}
        exportFilename="variables"
        emptyIcon={<span className="text-2xl" style={{ color: 'var(--c-t5)' }}>{'{x}'}</span>}
        emptyTitle="No variables yet"
        emptyDescription="Create your first global variable to get started."
        onAddClick={() => openEdit('new')}
        addLabel="Add Variable"
        renderRow={(v, i) => (
          <VarRow
            variable={v}
            index={i}
            onEdit={() => openEdit(v.id)}
            onDeleted={id => setVariables(prev => prev.filter(x => x.id !== id))}
            onAccessUpdated={(id, ac) =>
              setVariables(prev => prev.map(x => x.id === id ? { ...x, access_control: ac } : x))
            }
          />
        )}
      />

      {editId !== null && (
        <SaveVariableModal
          variable={editId === 'new' ? null : variables.find(v => String(v.id) === editId) ?? null}
          onClose={closeEdit}
          onSaved={saved => {
            setVariables(prev => {
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
