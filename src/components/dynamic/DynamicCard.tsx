'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { BarChart2 } from 'lucide-react'
import { resolveIcon } from '@/lib/icons'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import type { PageSection, RpcEnvelope } from '@/lib/schema'

interface CardItem {
  id?: number | string
  title?: string; name?: string; label?: string; stat_name?: string
  value?: string | number; count?: string | number; stat_value?: string | number
  item_icon?: string; icon?: string; stat_icon?: string
  color?: string; stat_color?: string
  description?: string; descr?: string
  url?: string
  sub_title?: string
  sub_title2?: string
  icon_symbol?: string
  [key: string]: unknown
}

interface Props {
  section: PageSection
}

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
]

function trendIcon(symbol?: string): { Icon: React.ElementType; color: string } | null {
  if (!symbol) return null
  const s = symbol.toLowerCase()
  if (s === 'down')  return { Icon: TrendingDown,   color: '#ef4444' }
  if (s === 'alert') return { Icon: AlertTriangle,  color: '#f59e0b' }
  if (s === 'up' || s === 'plus') return { Icon: TrendingUp, color: '#10b981' }
  return null
}

function StatCard({ item, index, onNavigate }: {
  item: CardItem
  index: number
  onNavigate?: (url: string) => void
}) {
  const label    = item.title ?? item.name ?? item.label ?? item.stat_name ?? `Item ${index + 1}`
  const value    = item.value ?? item.count ?? item.stat_value ?? '—'
  const iconName = item.item_icon ?? item.icon ?? item.stat_icon
  const color    = (item.color ?? item.stat_color ?? PALETTE[index % PALETTE.length]) as string
  const Icon     = resolveIcon(iconName, BarChart2)
  const trend    = trendIcon(item.icon_symbol)
  const clickable = !!item.url

  return (
    <div
      onClick={() => item.url && onNavigate?.(item.url)}
      className={`rounded-2xl border p-4 flex flex-col gap-3 h-full transition-all
        ${clickable ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : 'hover:shadow-md'}`}
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
    >
      {/* Top row: icon + trend badge */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${color}1a` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        {trend && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
            style={{ background: `${trend.color}15`, color: trend.color }}
          >
            <trend.Icon size={11} />
          </div>
        )}
      </div>

      {/* Value + label */}
      <div className="flex-1 min-w-0">
        <p className="text-[28px] font-bold leading-tight tabular-nums"
          style={{ color: 'var(--c-t1)' }}>
          {String(value)}
        </p>
        <p className="text-[12px] font-medium mt-0.5 truncate" style={{ color: 'var(--c-t2)' }}>
          {label}
        </p>
      </div>

      {/* Sub-titles */}
      {(item.sub_title || item.sub_title2) && (
        <p className="text-[11px] truncate" style={{ color: 'var(--c-t5)' }}>
          {[item.sub_title, item.sub_title2].filter(Boolean).join(' · ')}
        </p>
      )}
    </div>
  )
}

export function DynamicCard({ section }: Props) {
  const { section_display_modes } = APP_CONSTANTS
  const router = useRouter()

  const [items,   setItems]   = useState<CardItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

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

  const navigate = (url: string) => router.push(url)

  const cardSpan = items.length > 0 ? Math.max(1, Math.floor(12 / items.length)) : 12

  const body = loading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  ) : error ? (
    <p className="p-4 text-[12px]" style={{ color: '#ef4444' }}>{error}</p>
  ) : items.length === 0 ? (
    <p className="p-4 text-[13px] text-center" style={{ color: 'var(--c-t5)' }}>No data</p>
  ) : (
    <div className={`ctrl-grid w-full${isNoneMode ? '' : ' p-4'}`} style={{ gap: '16px' }}>
      {items.map((item, i) => (
        <div key={String(item.id ?? i)} style={{ '--col-span': cardSpan } as React.CSSProperties}>
          <StatCard item={item} index={i} onNavigate={navigate} />
        </div>
      ))}
    </div>
  )

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
