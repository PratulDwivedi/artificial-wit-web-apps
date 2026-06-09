'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react'
import { BarChart2 } from 'lucide-react'
import { resolveIcon } from '@/lib/icons'
import { HttpHelper } from '@/lib/http'
import { APP_CONSTANTS } from '@/lib/constants'
import { useAppStore } from '@/lib/store'
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
      className={`rounded-2xl border p-4 flex items-start justify-between gap-3 transition-all
        ${clickable ? 'cursor-pointer hover:shadow-lg hover:-translate-y-0.5' : 'hover:shadow-md'}`}
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
    >
      {/* Left: label + sub-titles */}
      <div className="flex flex-col gap-1 min-w-0 flex-1">
        <p className="text-[15px] font-bold leading-snug" style={{ color: 'var(--c-t1)' }}>
          {label}
        </p>
        {item.sub_title && (
          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>{item.sub_title}</p>
        )}
        {item.sub_title2 && (
          <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>{item.sub_title2}</p>
        )}
      </div>

      {/* Right: icon top, trend + value bottom */}
      <div className="flex flex-col items-end justify-between gap-3 shrink-0">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}1a` }}
        >
          <Icon size={18} style={{ color }} />
        </div>
        <div className="flex items-center gap-1">
          {trend && <trend.Icon size={14} style={{ color: trend.color }} />}
          <p className="text-[22px] font-bold tabular-nums leading-none" style={{ color: 'var(--c-t1)' }}>
            {String(value)}
          </p>
        </div>
      </div>
    </div>
  )
}

export function DynamicCard({ section }: Props) {
  const { section_display_modes } = APP_CONSTANTS
  const router   = useRouter()
  const editMode = useAppStore(s => s.editMode)

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

  const body = loading ? (
    <div className="flex items-center justify-center py-8">
      <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  ) : error ? (
    <p className="p-4 text-[12px]" style={{ color: '#ef4444' }}>{error}</p>
  ) : items.length === 0 ? (
    <p className="p-4 text-[13px] text-center" style={{ color: 'var(--c-t5)' }}>No data</p>
  ) : (
    <div
      className={`card-grid w-full${isNoneMode ? '' : ' p-4'}`}
      style={{ gap: '16px', '--card-cols': items.length } as React.CSSProperties}
    >
      {items.map((item, i) => (
        <StatCard key={String(item.id ?? i)} item={item} index={i} onNavigate={navigate} />
      ))}
    </div>
  )

  if (isNoneMode) return (
    <div className="relative">
      {editMode && (
        <div className="absolute top-2 right-2 flex gap-0.5 z-10">
          <button type="button" onClick={() => router.push(`/page_section?id=${section.id}`)}
            className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Edit section"
            style={{ color: 'var(--c-t4)' }}>
            <Pencil size={12} />
          </button>
          <button type="button" onClick={() => router.push(`/page_section_control?section_id=${section.id}`)}
            className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Add control"
            style={{ color: 'var(--c-t4)' }}>
            <Plus size={12} />
          </button>
        </div>
      )}
      {body}
    </div>
  )

  return (
    <div className="rounded-2xl border overflow-hidden"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
      <div className="flex items-center"
        style={{ borderBottom: expanded ? '1px solid var(--c-border)' : 'none', background: 'var(--c-topbar)' }}>
        <button type="button" onClick={() => setExpanded(v => !v)}
          className="flex-1 flex items-center gap-2 px-4 py-3 text-left transition hover:bg-[var(--c-hover)] min-w-0">
          {expanded
            ? <ChevronDown  size={13} style={{ color: 'var(--c-t4)' }} />
            : <ChevronRight size={13} style={{ color: 'var(--c-t4)' }} />}
          <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
            {section.name}
          </span>
        </button>
        {editMode && (
          <div className="flex items-center gap-0.5 pr-2 shrink-0">
            <button type="button" onClick={() => router.push(`/page_section?id=${section.id}`)}
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Edit section"
              style={{ color: 'var(--c-t4)' }}>
              <Pencil size={12} />
            </button>
            <button type="button" onClick={() => router.push(`/page_section_control?section_id=${section.id}`)}
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]" title="Add control"
              style={{ color: 'var(--c-t4)' }}>
              <Plus size={12} />
            </button>
          </div>
        )}
      </div>
      {expanded && body}
    </div>
  )
}
