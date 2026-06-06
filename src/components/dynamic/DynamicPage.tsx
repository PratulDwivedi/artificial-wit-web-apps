'use client'

import { FileText } from 'lucide-react'

interface Props {
  routeName: string
}

export function DynamicPage({ routeName }: Props) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8"
      style={{ background: 'var(--c-base)' }}>
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--c-hover)' }}>
        <FileText size={22} style={{ color: 'var(--c-t4)' }} />
      </div>
      <div className="text-center">
        <p className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>
          {routeName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        </p>
        <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
          Dynamic page — content coming soon.
        </p>
      </div>
    </div>
  )
}
