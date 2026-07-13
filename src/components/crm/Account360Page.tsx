'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Loader2, ArrowLeft, RefreshCw, Globe, Phone, Mail, Menu, Building2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { HttpHelper } from '@/lib/http'
import { useAppStore } from '@/lib/store'

// ── Types ──────────────────────────────────────────────────────────────────────

interface Account360 {
  account: {
    id: number; name: string; website: string | null; industry: string | null
    account_type: string | null; phone: string | null; email: string | null
    annual_revenue: number | null; employee_count: number | null
    description: string | null; tags: string[] | null
    owner_id: number | null; owner_name: string | null; created_at: string
  }
  kpis: {
    open_count: number; open_value: number; won_value: number; won_count: number
    contact_count: number; last_activity: string | null
  }
  contacts: { id: number; name: string; email: string | null; phone: string | null; job_title: string | null; is_primary: boolean }[]
  deals: {
    id: number; name: string; amount: number | null; currency: string
    status: 'open' | 'won' | 'lost'; probability: number | null; stage_name: string
    expected_close_date: string | null; won_at: string | null; lost_at: string | null
    contact_name: string | null
  }[]
  timeline: {
    deal_name: string; from_stage: string | null; to_stage: string; to_stage_type: string
    changed_at: string; changed_by_name: string | null; duration_in_previous_stage: string | null
  }[]
}

const FN_GET_360 = 'crm.fn_get_account_360'

const fmtINR = (n: number | null) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1 }).format(n)

const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()

const timeAgo = (iso: string | null) => {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'today'
  if (d === 1) return '1d ago'
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function typePill(type: string | null): React.CSSProperties {
  switch (type) {
    case 'customer': return { background: 'rgba(22,163,74,.12)', color: '#16a34a' }
    case 'partner':  return { background: 'rgba(59,130,246,.12)', color: '#2563eb' }
    default:         return { background: 'var(--c-active)', color: 'var(--c-t3)' }
  }
}

function dealPill(status: string): React.CSSProperties {
  if (status === 'won')  return { background: 'rgba(22,163,74,.12)', color: '#16a34a' }
  if (status === 'lost') return { background: 'var(--c-primary-light)', color: 'var(--c-primary)' }
  return { background: 'rgba(59,130,246,.12)', color: '#2563eb' }
}

// ── Component ──────────────────────────────────────────────────────────────────

export function Account360Page() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { setSidebarOpen } = useAppStore()
  const accountId = Number(searchParams.get('id') ?? 0)

  const [detail, setDetail] = useState<Account360 | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (silent = false) => {
    if (!accountId) { setError('No account selected'); setLoading(false); return }
    if (!silent) setLoading(true)
    HttpHelper.rpcInvalidate(FN_GET_360, { p_account_id: accountId })
    const { data: res, error: err } = await HttpHelper.rpc<Account360[]>(FN_GET_360, { p_account_id: accountId })
    if (err || !res?.is_success) {
      setError(err ?? res?.message ?? 'Failed to load account')
      if (silent) toast.error(err ?? res?.message ?? 'Failed to load account')
    } else if (res.data?.[0]) {
      setDetail(res.data[0])
      setError(null)
    }
    setLoading(false)
  }, [accountId])

  useEffect(() => { load() }, [load])

  if (loading && !detail) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--c-base)' }}>
        <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
      </div>
    )
  }

  if (error || !detail) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8" style={{ background: 'var(--c-base)' }}>
        <AlertCircle size={24} style={{ color: '#ef4444' }} />
        <p className="text-[14px] font-medium" style={{ color: 'var(--c-t1)' }}>{error ?? 'Account not found'}</p>
        <button onClick={() => router.push('/accounts')}
          className="text-[13px] rounded-lg px-4 py-2 border"
          style={{ background: 'var(--c-panel)', color: 'var(--c-t2)', borderColor: 'var(--c-border-strong)' }}>
          ← Back to Accounts
        </button>
      </div>
    )
  }

  const a = detail.account
  const k = detail.kpis

  return (
    <div className="flex-1 flex flex-col overflow-hidden" style={{ background: 'var(--c-base)' }}>

      {/* ── Frozen page header (DynamicPage pattern) ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0" style={{ color: 'var(--c-t3)' }}>
            <Menu size={18} />
          </button>
          <button type="button" onClick={() => router.push('/accounts')}
            className="p-1.5 rounded-lg border transition hover:bg-[var(--c-hover)] shrink-0"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}
            title="Back to Accounts">
            <ArrowLeft size={15} />
          </button>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--c-active)' }}>
            <Building2 size={16} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h1 className="text-[15px] font-semibold leading-tight truncate" style={{ color: 'var(--c-t1)' }}>{a.name}</h1>
              {a.account_type && (
                <span className="text-[11px] font-medium rounded-full px-2.5 py-0.5 capitalize shrink-0" style={typePill(a.account_type)}>
                  {a.account_type}
                </span>
              )}
            </div>
            <p className="hidden sm:block text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>Account 360 view</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button onClick={() => load(true)} className="p-2 rounded-lg border transition hover:bg-[var(--c-hover)]"
            style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }} title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => router.push(`/accounts?id=${a.id}`)}
            className="btn-primary text-[13px] font-medium rounded-lg px-3.5 py-1.5">
            Edit
          </button>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-auto">

        {/* Contact strip */}
        <div className="px-6 pt-3 text-[12px] flex items-center gap-4 flex-wrap" style={{ color: 'var(--c-t4)' }}>
          {a.industry && <span>{a.industry}</span>}
          {a.website && <span className="inline-flex items-center gap-1"><Globe size={11} />{a.website.replace(/^https?:\/\/(www\.)?/, '')}</span>}
          {a.phone && <span className="inline-flex items-center gap-1"><Phone size={11} />{a.phone}</span>}
          {a.email && <span className="inline-flex items-center gap-1"><Mail size={11} />{a.email}</span>}
          {a.owner_name && <span>Owner: <b style={{ color: 'var(--c-t2)' }}>{a.owner_name}</b></span>}
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 px-4 sm:px-6 py-3">
          {[
            { l: 'Open deals', v: String(k.open_count), d: `${fmtINR(k.open_value)} value` },
            { l: 'Won (lifetime)', v: fmtINR(k.won_value), d: `${k.won_count} deal${k.won_count === 1 ? '' : 's'}`, pos: true },
            { l: 'Contacts', v: String(k.contact_count), d: `${detail.contacts.filter(c => c.is_primary).length} primary` },
            { l: 'Last activity', v: timeAgo(k.last_activity), d: 'stage change' },
          ].map(x => (
            <div key={x.l} className="rounded-xl border px-4 py-2.5 min-w-0" style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
              <div className="text-[11px] uppercase tracking-wide truncate" style={{ color: 'var(--c-t4)' }}>{x.l}</div>
              <div className="text-[17px] font-semibold mt-0.5 truncate" style={{ color: x.pos ? '#16a34a' : 'var(--c-t1)' }}>{x.v}</div>
              <div className="text-[11px] mt-0.5 truncate" style={{ color: 'var(--c-t4)' }}>{x.d}</div>
            </div>
          ))}
        </div>

        {/* Columns */}
        <div className="flex gap-4 px-4 sm:px-6 pb-6 items-start flex-wrap lg:flex-nowrap">

          {/* Contacts */}
          <div className="w-full lg:w-[280px] lg:flex-none flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold px-0.5" style={{ color: 'var(--c-t1)' }}>Contacts</div>
            {detail.contacts.map(c => (
              <div key={c.id} className="rounded-xl border px-3.5 py-3 flex items-center gap-2.5" style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
                <span className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-semibold text-white flex-none"
                  style={{ background: c.is_primary ? 'var(--c-primary)' : 'var(--c-t4)' }}>{initials(c.name)}</span>
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>
                    {c.name} {c.is_primary && <span className="text-[10px] font-medium rounded-full px-2 py-px ml-1" style={{ background: 'rgba(22,163,74,.12)', color: '#16a34a' }}>primary</span>}
                  </div>
                  <div className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{[c.job_title, c.email].filter(Boolean).join(' · ')}</div>
                </div>
              </div>
            ))}
            {detail.contacts.length === 0 && <div className="text-[12px] px-1" style={{ color: 'var(--c-t4)' }}>No contacts yet</div>}
          </div>

          {/* Deals */}
          <div className="flex-1 min-w-[280px] flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold px-0.5" style={{ color: 'var(--c-t1)' }}>Deals</div>
            {detail.deals.map(d => (
              <div key={d.id} className="rounded-xl border px-4 py-3" style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)', opacity: d.status === 'open' ? 1 : 0.75 }}>
                <div className="flex items-center gap-2">
                  <div className="text-[13px] font-semibold flex-1" style={{ color: 'var(--c-t1)' }}>{d.name}</div>
                  <span className="text-[11px] font-medium rounded-full px-2.5 py-0.5" style={dealPill(d.status)}>
                    {d.status === 'open' ? `${d.stage_name} · ${d.probability ?? 0}%` : d.status === 'won' ? 'Won ✓' : 'Lost'}
                  </span>
                </div>
                <div className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                  {[fmtINR(d.amount),
                    d.status === 'open' && d.expected_close_date ? `closes ${new Date(d.expected_close_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : null,
                    d.status === 'won' && d.won_at ? `won ${new Date(d.won_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : null,
                    d.contact_name].filter(Boolean).join(' · ')}
                </div>
                {d.status === 'open' && (
                  <div className="h-[3px] rounded mt-2.5 overflow-hidden" style={{ background: 'var(--c-active)' }}>
                    <div className="h-full rounded" style={{ width: `${d.probability ?? 0}%`, background: 'var(--c-primary)' }} />
                  </div>
                )}
              </div>
            ))}
            {detail.deals.length === 0 && <div className="text-[12px] px-1" style={{ color: 'var(--c-t4)' }}>No deals yet</div>}
          </div>

          {/* Timeline */}
          <div className="w-full lg:w-[300px] lg:flex-none flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold px-0.5" style={{ color: 'var(--c-t1)' }}>Activity timeline</div>
            <div className="rounded-xl border px-4 py-3.5" style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
              {detail.timeline.map((t, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <div className="w-[9px] h-[9px] rounded-full mt-1 flex-none"
                      style={{ background: t.to_stage_type === 'won' ? '#16a34a' : t.to_stage_type === 'lost' ? 'var(--c-primary)' : t.from_stage ? 'var(--c-primary)' : 'var(--c-t5)' }} />
                    {i < detail.timeline.length - 1 && <div className="w-[2px] flex-1" style={{ background: 'var(--c-border)' }} />}
                  </div>
                  <div className="pb-4">
                    <div className="text-[12px]" style={{ color: 'var(--c-t2)' }}>
                      <b style={{ color: 'var(--c-t1)' }}>{t.deal_name}</b>{' '}
                      {t.from_stage ? <>moved to <b>{t.to_stage}</b></> : <>created in <b>{t.to_stage}</b></>}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                      {timeAgo(t.changed_at)}{t.changed_by_name ? ` · ${t.changed_by_name}` : ''}
                    </div>
                  </div>
                </div>
              ))}
              {detail.timeline.length === 0 && <div className="text-[12px]" style={{ color: 'var(--c-t4)' }}>No activity yet</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
