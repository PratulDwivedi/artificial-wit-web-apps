'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { HttpHelper } from '@/lib/http'
import { SearchableDropdown } from '@/components/dynamic/SearchableDropdown'

// ── Types (shape of crm.fn_get_deal_form_options payload) ─────────────────────

interface Option { id: number; name: string; [key: string]: unknown }
interface ContactOption extends Option { account_id: number | null }
interface StageOption { id: number; name: string; stage_type: string; display_order: number; [key: string]: unknown }
interface PipelineOption { id: number; name: string; is_default: boolean; stages: StageOption[]; [key: string]: unknown }

interface FormOptions {
  accounts: Option[]
  contacts: ContactOption[]
  owners: Option[]
  pipelines: PipelineOption[]
  current_user_id: number
}

const FN_FORM_OPTIONS = 'crm.fn_get_deal_form_options'
const FN_CREATE_DEAL  = 'crm.fn_create_deal'

const LEAD_SOURCES = ['website', 'referral', 'campaign', 'tradeshow', 'partner', 'existing', 'other']
const CURRENCIES   = ['INR', 'USD', 'EUR', 'GBP', 'AED']

interface Props {
  open: boolean
  defaultPipelineId: number | null
  onClose: () => void
  onCreated: () => void
}

const inputStyle: React.CSSProperties = {
  background: 'var(--c-panel)',
  color: 'var(--c-t1)',
  borderColor: 'var(--c-border-strong)',
}

export function NewDealModal({ open, defaultPipelineId, onClose, onCreated }: Props) {
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [saving, setSaving] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [pipelineId, setPipelineId] = useState<number | ''>('')
  const [stageId, setStageId] = useState<number | ''>('')
  const [accountId, setAccountId] = useState<number | ''>('')
  const [contactId, setContactId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [closeDate, setCloseDate] = useState('')
  const [leadSource, setLeadSource] = useState('')
  const [ownerId, setOwnerId] = useState<number | ''>('')

  useEffect(() => {
    if (!open) return
    HttpHelper.rpc<FormOptions[]>(FN_FORM_OPTIONS).then(({ data, error }) => {
      if (error || !data?.is_success) {
        toast.error(error ?? data?.message ?? 'Failed to load form options')
        return
      }
      const opts = data.data?.[0]
      if (!opts) return
      setOptions(opts)
      const pipeline = opts.pipelines.find(p => p.id === defaultPipelineId) ?? opts.pipelines[0]
      setPipelineId(pipeline?.id ?? '')
      setStageId(pipeline?.stages.find(s => s.stage_type === 'open')?.id ?? '')
      setOwnerId(opts.current_user_id ?? '')
    })
  }, [open, defaultPipelineId])

  const pipeline = useMemo(
    () => options?.pipelines.find(p => p.id === pipelineId) ?? null,
    [options, pipelineId]
  )

  const filteredContacts = useMemo(
    () => (options?.contacts ?? []).filter(c => accountId === '' || c.account_id === accountId),
    [options, accountId]
  )

  const reset = () => {
    setName(''); setAccountId(''); setContactId(''); setAmount('')
    setCloseDate(''); setLeadSource(''); setCurrency('INR')
  }

  const submit = async () => {
    if (!name.trim()) { toast.error('Deal name is required'); return }
    setSaving(true)
    const { data, error } = await HttpHelper.rpc(FN_CREATE_DEAL, {
      p_name: name.trim(),
      p_pipeline_id: pipelineId || null,
      p_stage_id: stageId || null,
      p_account_id: accountId || null,
      p_contact_id: contactId || null,
      p_amount: amount ? Number(amount) : null,
      p_currency: currency,
      p_expected_close_date: closeDate || null,
      p_lead_source: leadSource || null,
      p_owner_id: ownerId || null,
    })
    setSaving(false)
    if (error || !data?.is_success) {
      toast.error(error ?? data?.message ?? 'Failed to create deal')
      return
    }
    toast.success(`Deal "${name.trim()}" created`)
    reset()
    onCreated()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[520px] rounded-2xl border shadow-xl flex flex-col max-h-[90vh]"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--c-border)' }}>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>New Deal</h2>
          <button onClick={onClose} className="p-1 rounded-md hover:opacity-70" style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-3.5">
          <label className="flex flex-col gap-1">
            <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Deal name *</span>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. ERP Implementation - Phase 2"
              className="text-[13px] rounded-lg px-3 py-2 border"
              style={inputStyle}
              autoFocus
            />
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Account</span>
              <SearchableDropdown
                options={options?.accounts ?? []}
                value={accountId === '' ? null : accountId}
                onChange={v => { setAccountId(v == null ? '' : Number(v)); setContactId('') }}
                placeholder="— None —"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Primary contact</span>
              <SearchableDropdown
                options={filteredContacts}
                value={contactId === '' ? null : contactId}
                onChange={v => setContactId(v == null ? '' : Number(v))}
                placeholder="— None —"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Pipeline</span>
              <SearchableDropdown
                options={options?.pipelines ?? []}
                value={pipelineId === '' ? null : pipelineId}
                onChange={v => {
                  if (v == null) return
                  const id = Number(v)
                  setPipelineId(id)
                  const p = options?.pipelines.find(x => x.id === id)
                  setStageId(p?.stages.find(s => s.stage_type === 'open')?.id ?? '')
                }}
                placeholder="Pipeline"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Stage</span>
              <SearchableDropdown
                options={pipeline?.stages ?? []}
                value={stageId === '' ? null : stageId}
                onChange={v => { if (v != null) setStageId(Number(v)) }}
                placeholder="Stage"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_110px] gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Amount</span>
              <input
                type="number"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0"
                className="text-[13px] rounded-lg px-3 py-2 border"
                style={inputStyle}
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Currency</span>
              <SearchableDropdown
                options={CURRENCIES.map(c => ({ id: c, name: c }))}
                value={currency}
                onChange={v => { if (v != null) setCurrency(String(v)) }}
                placeholder="Currency"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Expected close date</span>
              <input
                type="date"
                value={closeDate}
                onChange={e => setCloseDate(e.target.value)}
                className="text-[13px] rounded-lg px-3 py-2 border"
                style={inputStyle}
              />
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Lead source</span>
              <SearchableDropdown
                options={LEAD_SOURCES.map(s => ({ id: s, name: s }))}
                value={leadSource || null}
                onChange={v => setLeadSource(v == null ? '' : String(v))}
                placeholder="— None —"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-medium" style={{ color: 'var(--c-t3)' }}>Owner</span>
            <SearchableDropdown
              options={options?.owners ?? []}
              value={ownerId === '' ? null : ownerId}
              onChange={v => setOwnerId(v == null ? '' : Number(v))}
              placeholder="— Unassigned —"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t" style={{ borderColor: 'var(--c-border)' }}>
          <button
            onClick={onClose}
            className="text-[13px] rounded-lg px-4 py-2 border"
            style={{ background: 'var(--c-panel)', color: 'var(--c-t2)', borderColor: 'var(--c-border-strong)' }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving || !options}
            className="btn-primary text-[13px] font-medium rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-60"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Create Deal
          </button>
        </div>
      </div>
    </div>
  )
}
