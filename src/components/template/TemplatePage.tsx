'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileText, Loader2, Menu, Save } from 'lucide-react'
import { useAppStore } from '@/lib/store'

export function TemplatePage() {
  const [isSaving, setIsSaving] = useState(false)
  const [saveMsg,  setSaveMsg]  = useState<{ text: string; ok: boolean } | null>(null)

  const searchParams = useSearchParams()
  const recordId     = searchParams.get('id') ?? undefined
  const isEditing    = !!recordId

  const { setSidebarOpen } = useAppStore()

  async function handleSave() {
    setIsSaving(true); setSaveMsg(null)
    try {
      // TODO: implement save logic
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Frozen page header ─────────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0"
            style={{ color: 'var(--c-t3)' }}
          >
            <Menu size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--c-active)' }}>
            <FileText size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--c-t1)' }}>
              Template
            </h1>
            <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>
              {isEditing ? `Edit template #${recordId}` : 'Create a new template'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            type="button"
            disabled={isSaving}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 btn-primary rounded-xl text-[13px] font-semibold transition disabled:opacity-60"
          >
            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {isSaving ? (isEditing ? 'Updating…' : 'Saving…') : (isEditing ? 'Update' : 'Save Template')}
          </button>
        </div>
      </div>

      {/* Save feedback banner */}
      {saveMsg && (
        <div className="shrink-0 px-6 py-2.5 text-[12px] border-b"
          style={saveMsg.ok
            ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.2)' }
            : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
          {saveMsg.text}
        </div>
      )}

      {/* ── Scrollable content ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-5">
        {/* Content goes here */}
      </div>
    </div>
  )
}
