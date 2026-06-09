'use client'

import { Loader2, X } from 'lucide-react'

interface Props {
  icon:      React.ReactNode
  title:     string
  subtitle?: string
  onClose:   () => void
  /** Optional tab bar rendered between header and scrollable content */
  tabs?:     React.ReactNode
  children:  React.ReactNode
  /** When provided, a primary Save button is shown in the footer */
  onSave?:   () => void
  saveLabel?: string
  saving?:   boolean
}

export function ModalShell({
  icon, title, subtitle, onClose,
  tabs, children,
  onSave, saveLabel = 'Save changes', saving = false,
}: Props) {
  return (
    <div className="relative rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col border h-[88vh]"
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

      {/* Frozen header */}
      <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '1rem 1rem 0 0' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            {icon}
          </div>
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>{title}</h2>
            {subtitle && (
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>{subtitle}</p>
            )}
          </div>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
          style={{ color: 'var(--c-t4)' }}>
          <X size={16} />
        </button>
      </div>

      {/* Optional tab bar */}
      {tabs && (
        <div className="flex shrink-0 border-b"
          style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
          {tabs}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {children}
      </div>

      {/* Frozen footer */}
      <div className="flex gap-3 px-6 py-4 border-t shrink-0"
        style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
        <button type="button" onClick={onClose}
          className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
          style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
          Cancel
        </button>
        {onSave && (
          <button type="button" onClick={onSave} disabled={saving}
            className="flex-1 btn-primary disabled:opacity-60 text-[13px] font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saveLabel}
          </button>
        )}
      </div>
    </div>
  )
}
