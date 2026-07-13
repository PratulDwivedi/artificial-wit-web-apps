'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Plus, Search, Calendar, RefreshCw, Menu, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import { HttpHelper } from '@/lib/http'
import { useAppStore } from '@/lib/store'
import { NewDealModal } from '@/components/crm/NewDealModal'
import { DealDrawer } from '@/components/crm/DealDrawer'
import { SearchableDropdown } from '@/components/dynamic/SearchableDropdown'

// ── Types (shape of crm.fn_get_deals_kanban payload) ──────────────────────────

interface Pipeline {
  id: number
  name: string
  is_default: boolean
}

interface Stage {
  id: number
  name: string
  stage_type: 'open' | 'won' | 'lost'
  probability: number
  display_order: number
}

interface Deal {
  id: number
  name: string
  amount: number | null
  currency: string
  /** amount converted to the tenant base currency via crm.currency_rates */
  base_amount: number | null
  probability: number | null
  status: 'open' | 'won' | 'lost'
  stage_id: number
  expected_close_date: string | null
  account_id: number | null
  account_name: string | null
  contact_id: number | null
  contact_name: string | null
  owner_id: number | null
  owner_name: string | null
  updated_at: string
}

interface Owner {
  id: number
  name: string | null
}

interface Kpis {
  open_value: number
  weighted_value: number
  won_value: number
  open_count: number
}

interface KanbanData {
  base_currency: string
  pipelines: Pipeline[]
  pipeline_id: number
  stages: Stage[]
  deals: Deal[]
  owners: Owner[]
  kpis: Kpis
}

// Direct crm-schema calls — requires `crm` in PostgREST exposed schemas
// (Supabase → Project Settings → Data API) and in the API layer's allowed schemas.
const FN_GET_KANBAN  = 'crm.fn_get_deals_kanban'
const FN_UPDATE_STAGE = 'crm.fn_update_deal_stage'

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtAmount(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return '—'
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount)
  } catch {
    return String(amount)
  }
}

function initials(name: string | null): string {
  if (!name) return '?'
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

function stageDot(type: Stage['stage_type']): string {
  if (type === 'won') return '#16a34a'
  if (type === 'lost') return 'var(--c-primary)'
  return 'var(--c-t5)'
}

// ── Component ──────────────────────────────────────────────────────────────────

export function DealsKanbanPage() {
  const [data, setData] = useState<KanbanData | null>(null)
  const [loading, setLoading] = useState(true)
  const [pipelineId, setPipelineId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [ownerId, setOwnerId] = useState<number | ''>('')
  const [dueFilter, setDueFilter] = useState<'' | 'overdue' | 'this_month' | 'this_quarter'>('')
  const [dragOverStage, setDragOverStage] = useState<number | null>(null)
  const { setSidebarOpen } = useAppStore()
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [drawerDealId, setDrawerDealId] = useState<number | null>(null)
  const [pendingLost, setPendingLost] = useState<{ deal: Deal; stage: Stage } | null>(null)
  const [lostReason, setLostReason] = useState('')

  const load = useCallback(async (pId: number | null, silent = false) => {
    if (!silent) setLoading(true)
    const params = pId ? { p_pipeline_id: pId } : {}
    HttpHelper.rpcInvalidate(FN_GET_KANBAN, params)
    const { data: res, error } = await HttpHelper.rpc<KanbanData[]>(FN_GET_KANBAN, params)
    if (error || !res?.is_success) {
      toast.error(error ?? res?.message ?? 'Failed to load deals')
    } else {
      const payload = res.data?.[0]
      if (payload) {
        setData(payload)
        setPipelineId(payload.pipeline_id)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => { load(null) }, [load])

  const visibleDeals = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    const now = new Date()
    const quarter = Math.floor(now.getMonth() / 3)
    const matchesDue = (d: Deal): boolean => {
      if (!dueFilter) return true
      if (!d.expected_close_date) return false
      const due = new Date(d.expected_close_date)
      switch (dueFilter) {
        case 'overdue':      return d.status === 'open' && due < now
        case 'this_month':   return due.getFullYear() === now.getFullYear() && due.getMonth() === now.getMonth()
        case 'this_quarter': return due.getFullYear() === now.getFullYear() && Math.floor(due.getMonth() / 3) === quarter
        default:             return true
      }
    }
    return data.deals.filter(d =>
      (!q || d.name.toLowerCase().includes(q) || (d.account_name ?? '').toLowerCase().includes(q)) &&
      (ownerId === '' || d.owner_id === ownerId) &&
      matchesDue(d)
    )
  }, [data, search, ownerId, dueFilter])

  // KPIs are aggregated in the tenant base currency (base_amount = amount × rate)
  const kpis = useMemo(() => {
    const open = visibleDeals.filter(d => d.status === 'open')
    const val = (d: Deal) => d.base_amount ?? d.amount ?? 0
    return {
      openValue: open.reduce((a, d) => a + val(d), 0),
      weighted:  open.reduce((a, d) => a + val(d) * (d.probability ?? 0) / 100, 0),
      wonValue:  visibleDeals.filter(d => d.status === 'won').reduce((a, d) => a + val(d), 0),
      openCount: open.length,
    }
  }, [visibleDeals])

  const currency = data?.base_currency ?? 'INR'

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  const performMove = useCallback(async (deal: Deal, toStage: Stage, reason?: string) => {
    if (!data) return
    const prev = data
    // Optimistic move (trigger crm.fn_sync_deal_from_stage decides final status/probability)
    setData({
      ...data,
      deals: data.deals.map(d =>
        d.id === deal.id
          ? { ...d, stage_id: toStage.id, status: toStage.stage_type, probability: toStage.probability }
          : d
      ),
    })

    const { data: res, error } = reason
      ? await HttpHelper.rpc<{ id: number; stage_id: number; status: Deal['status']; probability: number }[]>(
          'crm.fn_update_deal', { p_deal_id: deal.id, p_stage_id: toStage.id, p_lost_reason: reason })
      : await HttpHelper.rpc<{ id: number; stage_id: number; status: Deal['status']; probability: number }[]>(
          FN_UPDATE_STAGE, { p_deal_id: deal.id, p_stage_id: toStage.id })

    if (error || !res?.is_success) {
      setData(prev)
      toast.error(error ?? res?.message ?? 'Failed to move deal')
      return
    }

    const updated = res.data?.[0]
    if (updated) {
      setData(curr => curr ? {
        ...curr,
        deals: curr.deals.map(d =>
          d.id === deal.id ? { ...d, status: updated.status, probability: updated.probability } : d
        ),
      } : curr)
    }
    HttpHelper.rpcInvalidate(FN_GET_KANBAN, pipelineId ? { p_pipeline_id: pipelineId } : {})
    toast.success(`"${deal.name}" moved to ${toStage.name}`)
  }, [data, pipelineId])

  const onDrop = useCallback((dealId: number, toStage: Stage) => {
    setDragOverStage(null)
    if (!data) return
    const deal = data.deals.find(d => d.id === dealId)
    if (!deal || deal.stage_id === toStage.id) return

    if (toStage.stage_type === 'lost') {
      // Ask for a lost reason before persisting
      setLostReason('')
      setPendingLost({ deal, stage: toStage })
      return
    }
    performMove(deal, toStage)
  }, [data, performMove])

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--c-base)' }}>
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Frozen page header (matches DynamicPage pattern) ── */}
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
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--c-active)' }}>
            <TrendingUp size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--c-t1)' }}>Deals</h1>
            <p className="hidden sm:block text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>Deal pipeline Kanban board</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={() => load(pipelineId, true)}
            className="p-2 rounded-lg border transition hover:bg-[var(--c-hover)]"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowNewDeal(true)}
            className="btn-primary flex items-center gap-1.5 text-[13px] font-medium rounded-lg px-3.5 py-1.5"
          >
            <Plus size={14} /> <span className="hidden sm:inline">New Deal</span><span className="inline sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* ── Filter row — 4 columns matching the KPI grid below ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-4 sm:px-6 pt-3">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 z-[1]" style={{ color: 'var(--c-t5)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search deals or accounts…"
            className="text-[13px] rounded-xl pl-8 pr-3 border w-full min-h-[38px]"
            style={{ background: 'var(--c-hover)', color: 'var(--c-t1)', borderColor: 'var(--c-border-strong)' }}
          />
        </div>

        <SearchableDropdown
          options={(data?.pipelines ?? []).map(p => ({ id: p.id, name: `${p.name}${p.is_default ? ' (default)' : ''}` }))}
          value={pipelineId}
          onChange={v => { if (v != null) load(Number(v)) }}
          placeholder="Pipeline"
        />

        <SearchableDropdown
          options={(data?.owners ?? []).map(o => ({ id: o.id, name: o.name ?? `User #${o.id}` }))}
          value={ownerId === '' ? null : ownerId}
          onChange={v => setOwnerId(v == null ? '' : Number(v))}
          placeholder="All owners"
        />

        <SearchableDropdown
          options={[
            { id: 'overdue',      name: 'Overdue' },
            { id: 'this_month',   name: 'Closing this month' },
            { id: 'this_quarter', name: 'Closing this quarter' },
          ]}
          value={dueFilter || null}
          onChange={v => setDueFilter((v == null ? '' : String(v)) as typeof dueFilter)}
          placeholder="Close date"
        />
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-4 sm:px-6 py-2.5 sm:py-3">
        {[
          { lbl: 'Open pipeline',     val: fmtAmount(kpis.openValue, currency) },
          { lbl: 'Weighted forecast', val: fmtAmount(kpis.weighted, currency) },
          { lbl: 'Won (visible)',     val: fmtAmount(kpis.wonValue, currency), pos: true },
          { lbl: 'Open deals',        val: String(kpis.openCount) },
        ].map(k => (
          <div
            key={k.lbl}
            className="rounded-xl border px-3 sm:px-4 py-2 sm:py-2.5 min-w-0"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
          >
            <div className="text-[10px] sm:text-[11px] uppercase tracking-wide truncate" style={{ color: 'var(--c-t4)' }}>{k.lbl}</div>
            <div className="text-[15px] sm:text-[17px] font-semibold mt-0.5 truncate" style={{ color: k.pos ? '#16a34a' : 'var(--c-t1)' }}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* ── Board ── */}
      <div
        className="flex-1 flex gap-2.5 sm:gap-3.5 px-4 sm:px-6 pb-4 sm:pb-5 pt-1 overflow-x-auto items-start"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {data?.stages.map(stage => {
          const stageDeals = visibleDeals.filter(d => d.stage_id === stage.id)
          const total = stageDeals.reduce((a, d) => a + (d.base_amount ?? d.amount ?? 0), 0)
          return (
            <div
              key={stage.id}
              className="rounded-xl border flex flex-col max-h-full flex-none w-[82vw] max-w-[300px] sm:w-[270px] xl:w-[290px]"
              style={{ background: 'var(--c-rail)', borderColor: 'var(--c-border)' }}
            >
              {/* Column head */}
              <div className="px-3.5 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: stageDot(stage.stage_type) }} />
                  <h2 className="text-[13px] font-semibold flex-1" style={{ color: 'var(--c-t1)' }}>{stage.name}</h2>
                  <span
                    className="text-[11px] rounded-full px-2 py-px"
                    style={{ background: 'var(--c-active)', color: 'var(--c-t4)' }}
                  >
                    {stageDeals.length}
                  </span>
                </div>
                <div className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                  {fmtAmount(total, currency)} · {stage.probability}% prob
                </div>
              </div>

              {/* Column body (drop target) */}
              <div
                className="flex flex-col gap-2 px-2.5 pb-2.5 pt-1 overflow-y-auto min-h-[60px] rounded-b-xl"
                style={dragOverStage === stage.id ? { outline: '2px dashed var(--c-primary)', outlineOffset: -4, background: 'var(--c-primary-light)' } : undefined}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.id) }}
                onDragLeave={() => setDragOverStage(s => (s === stage.id ? null : s))}
                onDrop={e => {
                  e.preventDefault()
                  const id = Number(e.dataTransfer.getData('text'))
                  if (id) onDrop(id, stage)
                }}
              >
                {stageDeals.map(deal => {
                  const due = deal.expected_close_date ? new Date(deal.expected_close_date) : null
                  const overdue = !!due && deal.status === 'open' && due < new Date()
                  return (
                    <div
                      key={deal.id}
                      draggable
                      onDragStart={e => e.dataTransfer.setData('text', String(deal.id))}
                      onClick={() => setDrawerDealId(deal.id)}
                      className="rounded-[10px] border p-3 cursor-grab transition-shadow hover:shadow-md"
                      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
                    >
                      <div className="text-[13px] font-semibold leading-snug" style={{ color: 'var(--c-t1)' }}>{deal.name}</div>
                      {deal.account_name && (
                        <div className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>{deal.account_name}</div>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                          {fmtAmount(deal.amount, deal.currency)}
                        </span>
                        <span
                          className="text-[11px] font-medium rounded-lg px-1.5 py-px"
                          style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}
                        >
                          {deal.probability ?? stage.probability}%
                        </span>
                      </div>
                      <div className="h-[3px] rounded mt-2.5 overflow-hidden" style={{ background: 'var(--c-active)' }}>
                        <div
                          className="h-full rounded"
                          style={{
                            width: `${deal.probability ?? stage.probability}%`,
                            background: stage.stage_type === 'won' ? '#16a34a' : 'var(--c-primary)',
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2.5">
                        <span
                          className="text-[11px] flex items-center gap-1"
                          style={{ color: overdue ? 'var(--c-primary)' : 'var(--c-t4)', fontWeight: overdue ? 500 : 400 }}
                        >
                          <Calendar size={11} />
                          {due ? due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}
                          {overdue && ' · overdue'}
                        </span>
                        <span
                          className="w-[22px] h-[22px] rounded-full flex items-center justify-center text-[10px] font-semibold text-white"
                          style={{ background: 'var(--c-primary)' }}
                          title={deal.owner_name ?? 'Unassigned'}
                        >
                          {initials(deal.owner_name)}
                        </span>
                      </div>
                    </div>
                  )
                })}

                {stageDeals.length === 0 && (
                  <div
                    className="text-[12px] text-center rounded-lg border border-dashed py-4"
                    style={{ color: 'var(--c-t5)', borderColor: 'var(--c-border-strong)' }}
                  >
                    No deals
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <NewDealModal
        open={showNewDeal}
        defaultPipelineId={pipelineId}
        onClose={() => setShowNewDeal(false)}
        onCreated={() => { setShowNewDeal(false); load(pipelineId, true) }}
      />

      <DealDrawer
        dealId={drawerDealId}
        onClose={() => setDrawerDealId(null)}
        onChanged={() => load(pipelineId, true)}
      />

      {/* Lost reason prompt */}
      {pendingLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}
          onMouseDown={e => { if (e.target === e.currentTarget) setPendingLost(null) }}>
          <div className="w-full max-w-[400px] rounded-2xl border shadow-xl p-5"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
            <div className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>
              Mark &quot;{pendingLost.deal.name}&quot; as lost?
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
              Moving to {pendingLost.stage.name}. Capture why this deal was lost.
            </div>
            <textarea
              value={lostReason}
              onChange={e => setLostReason(e.target.value)}
              rows={3}
              placeholder="e.g. Budget cut, went with competitor, timing…"
              className="w-full text-[13px] rounded-lg px-3 py-2 border resize-none mt-3"
              style={{ background: 'var(--c-panel)', color: 'var(--c-t1)', borderColor: 'var(--c-border-strong)' }}
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setPendingLost(null)}
                className="text-[13px] rounded-lg px-4 py-2 border"
                style={{ background: 'var(--c-panel)', color: 'var(--c-t2)', borderColor: 'var(--c-border-strong)' }}>
                Cancel
              </button>
              <button
                onClick={() => { performMove(pendingLost.deal, pendingLost.stage, lostReason.trim() || undefined); setPendingLost(null) }}
                className="btn-primary text-[13px] font-medium rounded-lg px-4 py-2">
                Mark as Lost
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
