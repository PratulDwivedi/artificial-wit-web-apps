'use client'

import { useState, useEffect, useCallback } from 'react'
import { CreditCard, Loader2, X, CheckCircle2, AlertCircle, Clock, XCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { HttpHelper } from '@/lib/http'
import { useAppStore } from '@/lib/store'
import { usePaymentGateway, type PaymentProvider } from '@/hooks/usePaymentGateway'
import { type Plan } from '@/hooks/useRazorpay'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'

// ── Types ──────────────────────────────────────────────────────────────────────

type BillingInterval = 'monthly' | 'annual'
type Tab = 'plans' | 'history'

interface Subscription {
  id: number
  tenant_id: number
  plan_id: number
  plan_name: string
  provider: string
  billing_interval: BillingInterval
  status: string
  current_period_start: string
  current_period_end: string
  price_monthly: number
  price_annual: number
  currency: string
}

interface Transaction {
  id: number
  type: string
  status: string
  amount: number
  currency: string
  provider: string
  plan_name: string
  description: string
  created_at: string
}

interface Paging {
  page_size: number
  page_index: number
  total_records: number
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'plans',   label: 'Plans'   },
  { id: 'history', label: 'History' },
]

const BASE = process.env.NEXT_PUBLIC_AW_API_BASE_URL!

// ── Helpers ────────────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T | null> {
  const token = HttpHelper.getToken()
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function fmtCurrency(amount: number, currency = 'INR') {
  if (currency === 'INR') return `₹${amount.toLocaleString('en-IN')}`
  return `${currency} ${amount.toLocaleString()}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function annualSavingPct(plan: Plan) {
  const annualMonthly = plan.price_monthly * 12
  if (!annualMonthly) return 0
  return Math.round((1 - plan.price_annual / annualMonthly) * 100)
}

// ── Status badge ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; Icon: typeof CheckCircle2; color: string; bg: string }> = {
  active:    { label: 'Active',    Icon: CheckCircle2, color: '#16a34a', bg: 'rgba(22,163,74,0.1)'  },
  cancelled: { label: 'Cancelled', Icon: XCircle,      color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  past_due:  { label: 'Past due',  Icon: AlertCircle,  color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  pending:   { label: 'Pending',   Icon: Clock,        color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
  succeeded: { label: 'Succeeded', Icon: CheckCircle2, color: '#16a34a', bg: 'rgba(22,163,74,0.1)'  },
  failed:    { label: 'Failed',    Icon: XCircle,      color: '#ef4444', bg: 'rgba(239,68,68,0.1)'  },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { label: status, Icon: Clock, color: 'var(--c-t4)', bg: 'var(--c-hover)' }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <s.Icon size={11} />
      {s.label}
    </span>
  )
}

// ── Subscription banner ────────────────────────────────────────────────────────

function SubscriptionBanner({
  sub,
  onCancel,
  cancelling,
}: {
  sub: Subscription
  onCancel: () => void
  cancelling: boolean
}) {
  const isActive = sub.status === 'active'
  return (
    <div className="rounded-xl border p-4 mb-6 flex items-start justify-between gap-4"
      style={{
        background:   isActive ? 'rgba(22,163,74,0.06)' : 'var(--c-hover)',
        borderColor:  isActive ? 'rgba(22,163,74,0.3)'  : 'var(--c-border)',
      }}>
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
            {sub.plan_name}
          </span>
          <StatusBadge status={sub.status} />
          <span className="text-[11px] px-2 py-0.5 rounded-full border text-[var(--c-t4)]"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
            {sub.billing_interval}
          </span>
        </div>
        <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
          {isActive
            ? `Renews ${fmtDate(sub.current_period_end)}`
            : `Period ends ${fmtDate(sub.current_period_end)}`}
          {' · '}
          {fmtCurrency(
            sub.billing_interval === 'annual' ? sub.price_annual : sub.price_monthly,
            sub.currency,
          )}
          /{sub.billing_interval === 'annual' ? 'yr' : 'mo'}
        </p>
      </div>
      {isActive && (
        <button
          onClick={onCancel}
          disabled={cancelling}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition disabled:opacity-50"
          style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#ef4444', background: 'rgba(239,68,68,0.06)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.06)' }}>
          {cancelling ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={12} />}
          Cancel plan
        </button>
      )}
    </div>
  )
}

// ── Plan card ──────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  interval,
  subscription,
  onSubscribe,
  loading,
  provider,
}: {
  plan: Plan
  interval: BillingInterval
  subscription: Subscription | null
  onSubscribe: (plan: Plan, interval: BillingInterval) => void
  loading: boolean
  provider: PaymentProvider
}) {
  const isCurrentPlan = subscription?.plan_id === plan.id && subscription?.status === 'active'
  const isCurrentInterval = isCurrentPlan && subscription?.billing_interval === interval
  const price = interval === 'annual' ? plan.price_annual : plan.price_monthly
  const savingPct = annualSavingPct(plan)

  return (
    <div className="rounded-xl border flex flex-col transition-shadow hover:shadow-md"
      style={{
        borderColor: isCurrentPlan ? 'var(--c-primary)' : 'var(--c-border)',
        background: 'var(--c-panel)',
        outline: isCurrentPlan ? '2px solid var(--c-primary-light)' : 'none',
        outlineOffset: '2px',
      }}>
      <div className="px-5 pt-5 pb-4 flex-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-[14px] font-bold" style={{ color: 'var(--c-t1)' }}>{plan.name}</h3>
          {isCurrentPlan && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
              Current
            </span>
          )}
        </div>
        <p className="text-[12px] mb-4 leading-relaxed" style={{ color: 'var(--c-t4)' }}>
          {plan.description}
        </p>

        <div className="mb-4">
          <span className="text-[26px] font-bold" style={{ color: 'var(--c-t1)' }}>
            {fmtCurrency(price, plan.currency)}
          </span>
          <span className="text-[12px] ml-1" style={{ color: 'var(--c-t5)' }}>
            /{interval === 'annual' ? 'yr' : 'mo'}
          </span>
          {interval === 'annual' && savingPct > 0 && (
            <span className="ml-2 text-[11px] font-semibold px-1.5 py-0.5 rounded"
              style={{ background: 'rgba(22,163,74,0.1)', color: '#16a34a' }}>
              Save {savingPct}%
            </span>
          )}
        </div>

        {plan.features && Object.keys(plan.features).length > 0 && (
          <ul className="space-y-1.5">
            {Object.entries(plan.features).map(([k, v]) => (
              <li key={k} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--c-t3)' }}>
                <CheckCircle2 size={13} style={{ color: '#16a34a', flexShrink: 0 }} />
                <span>{String(v)} {k}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="px-5 pb-5">
        {isCurrentInterval ? (
          <div className="w-full py-2.5 text-center rounded-xl text-[12px] font-semibold"
            style={{ background: 'var(--c-primary-light)', color: 'var(--c-primary)' }}>
            Current plan
          </div>
        ) : (
          <button
            onClick={() => onSubscribe(plan, interval)}
            disabled={loading}
            className="w-full py-2.5 rounded-xl text-[12px] font-semibold transition disabled:opacity-50"
            style={{ background: 'var(--c-primary)', color: '#fff' }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.88' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={13} className="animate-spin" /> Processing…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                {isCurrentPlan ? `Switch to ${interval}` : `Subscribe ${interval}`}
                {provider === 'stripe' && <ExternalLink size={11} className="opacity-70" />}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Plans tab ──────────────────────────────────────────────────────────────────

function PlansTab({
  plans,
  subscription,
  onSubscribe,
  onCancelRequest,
  loading,
  cancelling,
  provider,
}: {
  plans: Plan[]
  subscription: Subscription | null
  onSubscribe: (plan: Plan, interval: BillingInterval) => void
  onCancelRequest: () => void
  loading: boolean
  cancelling: boolean
  provider: PaymentProvider
}) {
  const [interval, setInterval] = useState<BillingInterval>('monthly')

  return (
    <div>
      {subscription && (
        <SubscriptionBanner
          sub={subscription}
          onCancel={onCancelRequest}
          cancelling={cancelling}
        />
      )}

      {/* Interval toggle */}
      <div className="flex items-center justify-center mb-6">
        <div className="flex rounded-xl p-1 border gap-0.5"
          style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border)' }}>
          {(['monthly', 'annual'] as BillingInterval[]).map(i => (
            <button key={i} onClick={() => setInterval(i)}
              className="px-5 py-1.5 rounded-lg text-[12px] font-semibold transition capitalize"
              style={{
                background:  interval === i ? 'var(--c-panel)'   : 'transparent',
                color:       interval === i ? 'var(--c-t1)'      : 'var(--c-t4)',
                boxShadow:   interval === i ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
              }}>
              {i}
              {i === 'annual' && plans.some(p => annualSavingPct(p) > 0) && (
                <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(22,163,74,0.12)', color: '#16a34a' }}>
                  Save up to {Math.max(...plans.map(annualSavingPct))}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="flex items-center justify-center py-12 text-[13px]" style={{ color: 'var(--c-t4)' }}>
          No plans available.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...plans]
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                interval={interval}
                subscription={subscription}
                onSubscribe={onSubscribe}
                loading={loading}
                provider={provider}
              />
            ))}
        </div>
      )}
    </div>
  )
}

// ── History tab ────────────────────────────────────────────────────────────────

function HistoryTab({ transactions, paging, onPageChange }: {
  transactions: Transaction[]
  paging: Paging | null
  onPageChange: (page: number) => void
}) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <CreditCard size={32} style={{ color: 'var(--c-t5)' }} />
        <p className="text-[13px]" style={{ color: 'var(--c-t4)' }}>No transactions yet.</p>
      </div>
    )
  }

  const totalPages = paging ? Math.ceil(paging.total_records / paging.page_size) : 1
  const currentPage = paging?.page_index ?? 1

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--c-border)' }}>
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ background: 'var(--c-hover)', borderBottom: '1px solid var(--c-border)' }}>
              {['Date', 'Plan', 'Amount', 'Type', 'Status'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-semibold uppercase tracking-wide text-[10px]"
                  style={{ color: 'var(--c-t4)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx, i) => (
              <tr key={tx.id}
                style={{
                  borderBottom: i < transactions.length - 1 ? '1px solid var(--c-border)' : 'none',
                  background: 'var(--c-panel)',
                }}>
                <td className="px-4 py-3" style={{ color: 'var(--c-t3)' }}>{fmtDate(tx.created_at)}</td>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--c-t1)' }}>{tx.plan_name}</td>
                <td className="px-4 py-3 font-semibold" style={{ color: 'var(--c-t1)' }}>
                  {fmtCurrency(tx.amount, tx.currency)}
                </td>
                <td className="px-4 py-3 capitalize" style={{ color: 'var(--c-t3)' }}>{tx.type}</td>
                <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[11px]" style={{ color: 'var(--c-t5)' }}>
            {paging?.total_records} transactions total
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => onPageChange(p)}
                className="w-7 h-7 rounded-lg text-[12px] font-medium transition"
                style={{
                  background: p === currentPage ? 'var(--c-primary)' : 'var(--c-hover)',
                  color:      p === currentPage ? '#fff'              : 'var(--c-t3)',
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── BillingPage ────────────────────────────────────────────────────────────────

// Provider priority: subscription.provider → env var → 'razorpay'
function resolveProvider(subscription: Subscription | null): PaymentProvider {
  const fromSub = subscription?.provider as PaymentProvider | undefined
  const fromEnv = (process.env.NEXT_PUBLIC_PAYMENT_PROVIDER ?? '') as PaymentProvider
  if (fromSub === 'stripe' || fromSub === 'razorpay') return fromSub
  if (fromEnv === 'stripe' || fromEnv === 'razorpay') return fromEnv
  return 'razorpay'
}

export function BillingPage({ onClose }: { onClose?: () => void }) {
  const { userEmail, fullName, userName } = useAppStore()
  const displayName = fullName || userName || ''

  const [activeTab,     setActiveTab]     = useState<Tab>('plans')
  const [plans,         setPlans]         = useState<Plan[]>([])
  const [subscription,  setSubscription]  = useState<Subscription | null>(null)
  const [transactions,  setTransactions]  = useState<Transaction[]>([])
  const [paging,        setPaging]        = useState<Paging | null>(null)
  const [txPage,        setTxPage]        = useState(1)
  const [dataLoading,    setDataLoading]    = useState(true)
  const [cancelling,     setCancelling]     = useState(false)
  const [confirmCancel,  setConfirmCancel]  = useState(false)
  const [stripePolling,  setStripePolling]  = useState(false)

  const provider = resolveProvider(subscription)
  const { subscribe, loading: payLoading, error: payError, clearError } = usePaymentGateway(
    userEmail ?? '',
    displayName,
  )

  // Handle Stripe redirect return (?payment=success|cancelled)
  // Stripe success_url just means the user finished checkout — the real status update
  // comes via webhook. Poll the subscription endpoint until it activates (or timeout).
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const payment = params.get('payment')
    if (!payment) return
    window.history.replaceState({}, '', window.location.pathname)

    if (payment === 'cancelled') {
      toast.info('Payment cancelled.')
      return
    }

    if (payment === 'success') {
      setStripePolling(true)
      const POLL_INTERVAL = 2000
      const MAX_ATTEMPTS  = 10  // 20 seconds total
      let attempts = 0

      const poll = async (): Promise<void> => {
        attempts++
        const json = await apiFetch<{ data: Subscription[]; is_success: boolean }>('/payment/subscription')
        const sub  = json?.data?.[0] ?? null

        if (sub?.status === 'active') {
          setSubscription(sub)
          setStripePolling(false)
          toast.success(`${sub.plan_name} subscription is now active!`)
          return
        }

        if (attempts >= MAX_ATTEMPTS) {
          setStripePolling(false)
          toast.warning(
            'Payment received — your subscription may take a moment to activate. Refresh if needed.',
            { duration: 8000 },
          )
          return
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL))
        return poll()
      }

      poll()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchAll = useCallback(async (page = txPage) => {
    setDataLoading(true)
    const token = HttpHelper.getToken()
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

    const [plansJson, subJson, txJson] = await Promise.all([
      apiFetch<{ data: Plan[]; is_success: boolean }>('/payment/plans'),
      apiFetch<{ data: Subscription[]; is_success: boolean }>('/payment/subscription'),
      fetch(`${BASE}/payment/transactions?page_size=10&page_index=${page}`, { headers })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null) as Promise<{ data: Transaction[]; paging: Paging; is_success: boolean } | null>,
    ])

    setPlans(plansJson?.data ?? [])
    setSubscription(subJson?.data?.[0] ?? null)
    setTransactions(txJson?.data ?? [])
    setPaging(txJson?.paging ?? null)
    setDataLoading(false)
  }, [txPage])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSubscribe = async (plan: Plan, interval: BillingInterval) => {
    clearError()
    const result = await subscribe(plan, interval, provider)
    if (result?.success) {
      toast.success('Subscription activated successfully!')
      await fetchAll()
    } else if (result?.error && result.error !== 'Payment cancelled') {
      toast.error(result.error)
    }
  }

  const handleCancel = async () => {
    setCancelling(true)
    const { error } = await HttpHelper.post('/payment/subscription/cancel', { cancel_reason: 'User requested' })
    setCancelling(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Subscription cancelled.')
      await fetchAll()
    }
  }

  const handlePageChange = (page: number) => {
    setTxPage(page)
    fetchAll(page)
  }

  const isModal = !!onClose

  const header = (
    <div className="flex items-start justify-between px-6 pt-5 pb-4 border-b shrink-0"
      style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: isModal ? '1rem 1rem 0 0' : undefined }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--c-primary-light)' }}>
          <CreditCard size={16} style={{ color: 'var(--c-primary)' }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>Billing & Plans</h2>
            {!dataLoading && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize"
                style={{ background: 'var(--c-hover)', color: 'var(--c-t4)', border: '1px solid var(--c-border)' }}>
                via {provider}
              </span>
            )}
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
            Manage your subscription and payment history.
          </p>
        </div>
      </div>
      {onClose && (
        <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
          style={{ color: 'var(--c-t4)' }}>
          <X size={16} />
        </button>
      )}
    </div>
  )

  const tabs = (
    <div className="flex shrink-0 border-b"
      style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
      {TABS.map(t => {
        const isActive = activeTab === t.id
        return (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className="relative px-5 py-3 text-[13px] font-medium transition"
            style={{ color: isActive ? 'var(--c-primary)' : 'var(--c-t4)' }}>
            {t.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                style={{ background: 'var(--c-primary)' }} />
            )}
          </button>
        )
      })}
    </div>
  )

  const content = (
    <>
      {/* Stripe webhook polling banner */}
      {stripePolling && (
        <div className="mb-4 flex items-center gap-3 px-4 py-3 rounded-xl border text-[12px]"
          style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.25)', color: '#6366f1' }}>
          <Loader2 size={14} className="animate-spin shrink-0" />
          <span>Confirming your payment with Stripe… this takes a few seconds.</span>
        </div>
      )}

      {payError && payError !== 'Payment cancelled' && (
        <div className="mb-4 px-4 py-3 rounded-xl border text-[12px]"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)', color: '#ef4444' }}>
          {payError}
        </div>
      )}

      {dataLoading ? (
        <div className="flex items-center justify-center py-16 gap-2" style={{ color: 'var(--c-t4)' }}>
          <Loader2 size={18} className="animate-spin" />
          <span className="text-[13px]">Loading…</span>
        </div>
      ) : (
        <>
          {activeTab === 'plans' && (
            <PlansTab
              plans={plans}
              subscription={subscription}
              onSubscribe={handleSubscribe}
              onCancelRequest={() => setConfirmCancel(true)}
              loading={payLoading}
              cancelling={cancelling}
              provider={provider}
            />
          )}
          {activeTab === 'history' && (
            <HistoryTab
              transactions={transactions}
              paging={paging}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title="Cancel subscription"
        message="Your subscription will be cancelled and you'll lose access at the end of the current billing period."
        confirmLabel="Cancel plan"
        variant="danger"
        onConfirm={() => { setConfirmCancel(false); handleCancel() }}
        onCancel={() => setConfirmCancel(false)}
      />
    </>
  )

  // ── Modal layout ───────────────────────────────────────────────────────────────
  if (isModal) {
    return (
      <div className="relative rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col border h-[88vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
        {header}
        {tabs}
        <div className="flex-1 overflow-y-auto px-6 py-5">{content}</div>
        <div className="flex gap-3 px-6 py-4 border-t shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', borderRadius: '0 0 1rem 1rem' }}>
          <button type="button" onClick={onClose}
            className="flex-1 text-[13px] font-medium py-2.5 rounded-xl border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Close
          </button>
        </div>
      </div>
    )
  }

  // ── Page layout ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--c-base)' }}>
      <div className="max-w-4xl w-full mx-auto px-6 py-8">
        <div className="flex items-center gap-4 mb-7">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'var(--c-primary-light)' }}>
            <CreditCard size={22} style={{ color: 'var(--c-primary)' }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: 'var(--c-t1)' }}>Billing & Plans</h1>
            <p className="text-[13px]" style={{ color: 'var(--c-t4)' }}>
              Manage your subscription and payment history.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 mb-6 border-b pb-0" style={{ borderColor: 'var(--c-border)' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition border-b-2 -mb-px"
              style={{
                color:       activeTab === t.id ? 'var(--c-t1)' : 'var(--c-t4)',
                borderColor: activeTab === t.id ? 'var(--c-primary)' : 'transparent',
                fontWeight:  activeTab === t.id ? 600 : undefined,
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {content}
      </div>
    </div>
  )
}
