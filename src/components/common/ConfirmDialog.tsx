'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle, Trash2, Info } from 'lucide-react'

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'default'
  onConfirm: () => void
  onCancel: () => void
}

const VARIANT = {
  danger: {
    Icon:        Trash2,
    iconBg:      'rgba(239,68,68,0.12)',
    iconColor:   '#ef4444',
    btnBg:       '#ef4444',
    btnHover:    '#dc2626',
  },
  warning: {
    Icon:        AlertTriangle,
    iconBg:      'rgba(245,158,11,0.12)',
    iconColor:   '#f59e0b',
    btnBg:       '#f59e0b',
    btnHover:    '#d97706',
  },
  default: {
    Icon:        Info,
    iconBg:      'var(--c-primary-light)',
    iconColor:   'var(--c-primary)',
    btnBg:       'var(--c-primary)',
    btnHover:    'var(--c-primary)',
  },
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const v = VARIANT[variant]

  // Focus confirm button when opened; close on Escape
  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="w-full max-w-[420px] rounded-2xl shadow-2xl border p-6 flex flex-col gap-5"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
      >
        {/* Icon + title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: v.iconBg }}>
            <v.Icon size={18} style={{ color: v.iconColor }} />
          </div>
          <p className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>{title}</p>
        </div>

        {/* Message */}
        <p className="text-[13px] leading-relaxed" style={{ color: 'var(--c-t3)' }}>{message}</p>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-[13px] font-medium border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)' }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-[13px] font-medium text-white transition"
            style={{ background: v.btnBg }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
