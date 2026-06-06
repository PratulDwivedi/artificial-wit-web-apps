'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { BarChart2 } from 'lucide-react'
import { resolveIcon } from '@/lib/icons'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import type { PageSection, RpcEnvelope } from '@/lib/schema'

interface CardItem {
  id?: number | string
  // Accept any common naming convention for label / value / icon / color
  title?: string; name?: string; label?: string; stat_name?: string
  value?: string | number; count?: string | number; stat_value?: string | number
  icon?: string; stat_icon?: string
  color?: string; stat_color?: string
  description?: string; descr?: string
  [key: string]: unknown
}

interface Props {
  section: PageSection
}

const PALETTE = [
  '#6366f1','#8b5cf6','#ec4899','#f59e0b',
  '#10b981','#3b82f6','#ef4444','#14b8a6',
]


function StatCard({ item, index }: { item: CardItem; index: number }) {
  const label = item.title ?? item.name ?? item.label ?? item.stat_name ?? `Item ${index + 1}`
  const value = item.value ?? item.count ?? item.stat_value ?? '—'
  const iconName = item.icon ?? item.stat_icon
  const color = (item.color ?? item.stat_color ?? PALETTE[index % PALETTE.length]) as string
  const Icon = resolveIcon(iconName, BarChart2)

  return (
    <div
      className="rounded-2xl border p-4 flex items-start gap-3 transition-shadow hover:shadow-md"
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
    >
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}1a` }}
      >
        <Icon size={18} style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[24px] font-bold leading-tight tabular-nums"
          style={{ color: 'var(--c-t1)' }}>
          {String(value)}
        </p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--c-t4)' }}>
          {label}
        </p>
      </div>
    </div>
  )
}

export function DynamicCard({ section }: Props) {
  const { section_display_modes } = APP_CONSTANTS

  const [items,    setItems]    = useState<CardItem[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const isNoneMode = section.display_mode_id === section_display_modes.none
  const [expanded, setExpanded] = useState(
    section.display_mode_id !== section_display_modes.collapse
  )

  useEffect(() => {
    if (!section.binding_name) return
    setLoading(true); setError(null)
    HttpHelper.rpc(section.binding_name, {})
      .then(({ data, error: err }) => {
        if (err) { setError(err); return }
        const env = data as unknown as RpcEnvelope<CardItem[]>
        if (env?.is_success) setItems(env.data ?? [])
        else setError(env?.message ?? 'Failed to load')
      })
      .finally(() => setLoading(false))
  }, [section.binding_name])

  const body = loading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  ) : error ? (
    <p className="p-4 text-[12px]" style={{ color: '#ef4444' }}>{error}</p>
  ) : items.length === 0 ? (
    <p className="p-4 text-[13px] text-center" style={{ color: 'var(--c-t5)' }}>No data</p>
  ) : (
    /* Cards use auto-fill so they're naturally responsive without a fixed column count */
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}
      className={isNoneMode ? '' : 'p-4'}>
      {items.map((item, i) => (
        <StatCard key={String(item.id ?? i)} item={item} index={i} />
      ))}
    </div>
  )

  /* display_mode none → no collapsible header, content always visible */
  if (isNoneMode) return <>{body}</>

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
      <button type="button" onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left transition hover:bg-[var(--c-hover)]"
        style={{ borderBottom: expanded ? '1px solid var(--c-border)' : 'none', background: 'var(--c-topbar)' }}>
        {expanded
          ? <ChevronDown  size={13} style={{ color: 'var(--c-t4)' }} />
          : <ChevronRight size={13} style={{ color: 'var(--c-t4)' }} />}
        <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
          {section.name}
        </span>
      </button>
      {expanded && body}
    </div>
  )
}
