'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Menu, LayoutDashboard } from 'lucide-react'
import { toast } from 'sonner'
import { HttpHelper } from '@/lib/http'
import { useAppStore } from '@/lib/store'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Dashboard {
  base_currency: string
  kpis: {
    open_value: number; weighted_value: number
    won_qtr_value: number; won_qtr_count: number
    open_count: number; win_rate: number | null
  }
  funnel: { stage_id: number; stage_name: string; stage_type: string; display_order: number; deal_count: number; deal_value: number }[]
  lead_sources: { source: string; cnt: number }[]
  closing_soon: { id: number; name: string; amount: number | null; currency: string; account_name: string | null; expected_close_date: string; days_left: number }[]
  leaderboard: { owner_id: number; owner_name: string | null; open_value: number; won_value: number; total_value: number }[]
  lead_status_counts: Record<string, number>
  recent_activity: { deal_name: string; account_name: string | null; to_stage: string; to_stage_type: string; changed_at: string }[]
}

const FN_DASHBOARD = 'crm.fn_get_crm_dashboard'

const SOURCE_COLORS = ['var(--c-primary)', '#d97706', '#2563eb', '#16a34a', '#9ca3af', '#7c3aed']

const fmtMoney = (n: number | null, currency = 'INR') =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, notation: 'compact', maximumFractionDigits: 1 }).format(n)

const timeAgo = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1d ago' : `${d}d ago`
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CrmDashboardPage() {
  const { setSidebarOpen } = useAppStore()
  const [data, setData] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    HttpHelper.rpcInvalidate(FN_DASHBOARD)
    const { data: res, error } = await HttpHelper.rpc<Dashboard[]>(FN_DASHBOARD)
    if (error || !res?.is_success) toast.error(error ?? res?.message ?? 'Failed to load dashboard')
    else if (res.data?.[0]) setData(res.data[0])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--c-base)' }}>
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
      </div>
    )
  }
  if (!data) return null

  // Aggregates come converted to the tenant base currency; per-deal rows keep native currency
  const cur = data.base_currency ?? 'INR'
  const fmtINR = (n: number | null) => fmtMoney(n, cur)

  const maxFunnelValue = Math.max(...data.funnel.map(f => f.deal_value), 1)
  const totalSources = data.lead_sources.reduce((a, s) => a + s.cnt, 0) || 1
  const maxLeaderboard = Math.max(...data.leaderboard.map(l => l.total_value), 1)

  const card: React.CSSProperties = { background: 'var(--c-panel)', borderColor: 'var(--c-border)' }

  return (
    <div className="flex-1 flex flex-col overflow-auto" style={{ background: 'var(--c-base)' }}>

      {/* ── Frozen page header (matches DynamicPage pattern) ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b sticky top-0 z-10"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0" style={{ color: 'var(--c-t3)' }}>
            <Menu size={18} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--c-active)' }}>
            <LayoutDashboard size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--c-t1)' }}>CRM Dashboard</h1>
            <p className="hidden sm:block text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>KPIs, funnel and activity · this quarter</p>
          </div>
        </div>
        <button onClick={() => load(true)} className="p-2 rounded-lg border transition hover:bg-[var(--c-hover)] shrink-0 ml-4" title="Refresh"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
          <RefreshCw size={14} />
        </button>
      </div>

      {/* KPI row */}
      <div className="flex gap-3 px-5 pt-4 flex-wrap">
        {[
          { l: 'Open pipeline', v: fmtINR(data.kpis.open_value), d: `${data.kpis.open_count} deals` },
          { l: 'Weighted forecast', v: fmtINR(data.kpis.weighted_value), d: 'probability-adjusted' },
          { l: 'Won this qtr', v: fmtINR(data.kpis.won_qtr_value), d: `${data.kpis.won_qtr_count} deal${data.kpis.won_qtr_count === 1 ? '' : 's'}`, pos: true },
          { l: 'Win rate', v: data.kpis.win_rate === null ? '—' : `${data.kpis.win_rate}%`, d: 'won vs closed' },
        ].map(k => (
          <div key={k.l} className="rounded-xl border px-4 py-3 min-w-[160px] flex-1" style={card}>
            <div className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>{k.l}</div>
            <div className="text-[20px] font-semibold mt-1" style={{ color: k.pos ? '#16a34a' : 'var(--c-t1)' }}>{k.v}</div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>{k.d}</div>
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid gap-4 px-5 py-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>

        {/* Funnel + sources */}
        <div className="rounded-xl border p-4" style={card}>
          <div className="text-[13px] font-semibold mb-3.5" style={{ color: 'var(--c-t1)' }}>
            Pipeline funnel <span className="font-normal" style={{ color: 'var(--c-t4)' }}>· count & value</span>
          </div>
          <div className="flex flex-col gap-2.5">
            {data.funnel.map((f, i) => {
              const isWon = f.stage_type === 'won'; const isLost = f.stage_type === 'lost'
              return (
                <div key={f.stage_id}>
                  <div className="flex justify-between text-[12px] mb-1">
                    <span style={{ color: isWon ? '#16a34a' : isLost ? 'var(--c-primary)' : 'var(--c-t2)', fontWeight: isWon || isLost ? 600 : 400 }}>{f.stage_name}</span>
                    <span style={{ color: 'var(--c-t4)' }}>{f.deal_count} · {fmtINR(f.deal_value)}</span>
                  </div>
                  <div className="h-[20px] rounded-md" style={{
                    width: `${Math.max(6, (f.deal_value / maxFunnelValue) * 100)}%`,
                    background: isWon ? '#16a34a' : 'var(--c-primary)',
                    opacity: isWon || isLost ? 1 : 0.35 + i * 0.15,
                  }} />
                </div>
              )
            })}
          </div>

          <div className="text-[13px] font-semibold mt-5 mb-2.5" style={{ color: 'var(--c-t1)' }}>Lead sources</div>
          <div className="flex gap-1 h-[13px] rounded-md overflow-hidden">
            {data.lead_sources.map((s, i) => (
              <div key={s.source} style={{ flex: s.cnt, background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} title={`${s.source}: ${s.cnt}`} />
            ))}
          </div>
          <div className="flex gap-3 flex-wrap text-[11px] mt-2" style={{ color: 'var(--c-t4)' }}>
            {data.lead_sources.map((s, i) => (
              <span key={s.source} className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: SOURCE_COLORS[i % SOURCE_COLORS.length] }} />
                {s.source} {Math.round((s.cnt / totalSources) * 100)}%
              </span>
            ))}
          </div>
        </div>

        {/* Closing soon */}
        <div className="rounded-xl border p-4" style={card}>
          <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--c-t1)' }}>Closing soon</div>
          <div className="flex flex-col gap-2.5">
            {data.closing_soon.map(d => (
              <div key={d.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>{d.name}</div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{[d.account_name, fmtMoney(d.amount, d.currency)].filter(Boolean).join(' · ')}</div>
                </div>
                <span className="text-[11px] font-medium rounded-full px-2.5 py-0.5 flex-none" style={
                  d.days_left < 0
                    ? { background: 'var(--c-primary-light)', color: 'var(--c-primary)' }
                    : d.days_left <= 10
                      ? { background: 'rgba(217,119,6,.12)', color: '#d97706' }
                      : { background: 'var(--c-active)', color: 'var(--c-t3)' }
                }>
                  {d.days_left < 0 ? 'overdue' : d.days_left === 0 ? 'today' : `${d.days_left} days`}
                </span>
              </div>
            ))}
            {data.closing_soon.length === 0 && <div className="text-[12px]" style={{ color: 'var(--c-t4)' }}>No open deals with close dates</div>}
          </div>

          <div className="text-[13px] font-semibold mt-5 mb-2.5" style={{ color: 'var(--c-t1)' }}>Leads by status</div>
          <div className="flex flex-col gap-1.5">
            {Object.entries(data.lead_status_counts).map(([status, cnt]) => (
              <div key={status} className="flex items-center justify-between text-[12px]">
                <span className="capitalize" style={{ color: 'var(--c-t3)' }}>{status}</span>
                <b style={{ color: 'var(--c-t1)' }}>{cnt}</b>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard + activity */}
        <div className="rounded-xl border p-4" style={card}>
          <div className="text-[13px] font-semibold mb-3" style={{ color: 'var(--c-t1)' }}>Owner leaderboard</div>
          <div className="flex flex-col gap-3">
            {data.leaderboard.map((o, i) => (
              <div key={o.owner_id} className="flex items-center gap-2.5">
                <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-none"
                  style={{ background: i === 0 ? 'var(--c-primary)' : 'var(--c-t4)' }}>
                  {(o.owner_name ?? '?').split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>{o.owner_name ?? `User #${o.owner_id}`}</div>
                  <div className="h-[5px] rounded mt-1" style={{ background: 'var(--c-active)' }}>
                    <div className="h-full rounded" style={{ width: `${(o.total_value / maxLeaderboard) * 100}%`, background: 'var(--c-primary)' }} />
                  </div>
                </div>
                <span className="text-[12px] font-semibold flex-none" style={{ color: 'var(--c-t1)' }}>{fmtINR(o.total_value)}</span>
              </div>
            ))}
          </div>

          <div className="text-[13px] font-semibold mt-5 mb-2.5" style={{ color: 'var(--c-t1)' }}>Recent activity</div>
          <div className="flex flex-col gap-2 text-[12.5px]">
            {data.recent_activity.map((a, i) => (
              <div key={i} style={{ color: 'var(--c-t2)' }}>
                <b style={{ color: 'var(--c-t1)' }}>{a.deal_name}</b> →{' '}
                <b style={{ color: a.to_stage_type === 'won' ? '#16a34a' : a.to_stage_type === 'lost' ? 'var(--c-primary)' : 'var(--c-t1)' }}>{a.to_stage}</b>
                <span style={{ color: 'var(--c-t4)' }}> · {[a.account_name, timeAgo(a.changed_at)].filter(Boolean).join(' · ')}</span>
              </div>
            ))}
            {data.recent_activity.length === 0 && <div style={{ color: 'var(--c-t4)' }}>No activity yet</div>}
          </div>
        </div>
      </div>
    </div>
  )
}
