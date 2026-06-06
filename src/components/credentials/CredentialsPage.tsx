'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Plus, Pencil, Trash2, ShieldCheck, Loader2, X, KeyRound } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'
import { useEditParam } from '@/lib/useEditParam'
import { PageHeader } from '@/components/common/PageHeader'
import { DataTable, type Column } from '@/components/common/DataTable'

// ── Types ──────────────────────────────────────────────────────────────────────

type AuthType = 'none' | 'bearer' | 'basic' | 'api_key'

interface ApiAuth {
  id: number
  name: string
  description: string
  auth_type: AuthType
  auth_url: string | null
  auth_method: string
  auth_payload: string | null
  token_field_path: string
  username: string | null
  password: string | null
  headers: Record<string, string>
  data: Record<string, unknown>
  access_control: { scope?: string; roles?: number[] }
  created_at: string
  updated_at: string
}

interface GlobalVar {
  id: number
  name: string
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function AccessBadge({ scope }: { scope?: string }) {
  const s = scope ?? 'private'
  const map: Record<string, { bg: string; color: string; border: string; label: string }> = {
    private:   { bg: 'rgba(220,38,38,0.10)',  color: '#dc2626', border: 'rgba(220,38,38,0.25)',  label: 'Private'   },
    protected: { bg: 'rgba(234,179,8,0.10)',  color: '#ca8a04', border: 'rgba(234,179,8,0.30)',  label: 'Protected' },
    public:    { bg: 'rgba(22,163,74,0.10)',  color: '#16a34a', border: 'rgba(22,163,74,0.25)',  label: 'Public'    },
  }
  const { bg, color, border, label } = map[s] ?? map.private
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border"
      style={{ background: bg, color, borderColor: border }}>
      {label}
    </span>
  )
}

function AuthTypeBadge({ type }: { type: string }) {
  const label = type === 'none' ? 'None'
    : type === 'bearer' ? 'Bearer'
    : type === 'basic'  ? 'Basic'
    : type === 'api_key' ? 'API Key'
    : type
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border"
      style={{ background: 'var(--c-hover)', color: 'var(--c-t3)', borderColor: 'var(--c-border-strong)' }}>
      {label}
    </span>
  )
}

// ── Variable chips ─────────────────────────────────────────────────────────────

function VarChips({
  vars,
  onInsert,
}: {
  vars: GlobalVar[]
  onInsert: (varName: string) => void
}) {
  if (vars.length === 0) return null
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}>
      <p className="text-[11px] mb-2" style={{ color: 'var(--c-t4)' }}>
        Click a variable to insert at cursor
      </p>
      <div className="flex flex-wrap gap-1.5">
        {vars.map(v => (
          <button
            key={v.id}
            type="button"
            onClick={() => onInsert(`{{${v.name}}}`)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--c-t1)', color: 'var(--c-panel)' }}
          >
            {`{{${v.name}}}`}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Save Modal ─────────────────────────────────────────────────────────────────

const AUTH_TYPES: { value: AuthType; label: string }[] = [
  { value: 'none',    label: 'None'      },
  { value: 'bearer',  label: 'Bearer Token' },
  { value: 'basic',   label: 'Basic Auth'   },
  { value: 'api_key', label: 'API Key'      },
]

function SaveModal({
  auth, onClose, onSaved,
}: {
  auth: ApiAuth | null
  onClose: () => void
  onSaved: (a: ApiAuth) => void
}) {
  const isEdit    = auth !== null

  const [name,            setName]           = useState(auth?.name ?? '')
  const [description,     setDescription]    = useState(auth?.description ?? '')
  const [authType,        setAuthType]       = useState<AuthType>(auth?.auth_type ?? 'none')
  const [authUrl,         setAuthUrl]        = useState(auth?.auth_url ?? '')
  const [authMethod,      setAuthMethod]     = useState(auth?.auth_method ?? 'POST')
  const [authPayload,     setAuthPayload]    = useState(auth?.auth_payload ?? '')
  const [tokenFieldPath,  setTokenFieldPath] = useState(auth?.token_field_path ?? 'access_token')
  const [username,        setUsername]       = useState(auth?.username ?? '')
  const [password,        setPassword]       = useState(auth?.password ?? '')
  const [headers,         setHeaders]        = useState<{ key: string; value: string }[]>(
    Object.entries(auth?.headers ?? {}).map(([key, value]) => ({ key, value }))
  )

  const [globalVars, setGlobalVars] = useState<GlobalVar[]>([])
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // Track focused input for cursor insertion
  const activeRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null)

  useEffect(() => {
    HttpHelper.rpc('fn_get_global_variables', { p_id: null, p_search: null })
      .then(({ data }) => {
        const env = data as { is_success: boolean; data: GlobalVar[] }
        if (env?.is_success) setGlobalVars(env.data ?? [])
      })
  }, [])

  const insertVar = useCallback((token: string) => {
    const el = activeRef.current
    if (!el) return
    const start = el.selectionStart ?? el.value.length
    const end   = el.selectionEnd   ?? el.value.length
    const before = el.value.slice(0, start)
    const after  = el.value.slice(end)
    const next   = before + token + after

    // Determine which state to update by data-field attribute
    const field = el.dataset.field as string
    if (field === 'authUrl')        setAuthUrl(next)
    else if (field === 'authPayload') setAuthPayload(next)
    else if (field === 'tokenFieldPath') setTokenFieldPath(next)
    else if (field === 'username')  setUsername(next)
    else if (field === 'password')  setPassword(next)
    else if (field?.startsWith('hv-')) {
      const idx = parseInt(field.slice(3))
      setHeaders(prev => prev.map((h, i) => i === idx ? { ...h, value: next } : h))
    } else if (field?.startsWith('hk-')) {
      const idx = parseInt(field.slice(3))
      setHeaders(prev => prev.map((h, i) => i === idx ? { ...h, key: next } : h))
    }

    // Restore focus + cursor after state update
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }, [])

  const addHeader = () => setHeaders(prev => [...prev, { key: '', value: '' }])
  const removeHeader = (i: number) => setHeaders(prev => prev.filter((_, idx) => idx !== i))

  const inputCls  = `w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition`
  const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

  const focusProps = (field: string) => ({
    'data-field': field,
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      activeRef.current = e.currentTarget
    },
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)

    const headersObj: Record<string, string> = {}
    headers.filter(h => h.key.trim()).forEach(h => { headersObj[h.key.trim()] = h.value })

    try {
      const { data, error: rpcErr } = await HttpHelper.rpc('fn_save_api_auth', {
        p_id:               isEdit ? auth.id : null,
        p_name:             name.trim(),
        p_description:      description.trim(),
        p_auth_type:        authType,
        p_username:         username || null,
        p_password:         password || null,
        p_auth_url:         authUrl  || null,
        p_auth_method:      authMethod,
        p_auth_payload:     authPayload || null,
        p_token_field_path: tokenFieldPath || 'access_token',
        p_headers:          headersObj,
        p_data:             {},
      })
      if (rpcErr) throw rpcErr
      const env = data as { is_success: boolean; message: string; data: ApiAuth[] }
      if (!env.is_success) { setError(env.message); return }
      onSaved({ ...(isEdit ? auth : {} as ApiAuth), ...env.data[0], access_control: isEdit ? auth.access_control : {} })
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save credential')
    } finally {
      setSaving(false)
    }
  }

  const showBearerFields = authType === 'bearer'
  const showBasicFields  = authType === 'basic'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border max-h-[92vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <KeyRound size={16} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {isEdit ? 'Edit API Credential' : 'Add API Credential'}
              </h2>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                Manage API authorization configurations.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable form */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">

          {/* Name + Description */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>
                Name <span className="text-red-500">*</span>
              </label>
              <input value={name} onChange={e => setName(e.target.value)} required autoFocus={!isEdit}
                placeholder="e.g. CRM App Auth" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>
                Description
              </label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief description" className={inputCls} style={inputStyle} />
            </div>
          </div>

          {/* Auth Type */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>
              Authorization Type
            </label>
            <div className="relative">
              <select value={authType} onChange={e => setAuthType(e.target.value as AuthType)}
                className={`${inputCls} appearance-none cursor-pointer`} style={inputStyle}>
                {AUTH_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--c-t4)' }}>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          {/* Bearer fields */}
          {showBearerFields && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                    style={{ color: 'var(--c-t4)' }}>Auth URL</label>
                  <input value={authUrl} onChange={e => setAuthUrl(e.target.value)}
                    placeholder="{{AWT_API_BASE_URL}}/auth/token"
                    className={`${inputCls} font-mono`} style={inputStyle}
                    {...focusProps('authUrl')} />
                </div>
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                    style={{ color: 'var(--c-t4)' }}>Method</label>
                  <div className="relative">
                    <select value={authMethod} onChange={e => setAuthMethod(e.target.value)}
                      className={`${inputCls} appearance-none cursor-pointer`} style={inputStyle}>
                      {['POST', 'GET', 'PUT'].map(m => <option key={m}>{m}</option>)}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--c-t4)' }}>
                      <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>Auth Payload (JSON)</label>
                <textarea value={authPayload} onChange={e => setAuthPayload(e.target.value)} rows={3}
                  placeholder={'{\n    "email": "{{SYS_USER_EMAIL}}",\n    "password": "..."\n}'}
                  className={`${inputCls} font-mono resize-none`} style={inputStyle}
                  {...focusProps('authPayload')} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                    style={{ color: 'var(--c-t4)' }}>Token Field Path</label>
                  <input value={tokenFieldPath} onChange={e => setTokenFieldPath(e.target.value)}
                    placeholder="access_token" className={inputCls} style={inputStyle}
                    {...focusProps('tokenFieldPath')} />
                </div>
              </div>
            </>
          )}

          {/* Basic auth fields */}
          {showBasicFields && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>Username</label>
                <input value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Username or {{VAR}}" className={inputCls} style={inputStyle}
                  {...focusProps('username')} />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                  style={{ color: 'var(--c-t4)' }}>Password</label>
                <input value={password} onChange={e => setPassword(e.target.value)} type="password"
                  placeholder="Password or {{VAR}}" className={inputCls} style={inputStyle}
                  {...focusProps('password')} />
              </div>
            </div>
          )}

          {/* Custom Headers */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--c-t4)' }}>Custom Headers</label>
              <button type="button" onClick={addHeader}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition hover:bg-[var(--c-hover)]"
                style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}>
                <Plus size={12} /> Add Header
              </button>
            </div>
            {headers.length === 0 ? (
              <p className="text-[12px] py-2" style={{ color: 'var(--c-t5)' }}>No custom headers.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input value={h.key} placeholder="Header name"
                      onChange={e => setHeaders(prev => prev.map((x, idx) => idx === i ? { ...x, key: e.target.value } : x))}
                      className={`${inputCls} flex-[0_0_40%]`} style={inputStyle}
                      data-field={`hk-${i}`}
                      onFocus={e => { activeRef.current = e.currentTarget }} />
                    <input value={h.value} placeholder="Value or {{VARIABLE}}"
                      onChange={e => setHeaders(prev => prev.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))}
                      className={`${inputCls} flex-1 font-mono`} style={inputStyle}
                      data-field={`hv-${i}`}
                      onFocus={e => { activeRef.current = e.currentTarget }} />
                    <button type="button" onClick={() => removeHeader(i)}
                      className="p-2 rounded-lg transition hover:bg-red-500/10 flex-shrink-0"
                      style={{ color: 'var(--c-primary)' }}>
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </form>

        {/* Variable chips — frozen above footer */}
        {globalVars.length > 0 && (
          <div className="px-6 py-3 border-t shrink-0" style={{ borderColor: 'var(--c-border)' }}>
            <VarChips vars={globalVars} onInsert={insertVar} />
          </div>
        )}

        {/* Submission error */}
        {error && (
          <div className="mx-6 mb-2 text-[12px] rounded-lg px-4 py-3 border shrink-0"
            style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
            {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Cancel
          </button>
          <button type="submit" form="credentials-form" disabled={saving}
            onClick={submit as unknown as React.MouseEventHandler}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                       transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Update' : 'Add Credential'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Credential row ─────────────────────────────────────────────────────────────

function CredentialRow({
  auth, index, onEdit, onDeleted, onAccessUpdated,
}: {
  auth: ApiAuth
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
      const { data, error } = await HttpHelper.rpc('fn_delete_api_auth', { p_id: auth.id })
      if (error) throw error
      const env = data as { is_success: boolean }
      if (env.is_success) onDeleted(auth.id)
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
        <td className="px-4 py-1.5 whitespace-nowrap w-14">
          <span className="text-[12px] font-mono" style={{ color: 'var(--c-t5)' }}>
            {index}
          </span>
        </td>

        {/* Name */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <span className="text-[13px] font-mono font-semibold" style={{ color: 'var(--c-primary)' }}>
            {auth.name}
          </span>
        </td>

        {/* Auth Type */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <AuthTypeBadge type={auth.auth_type} />
        </td>

        {/* Auth URL */}
        <td className="px-4 py-1.5 max-w-[200px]">
          {auth.auth_url
            ? <span className="font-mono text-[12px] truncate block max-w-[180px]"
                style={{ color: 'var(--c-t3)' }}>{auth.auth_url}</span>
            : <span style={{ color: 'var(--c-t5)' }}>—</span>
          }
        </td>

        {/* Description */}
        <td className="px-4 py-1.5">
          <span className="text-[12px] line-clamp-1" style={{ color: 'var(--c-t4)' }}>
            {auth.description}
          </span>
        </td>

        {/* Access */}
        <td className="px-4 py-1.5 whitespace-nowrap">
          <AccessBadge scope={auth.access_control?.scope} />
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
                style={{ color: 'var(--c-t4)' }}>No</button>
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
          resourceName={auth.name}
          recordId={auth.id}
          routeName="api_auth"
          accessControl={auth.access_control}
          onClose={() => setShowAccess(false)}
          onSaved={ac => { onAccessUpdated(auth.id, ac); setShowAccess(false) }}
        />
      )}
    </>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

const CRED_COLUMNS: Column<ApiAuth>[] = [
  { key: 'name',        label: 'Name',      exportValue: a => a.name },
  { key: 'auth_type',   label: 'Auth Type', filterValue: a => a.auth_type, exportValue: a => a.auth_type },
  { key: 'auth_url',    label: 'Auth URL',  exportValue: a => a.auth_url ?? '' },
  { key: 'description', label: 'Description', exportValue: a => a.description ?? '' },
  { key: 'access',      label: 'Access',    filterValue: a => (a.access_control?.scope ?? 'private').charAt(0).toUpperCase() + (a.access_control?.scope ?? 'private').slice(1), exportValue: a => a.access_control?.scope ?? 'private' },
  { key: 'actions',     label: 'Actions' },
]

export function CredentialsPage() {

  const [auths,   setAuths]   = useState<ApiAuth[]>([])
  const [loading, setLoading] = useState(true)
  const { editId, openEdit, closeEdit } = useEditParam()

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await HttpHelper.rpc('fn_get_api_auths', { p_id: null, p_search: null })
      if (error) throw error
      const env = data as { is_success: boolean; data: ApiAuth[] }
      if (env.is_success) setAuths(env.data ?? [])
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ background: 'var(--c-panel)' }}>

      <PageHeader
        icon={<KeyRound size={20} style={{ color: 'var(--c-primary)' }} />}
        title="API Credentials"
        description="Securely store credentials for third-party services used by your agents."
        addLabel="Add Credential"
        onAdd={() => openEdit('new')}
      />

      <DataTable
        columns={CRED_COLUMNS}
        rows={auths}
        loading={loading}
        searchPlaceholder="Search credentials..."
        searchFields={a => `${a.name} ${a.description ?? ''}`}
        exportFilename="credentials"
        emptyIcon={<KeyRound size={24} style={{ color: 'var(--c-t5)' }} />}
        emptyTitle="No credentials yet"
        emptyDescription="Add your first API credential to get started."
        onAddClick={() => openEdit('new')}
        addLabel="Add Credential"
        renderRow={(a, i) => (
          <CredentialRow
            auth={a}
            index={i}
            onEdit={() => openEdit(a.id)}
            onDeleted={id => setAuths(prev => prev.filter(x => x.id !== id))}
            onAccessUpdated={(id, ac) =>
              setAuths(prev => prev.map(x => x.id === id ? { ...x, access_control: ac } : x))
            }
          />
        )}
      />

      {editId !== null && (
        <SaveModal
          auth={editId === 'new' ? null : auths.find(a => String(a.id) === editId) ?? null}
          onClose={closeEdit}
          onSaved={saved => {
            setAuths(prev => {
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
