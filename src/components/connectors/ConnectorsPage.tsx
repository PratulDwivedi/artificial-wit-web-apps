'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Plus, Search, Trash2, ShieldCheck, Loader2, X, Server,
  RefreshCw, PlugZap, CheckCircle2, AlertCircle, Wrench, Cable,
} from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import { useEditParam } from '@/lib/useEditParam'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Connector {
  id: number
  name: string
  kind: string
  url: string | null
  status: string
  description: string | null
  icon: string | null
  data: Record<string, unknown>
  access_control: { scope?: string; roles?: number[] }
  is_active: boolean
  created_at: string
  updated_at: string
  tool_count: number
  is_authorized: boolean
}

// ── Status badge ───────────────────────────────────────────────────────────────

function StatusBadge({ connected }: { connected: boolean }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
        style={{ background: 'var(--c-primary)', color: '#fff' }}>
        <CheckCircle2 size={10} />
        Connected
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
      style={{ background: 'transparent', color: 'var(--c-t3)', borderColor: 'var(--c-border-strong)' }}>
      Not connected
    </span>
  )
}

// ── Save / Add Connector Modal ─────────────────────────────────────────────────

function SaveModal({
  connector,
  onClose,
  onSaved,
}: {
  connector: Connector | null
  onClose: () => void
  onSaved: (c: Connector) => void
}) {
  const isEdit = connector !== null

  const [name,        setName]        = useState(connector?.name ?? '')
  const [url,         setUrl]         = useState(connector?.url ?? '')
  const [description, setDescription] = useState(connector?.description ?? '')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition'
  const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError(null)
    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_connector', {
        p_id:          isEdit ? connector.id : null,
        p_name:        name.trim(),
        p_kind:        'mcp',
        p_url:         url.trim() || null,
        p_description: description.trim() || null,
        p_icon:        null,
        p_status:      isEdit ? connector.status : 'pending',
        p_data:        {},
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: Connector[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved({
        ...(isEdit ? connector : {} as Connector),
        ...env.data[0],
        tool_count:    isEdit ? connector.tool_count    : 0,
        is_authorized: isEdit ? connector.is_authorized : false,
        access_control: isEdit ? connector.access_control : {},
      })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save connector')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Cable size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit Connector' : 'Add Connector'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                Pick a template to connect a new tool source.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>
              Name <span className="text-red-500">*</span>
            </label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus={!isEdit}
              placeholder="e.g. Custom Connector (MCP)"
              className={inputCls} style={inputStyle} />
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>
              MCP Server URL
            </label>
            <input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://your-server.com/mcp"
              className={`${inputCls} font-mono`} style={inputStyle} />
            <p className="text-[11px] mt-1.5" style={{ color: 'var(--c-t5)' }}>
              OAuth + tools are auto-discovered (RFC 8414 + Dynamic Client Registration).
            </p>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>
              Description
            </label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
              placeholder="Brief description of this connector"
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>

          {error && (
            <div className="text-[12px] rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {error}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            {isEdit ? 'Cancel' : 'Back'}
          </button>
          <button type="submit" disabled={saving} onClick={submit as unknown as React.MouseEventHandler}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                       transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Connector Card ─────────────────────────────────────────────────────────────

function ConnectorCard({
  connector,
  onEdit,
  onDeleted,
  onAccessUpdated,
}: {
  connector: Connector
  onEdit: () => void
  onDeleted: (id: number) => void
  onAccessUpdated: (id: number, ac: AccessControlValue) => void
}) {
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [showAccess, setShowAccess] = useState(false)
  const isConnected  = connector.status === 'connected' && connector.is_authorized

  const handleConnect = () => {
    window.location.href = `/api/connectors/oauth/start?connector_id=${connector.id}`
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_delete_connector', { p_id: connector.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(connector.id)
    } catch { /* ignore */ } finally {
      setDeleting(false); setConfirmDel(false)
    }
  }

  return (
    <>
      <div className="flex flex-col rounded-2xl border overflow-hidden"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Card body */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          {/* Icon */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            <Server size={18} style={{ color: 'var(--c-primary)' }} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {connector.name}
              </span>
              <StatusBadge connected={isConnected} />
            </div>
            {connector.url && (
              <p className="text-[12px] font-mono mt-0.5 truncate" style={{ color: 'var(--c-t4)' }}>
                {connector.url}
              </p>
            )}
            {connector.description && (
              <p className="text-[12px] mt-1 line-clamp-1" style={{ color: 'var(--c-t4)' }}>
                {connector.description}
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="h-px mx-4" style={{ background: 'var(--c-border)' }} />

        {/* Card actions */}
        <div className="flex items-center gap-1 px-3 py-2.5">
          {/* Connect / Reconnect */}
          {isConnected ? (
            <button onClick={handleConnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition hover:bg-[var(--c-hover)]"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}>
              <RefreshCw size={12} />
              Reconnect
            </button>
          ) : (
            <button onClick={handleConnect}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold btn-primary transition">
              <PlugZap size={12} />
              Connect
            </button>
          )}

          {/* Tools count */}
          <button onClick={onEdit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t3)' }}>
            <Wrench size={12} style={{ color: 'var(--c-t4)' }} />
            Tools
            <span className="text-[11px]" style={{ color: 'var(--c-t5)' }}>
              ({connector.tool_count})
            </span>
          </button>

          {/* Access */}
          <button onClick={() => setShowAccess(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t3)' }}>
            <ShieldCheck size={12} style={{ color: 'var(--c-t4)' }} />
            Access
          </button>

          {/* Delete */}
          <div className="ml-auto">
            {confirmDel ? (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px]" style={{ color: 'var(--c-t4)' }}>Delete?</span>
                <button onClick={handleDelete} disabled={deleting}
                  className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[11px] rounded-md transition">
                  {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
                </button>
                <button onClick={() => setConfirmDel(false)}
                  className="px-2 py-0.5 rounded-md text-[11px] transition hover:bg-[var(--c-hover)]"
                  style={{ color: 'var(--c-t4)' }}>No</button>
              </div>
            ) : (
              <button onClick={() => setConfirmDel(true)} title="Delete"
                className="p-1.5 rounded-lg transition hover:bg-red-500/10"
                style={{ color: 'var(--c-t4)' }}>
                <Trash2 size={15} style={{ color: 'var(--c-primary)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {showAccess && (
        <AccessControl
          resourceName={connector.name}
          recordId={connector.id}
          routeName="connector"
          accessControl={connector.access_control}
          onClose={() => setShowAccess(false)}
          onSaved={ac => { onAccessUpdated(connector.id, ac); setShowAccess(false) }}
        />
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ConnectorsPage() {

  const [connectors,  setConnectors]  = useState<Connector[]>([])
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async (q?: string) => {
    setLoading(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_get_connectors', {})
      if (error) throw error
      const env = data as { is_success: boolean; data: Connector[] }
      if (env.is_success) {
        const all = env.data ?? []
        setConnectors(q ? all.filter(c =>
          c.name.toLowerCase().includes(q.toLowerCase()) ||
          c.description?.toLowerCase().includes(q.toLowerCase()) ||
          c.url?.toLowerCase().includes(q.toLowerCase())
        ) : all)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = search
    ? connectors.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.description?.toLowerCase().includes(search.toLowerCase()) ||
        c.url?.toLowerCase().includes(search.toLowerCase())
      )
    : connectors

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* Header */}
      <div className="px-6 py-5 border-b flex items-start justify-between gap-4 flex-shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <div>
          <h1 className="text-[18px] font-bold" style={{ color: 'var(--c-t1)' }}>Connectors</h1>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
            Connect external tools and MCP servers to power assistant tools.
          </p>
        </div>
        <button onClick={() => openEdit('new')}
          className="flex items-center gap-2 px-4 py-2.5 btn-primary text-[13px] font-semibold rounded-xl transition flex-shrink-0">
          <Plus size={15} /> Add Connector
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--c-t4)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search connectors..."
            className="w-full rounded-xl pl-9 pr-4 py-2 text-[12px] border focus:outline-none transition"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pt-5 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--c-hover)' }}>
              <AlertCircle size={24} style={{ color: 'var(--c-t5)' }} />
            </div>
            <div>
              <p className="text-[14px] font-medium" style={{ color: 'var(--c-t2)' }}>No connectors yet</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                Add your first MCP connector to get started.
              </p>
            </div>
            <button onClick={() => openEdit('new')}
              className="px-4 py-2 btn-primary text-[12px] font-medium rounded-xl transition">
              Add Connector
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {filtered.map(c => (
              <ConnectorCard
                key={c.id}
                connector={c}
                onEdit={() => openEdit(c.id)}
                onDeleted={id => setConnectors(prev => prev.filter(x => x.id !== id))}
                onAccessUpdated={(id, ac) =>
                  setConnectors(prev => prev.map(x =>
                    x.id === id ? { ...x, access_control: ac } : x
                  ))
                }
              />
            ))}
          </div>
        )}
      </div>

      {editId !== null && (
        <SaveModal
          connector={editId === 'new' ? null : connectors.find(c => String(c.id) === editId) ?? null}
          onClose={closeEdit}
          onSaved={saved => {
            setConnectors(prev => {
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
