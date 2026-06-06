'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, ShieldCheck, Globe, Lock, Loader2, ChevronDown } from 'lucide-react'
import { HttpHelper } from '@/lib/http'

// ── Types ──────────────────────────────────────────────────────────────────────

export type AccessScope = 'private' | 'protected' | 'public'

export interface AccessControlValue {
  scope: AccessScope
  roles: number[]
}

interface RoleOption {
  id: number
  name: string
  descr: string | null
}

export interface AccessControlProps {
  resourceName: string
  recordId: number
  routeName?: string
  pageId?: number
  accessControl?: {
    scope?: string
    roles?: number[]
  }
  onClose: () => void
  onSaved?: (value: AccessControlValue) => void
}

// ── Scope option config ────────────────────────────────────────────────────────

const SCOPE_OPTIONS: {
  value: AccessScope
  label: string
  description: string
  Icon: React.ElementType
}[] = [
  {
    value: 'private',
    label: 'Private',
    description: 'Only the owner can access this resource.',
    Icon: Lock,
  },
  {
    value: 'protected',
    label: 'Protected',
    description: 'Limit access to the selected roles below.',
    Icon: ShieldCheck,
  },
  {
    value: 'public',
    label: 'Public',
    description: 'Anyone in this tenant can access it.',
    Icon: Globe,
  },
]

function parseScope(raw: string | undefined): AccessScope {
  if (raw === 'protected' || raw === 'public') return raw
  return 'private'
}

// ── Compact scope dropdown (portal-based to escape overflow-y-auto) ─────────────

function ScopeSelect({ value, onChange }: {
  value: AccessScope
  onChange: (v: AccessScope) => void
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const handleOpen = () => {
    if (!open && btnRef.current) setRect(btnRef.current.getBoundingClientRect())
    setOpen(o => !o)
  }

  const selected = SCOPE_OPTIONS.find(o => o.value === value)!
  const SelIcon  = selected.Icon

  return (
    <>
      <button ref={btnRef} type="button" onClick={handleOpen}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition"
        style={{ background: 'var(--c-hover)', borderColor: open ? 'var(--c-primary)' : 'var(--c-border-strong)' }}>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--c-primary-light)' }}>
          <SelIcon size={15} style={{ color: 'var(--c-primary)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>{selected.label}</p>
          <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{selected.description}</p>
        </div>
        <ChevronDown size={14}
          className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--c-t4)' }} />
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={() => setOpen(false)} />
          <div className="fixed z-[201] rounded-xl border shadow-xl overflow-hidden"
            style={{ top: rect.bottom + 4, left: rect.left, width: rect.width,
                     background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
            {SCOPE_OPTIONS.map(opt => {
              const isSelected = opt.value === value
              const OptIcon    = opt.Icon
              return (
                <button key={opt.value} type="button"
                  onClick={() => { onChange(opt.value); setOpen(false) }}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition hover:bg-[var(--c-hover)]"
                  style={{ borderBottom: '1px solid var(--c-border)' }}>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: isSelected ? 'var(--c-primary-light)' : 'var(--c-hover)' }}>
                    <OptIcon size={15} style={{ color: isSelected ? 'var(--c-primary)' : 'var(--c-t4)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold"
                      style={{ color: isSelected ? 'var(--c-primary)' : 'var(--c-t1)' }}>{opt.label}</p>
                    <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>{opt.description}</p>
                  </div>
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0"
                      style={{ color: 'var(--c-primary)' }}>
                      <path d="M2 7l3.5 3.5L12 3" stroke="currentColor" strokeWidth="1.8"
                        strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              )
            })}
          </div>
        </>,
        document.body
      )}
    </>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function AccessControl({
  resourceName,
  recordId,
  routeName,
  pageId,
  accessControl,
  onClose,
  onSaved,
}: AccessControlProps) {
  const [mounted, setMounted]   = useState(false)
  const [scope, setScope]       = useState<AccessScope>(parseScope(accessControl?.scope))
  const [roleIds, setRoleIds]   = useState<number[]>(accessControl?.roles?.map(Number) ?? [])

  const [roles, setRoles]               = useState<RoleOption[]>([])
  const [rolesLoading, setRolesLoading] = useState(false)
  const [saving, setSaving]             = useState(false)
  const [saveErr, setSaveErr]           = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    async function loadRoles() {
      setRolesLoading(true)
      try {
        const { data, error } = await HttpHelper.rpc('fn_get_roles', {
          p_id: null, p_search: null,
        })
        if (error) throw error
        const env = data as { data: RoleOption[]; is_success: boolean }
        if (env.is_success) setRoles(env.data ?? [])
      } catch {
        // degrade gracefully
      } finally {
        setRolesLoading(false)
      }
    }
    loadRoles()
  }, [])

  function toggleRole(id: number) {
    setRoleIds((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (scope === 'protected' && roleIds.length === 0) {
      setSaveErr('Select at least one role for Protected access.')
      return
    }
    setSaving(true)
    setSaveErr(null)
    try {
      const { data, error } = await HttpHelper.rpc('fn_update_access_control', {
        p_id:             recordId,
        p_page_id:        pageId   ?? null,
        p_route_name:     routeName ?? null,
        p_access_control: {
          scope,
          roles: scope === 'protected' ? roleIds : [],
        },
      })
      if (error) throw error
      const env = data as { is_success: boolean; message: string; data: AccessControlValue }
      if (!env.is_success) { setSaveErr(env.message); return }

      onSaved?.({ scope, roles: scope === 'protected' ? roleIds : [] })
      onClose()
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : 'Failed to save access control')
    } finally {
      setSaving(false)
    }
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative rounded-2xl shadow-2xl w-full max-w-xl flex flex-col h-[72vh] min-h-[480px] border"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-5 border-b flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            <ShieldCheck size={18} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>Access Control</h2>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
              Manage who can access{' '}
              <span className="font-semibold" style={{ color: 'var(--c-t2)' }}>{resourceName}</span>.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)] flex-shrink-0"
            style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Visibility */}
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--c-t5)' }}>
              Visibility
            </p>
            <ScopeSelect value={scope} onChange={v => { setScope(v); setSaveErr(null) }} />
          </div>

          {/* Allowed Roles — only when Protected */}
          {scope === 'protected' && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--c-t5)' }}>
                Allowed Roles
              </p>

              {rolesLoading ? (
                <div className="flex items-center gap-2 py-3" style={{ color: 'var(--c-t4)' }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[12px]">Loading roles…</span>
                </div>
              ) : roles.length === 0 ? (
                <p className="text-[12px] py-2" style={{ color: 'var(--c-t4)' }}>
                  No roles available. Create roles first.
                </p>
              ) : (
                <div className="rounded-xl border overflow-hidden"
                  style={{ borderColor: 'var(--c-border-strong)' }}>
                  {roles.map((role, i) => {
                    const checked = roleIds.includes(role.id)
                    return (
                      <label key={role.id}
                        className="flex items-center gap-4 px-4 py-3.5 cursor-pointer transition"
                        style={{
                          borderTop: i > 0 ? '1px solid var(--c-border)' : undefined,
                          background: checked ? 'var(--c-primary-light)' : undefined,
                        }}
                        onMouseEnter={e => { if (!checked) e.currentTarget.style.background = 'var(--c-hover)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = checked ? 'var(--c-primary-light)' : '' }}>
                        <span className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border-2 transition"
                          style={checked
                            ? { background: 'var(--c-primary)', borderColor: 'var(--c-primary)' }
                            : { background: 'transparent', borderColor: 'var(--c-border-strong)' }}>
                          {checked && (
                            <svg viewBox="0 0 10 8" className="w-2.5 h-2.5" fill="none">
                              <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.8"
                                strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                        <input type="checkbox" className="hidden" checked={checked}
                          onChange={() => toggleRole(role.id)} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                            {role.name}
                          </p>
                          {role.descr && (
                            <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                              {role.descr}
                            </p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {saveErr && (
            <div className="text-[12px] rounded-lg px-4 py-3 border"
              style={{ background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {saveErr}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t flex-shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            disabled={saving || (scope === 'protected' && rolesLoading)}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl
                       transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            Save Access
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
