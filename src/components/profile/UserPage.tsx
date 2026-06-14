'use client'

import { useState, useCallback } from 'react'
import {
  Users, Menu, Loader2,
  Save, Eye, EyeOff, ChevronDown, ChevronRight,
} from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { useAppStore } from '@/lib/store'
import { APP_CONSTANTS } from '@/lib/constants'
import { DynamicReportTable } from '@/components/dynamic/DynamicReportTable'
import { NotificationBadge } from '@/components/common/NotificationBadge'
import type { PageSection, PageSchema } from '@/lib/schema'

// ── Stub schema objects for DynamicReportTable ─────────────────────────────────

const USER_SCHEMA: PageSchema = {
  id:                  -1,
  name:                'User',
  sections:            [],
  is_active:           true,
  module_id:           0,
  tenant_id:           0,
  created_at:          '',
  created_by:          0,
  route_name:          'user',
  platform_id:         0,
  page_type_id:        APP_CONSTANTS.page_types.report,
  display_order:       0,
  binding_type_id:     APP_CONSTANTS.page_binding_types.function,
  display_location_id: APP_CONSTANTS.page_display_locations.sidebar,
  binding_name_get:    'fn_get_user_profiles',
}

const { visible } = APP_CONSTANTS.control_display_modes
const { alphaNumeric, email: emailType, checkbox } = APP_CONSTANTS.control_types

const USER_LIST_SECTION: PageSection = {
  id:                    -1,
  name:                  'List Of Users',
  binding_name:          'fn_get_user_profiles',
  display_mode_id:       APP_CONSTANTS.section_display_modes.expand,
  child_display_mode_id: APP_CONSTANTS.child_display_modes.dataTableReport,
  controls: [
    { id: -1, name: 'Id',        binding_name: 'id',             display_order: 1, control_type_id: APP_CONSTANTS.control_types.integer,         display_mode_id: visible, data: { width: 1 } },
    { id: -2, name: 'Email',     binding_name: 'email',          display_order: 2, control_type_id: emailType,                                    display_mode_id: visible },
    { id: -3, name: 'Full Name', binding_name: 'full_name',      display_order: 3, control_type_id: alphaNumeric,                                 display_mode_id: visible },
    { id: -4, name: 'Admin',     binding_name: 'is_admin',       display_order: 4, control_type_id: checkbox,                                     display_mode_id: visible, data: { width: 1 } },
    { id: -5, name: 'Roles',     binding_name: 'roles',          display_order: 5, control_type_id: alphaNumeric,                                 display_mode_id: visible, data: { width: 5 } },
    { id: -6, name: 'Access',    binding_name: 'access_control', display_order: 6, control_type_id: APP_CONSTANTS.control_types.accessControl,    display_mode_id: visible },
    { id: -7, name: 'Delete',    binding_name: 'fn_delete_user_profile', display_order: 7, control_type_id: APP_CONSTANTS.control_types.deleteTableRow, display_mode_id: visible },
  ],
  is_active:    true,
  tenant_id:    0,
  created_at:   '',
  created_by:   0,
  platform_id:  0,
  display_order: 2,
}

// ── Form types ─────────────────────────────────────────────────────────────────

interface UserForm {
  email:           string
  password:        string
  full_name:       string
  is_admin:        boolean
  mobile_no:       string
  date_format:     string
  datetime_format: string
}

const BLANK_FORM: UserForm = {
  email:           '',
  password:        '',
  full_name:       '',
  is_admin:        false,
  mobile_no:       '',
  date_format:     'dd/mm/yyyy',
  datetime_format: 'dd/mm/yyyy hh:mm:ss',
}

// ── Shared input style ─────────────────────────────────────────────────────────

const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition'
const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

// ── Alert ──────────────────────────────────────────────────────────────────────

function Alert({ msg, ok }: { msg: string; ok?: boolean }) {
  return (
    <div className="text-[12px] rounded-lg px-4 py-3 border"
      style={ok
        ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.3)' }
        : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
      {msg}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function UserPage() {
  const { setSidebarOpen } = useAppStore()

  const [formOpen,   setFormOpen]   = useState(true)
  const [form,       setForm]       = useState<UserForm>(BLANK_FORM)
  const [showPw,     setShowPw]     = useState(false)
  const [saving,     setSaving]     = useState(false)
  const [formMsg,    setFormMsg]    = useState<{ text: string; ok: boolean } | null>(null)
  const [viewTrigger, setViewTrigger] = useState(0)

  const openCreate = () => {
    setForm(BLANK_FORM)
    setFormMsg(null)
    setShowPw(false)
    setFormOpen(true)
  }

  const closeForm = useCallback(() => {
    setFormOpen(false)
    setForm(BLANK_FORM)
    setFormMsg(null)
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.password) {
      setFormMsg({ text: 'Password is required.', ok: false })
      return
    }
    setFormMsg(null)
    setSaving(true)

    const body: Record<string, unknown> = {
      email:     form.email,
      password:  form.password,
      full_name: form.full_name || undefined,
      data: {
        is_admin:        form.is_admin,
        mobile_no:       form.mobile_no       || undefined,
        date_format:     form.date_format     || undefined,
        datetime_format: form.datetime_format || undefined,
      },
    }

    const { error } = await HttpHelper.post('/auth/users', body)
    setSaving(false)
    if (error) {
      setFormMsg({ text: error, ok: false })
      return
    }
    setFormMsg({ text: 'User created successfully.', ok: true })
    setViewTrigger(t => t + 1)
    setTimeout(closeForm, 1200)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Frozen page header ─────────────────────────────────────────────── */}
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
            <Users size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--c-t1)' }}>
              User
            </h1>
            <p className="hidden sm:block text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>
              Create and Update User
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <NotificationBadge />
        </div>
      </div>

      {/* ── Scrollable content — 16-col dynamic grid ───────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <div className="dyn-grid p-5" style={{ gap: '20px' }}>

          {/* ── Create User form section ── */}
          {formOpen && (
            <div style={{ '--col-span': 16 } as React.CSSProperties}>
              <div className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>

                {/* Section header */}
                <div className="flex items-center"
                  style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-topbar)' }}>
                  <button type="button" onClick={closeForm}
                    className="flex-1 flex items-center gap-2 px-4 py-3 text-left transition hover:bg-[var(--c-hover)] min-w-0">
                    <ChevronDown size={13} style={{ color: 'var(--c-t4)' }} />
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                       User Information
                    </span>
                  </button>
                </div>

                {/* Form body */}
                <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: 'var(--c-t4)' }}>Email *</label>
                      <input type="email" required value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="user@example.com" className={inputCls} style={inputStyle} autoFocus />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: 'var(--c-t4)' }}>Password *</label>
                      <div className="relative">
                        <input type={showPw ? 'text' : 'password'} required value={form.password}
                          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                          placeholder="••••••••" className={`${inputCls} pr-10`} style={inputStyle} />
                        <button type="button" onClick={() => setShowPw(p => !p)}
                          className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t4)' }}>
                          {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: 'var(--c-t4)' }}>Full Name</label>
                      <input value={form.full_name}
                        onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                        placeholder="e.g. John Smith" className={inputCls} style={inputStyle} />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                        style={{ color: 'var(--c-t4)' }}>Mobile Number</label>
                      <input value={form.mobile_no}
                        onChange={e => setForm(f => ({ ...f, mobile_no: e.target.value }))}
                        placeholder="e.g. 9999999999" className={inputCls} style={inputStyle} />
                    </div>
                  </div>


                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_admin" checked={form.is_admin}
                      onChange={e => setForm(f => ({ ...f, is_admin: e.target.checked }))}
                      className="w-4 h-4 rounded cursor-pointer" style={{ accentColor: 'var(--c-primary)' }} />
                    <label htmlFor="is_admin" className="text-[13px] cursor-pointer select-none"
                      style={{ color: 'var(--c-t3)' }}>Admin user</label>
                  </div>

                  {formMsg && <Alert msg={formMsg.text} ok={formMsg.ok} />}

                  <div className="flex items-center gap-3 pt-1">
                    <button type="submit" disabled={saving}
                      className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-60">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      {saving ? 'Creating…' : 'Create User'}
                    </button>
                    <button type="button" onClick={closeForm}
                      className="px-5 py-2.5 rounded-xl border text-[13px] font-medium transition hover:bg-[var(--c-hover)]"
                      style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* ── User list — DynamicReportTable ── */}
          {!formOpen && (
            <div style={{ '--col-span': 16 } as React.CSSProperties}>
              <div className="rounded-2xl border overflow-hidden"
                style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
                {/* Collapsed "Create User" row above the table */}
                <button type="button" onClick={openCreate}
                  className="w-full flex items-center gap-2 px-4 py-3 border-b text-left transition hover:bg-[var(--c-hover)]"
                  style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
                  <ChevronRight size={13} style={{ color: 'var(--c-t4)' }} />
                  <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                    Create / Update User
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Always-visible list section */}
          <div style={{ '--col-span': 16 } as React.CSSProperties}>
            <DynamicReportTable
              section={USER_LIST_SECTION}
              schema={USER_SCHEMA}
              viewTrigger={viewTrigger}
            />
          </div>

        </div>
      </div>
    </div>
  )
}
