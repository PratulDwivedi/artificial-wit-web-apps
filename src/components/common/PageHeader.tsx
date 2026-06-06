'use client'

import { Plus } from 'lucide-react'

interface PageHeaderProps {
  icon:        React.ReactNode
  title:       string
  description: React.ReactNode
  addLabel:    string
  onAdd:       () => void
}

export function PageHeader({ icon, title, description, addLabel, onAdd }: PageHeaderProps) {
  return (
    <div
      className="px-6 py-5 border-b flex items-start justify-between gap-4 flex-shrink-0"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}
    >
      <div className="flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--c-primary-light)' }}
        >
          {icon}
        </div>
        <div>
          <h1 className="text-[16px] font-semibold" style={{ color: 'var(--c-t1)' }}>
            {title}
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
            {description}
          </p>
        </div>
      </div>

      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-4 py-2.5 btn-primary text-[13px] font-semibold rounded-xl transition flex-shrink-0"
      >
        <Plus size={15} />
        {addLabel}
      </button>
    </div>
  )
}
