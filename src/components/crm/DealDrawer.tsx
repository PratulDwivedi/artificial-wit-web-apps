'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, Trash2, Save, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { HttpHelper } from '@/lib/http'
import { SearchableDropdown } from '@/components/dynamic/SearchableDropdown'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DealContact {
  contact_id: number
  name: string
  job_title: string | null
  email: string | null
  role: string | null
  is_primary: boolean
}

interface DealDetail {
  deal_contacts: DealContact[]
  deal: {
    id: number; name: string; amount: number | null; currency: string
    probability: number | null; status: 'open' | 'won' | 'lost'
    pipeline_id: number; stage_id: number; stage_name: string
    expected_close_date: string | null
    won_at: string | null; lost_at: string | null; lost_reason: string | null
    lead_source: string | null; description: string | null
    account_id: number | null; account_name: string | null
    contact_id: number | null; contact_name: string | null
    owner_id: number | null; owner_name: string | null
    created_at: string; updated_at: string | null
  }
  timeline: {
    from_stage: string | null; to_stage: string; to_stage_type: string
    changed_at: string; changed_by_name: string | null
    duration_in_previous_stage: string | null
  }[]
}

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

const FN_DETAIL  = 'crm.fn_get_deal_detail'
const FN_UPDATE  = 'crm.fn_update_deal'
const FN_DELETE  = 'crm.fn_delete_deal'
const FN_OPTIONS = 'crm.fn_get_deal_form_options'

const FN_ADD_CONTACT    = 'crm.fn_add_deal_contact'
const FN_REMOVE_CONTACT = 'crm.fn_remove_deal_contact'

const LEAD_SOURCES  = ['website', 'referral', 'campaign', 'tradeshow', 'partner', 'existing', 'other']
const CURRENCIES    = ['INR', 'USD', 'EUR', 'GBP', 'AED']
const CONTACT_ROLES = ['Decision Maker', 'Champion', 'Influencer', 'Technical', 'Billing', 'Other']

const inputStyle: React.CSSProperties = {
  background: 'var(--c-panel)', color: 'var(--c-t1)', borderColor: 'var(--c-border-strong)',
}

const timeAgo = (iso: string) => {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (d === 0) return 'today'
  return d === 1 ? '1d ago' : d < 30 ? `${d}d ago` : `${Math.floor(d / 30)}mo ago`
}

interface Props {
  dealId: number | null
  onClose: () => void
  onChanged: () => void
}

export function DealDrawer({ dealId, onClose, onChanged }: Props) {
  const [detail, setDetail] = useState<DealDetail | null>(null)
  const [options, setOptions] = useState<FormOptions | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [closeDate, setCloseDate] = useState('')
  const [stageId, setStageId] = useState<number | ''>('')
  const [accountId, setAccountId] = useState<number | ''>('')
  const [contactId, setContactId] = useState<number | ''>('')
  const [ownerId, setOwnerId] = useState<number | ''>('')
  const [leadSource, setLeadSource] = useState('')
  const [description, setDescription] = useState('')
  const [lostReason, setLostReason] = useState('')

  // Deal contacts block
  const [addContactId, setAddContactId] = useState<number | ''>('')
  const [addRole, setAddRole] = useState('')
  const [contactBusy, setContactBusy] = useState(false)

  useEffect(() => {
    if (dealId === null) { setDetail(null); setConfirmDelete(false); return }
    setDetail(null)
    HttpHelper.rpcInvalidate(FN_DETAIL, { p_deal_id: dealId })
    Promise.all([
      HttpHelper.rpc<DealDetail[]>(FN_DETAIL, { p_deal_id: dealId }),
      HttpHelper.rpc<FormOptions[]>(FN_OPTIONS),
    ]).then(([d, o]) => {
      if (d.error || !d.data?.is_success) { toast.error(d.error ?? d.data?.message ?? 'Failed to load deal'); onClose(); return }
      const det = d.data.data?.[0]
      if (!det) { onClose(); return }
      setDetail(det)
      if (!o.error && o.data?.is_success && o.data.data?.[0]) setOptions(o.data.data[0])
      // Prefill form
      const dl = det.deal
      setName(dl.name)
      setAmount(dl.amount !== null ? String(dl.amount) : '')
      setCurrency(dl.currency)
      setCloseDate(dl.expected_close_date ?? '')
      setStageId(dl.stage_id)
      setAccountId(dl.account_id ?? '')
      setContactId(dl.contact_id ?? '')
      setOwnerId(dl.owner_id ?? '')
      setLeadSource(dl.lead_source ?? '')
      setDescription(dl.description ?? '')
      setLostReason(dl.lost_reason ?? '')
    })
  }, [dealId, onClose])

  const stages = useMemo(() => {
    if (!detail || !options) return []
    return options.pipelines.find(p => p.id === detail.deal.pipeline_id)?.stages ?? []
  }, [detail, options])

  const selectedStageIsLost = useMemo(
    () => stages.find(s => s.id === stageId)?.stage_type === 'lost',
    [stages, stageId]
  )

  const filteredContacts = useMemo(
    () => (options?.contacts ?? []).filter(c => accountId === '' || c.account_id === accountId),
    [options, accountId]
  )

  // Silently refresh only the contacts + timeline (leaves unsaved form edits intact)
  const refreshContacts = async () => {
    if (!detail) return
    HttpHelper.rpcInvalidate(FN_DETAIL, { p_deal_id: detail.deal.id })
    const { data: res } = await HttpHelper.rpc<DealDetail[]>(FN_DETAIL, { p_deal_id: detail.deal.id })
    const fresh = res?.is_success ? res.data?.[0] : undefined
    if (fresh) setDetail(d => d ? { ...d, deal_contacts: fresh.deal_contacts, timeline: fresh.timeline } : d)
  }

  const addContact = async () => {
    if (!detail || addContactId === '') return
    setContactBusy(true)
    const { data: res, error } = await HttpHelper.rpc(FN_ADD_CONTACT, {
      p_deal_id: detail.deal.id,
      p_contact_id: addContactId,
      p_role: addRole || null,
    })
    setContactBusy(false)
    if (error || !res?.is_success) { toast.error(error ?? res?.message ?? 'Failed to add contact'); return }
    toast.success(res.message ?? 'Contact added')
    setAddContactId(''); setAddRole('')
    refreshContacts()
  }

  const removeContact = async (id: number) => {
    if (!detail) return
    setContactBusy(true)
    const { data: res, error } = await HttpHelper.rpc(FN_REMOVE_CONTACT, {
      p_deal_id: detail.deal.id,
      p_contact_id: id,
    })
    setContactBusy(false)
    if (error || !res?.is_success) { toast.error(error ?? res?.message ?? 'Failed to remove contact'); return }
    toast.success(res.message ?? 'Contact removed')
    if (contactId === id) setContactId('') // server cleared the deal's primary pointer
    refreshContacts()
  }

  const save = async () => {
    if (!detail) return
    if (!name.trim()) { toast.error('Deal name is required'); return }
    setSaving(true)
    const { data: res, error } = await HttpHelper.rpc(FN_UPDATE, {
      p_deal_id: detail.deal.id,
      p_name: name.trim(),
      p_amount: amount ? Number(amount) : null,
      p_currency: currency,
      p_expected_close_date: closeDate || null,
      p_stage_id: stageId || null,
      p_account_id: accountId === '' ? 0 : accountId,
      p_contact_id: contactId === '' ? 0 : contactId,
      p_owner_id: ownerId === '' ? 0 : ownerId,
      p_lead_source: leadSource || null,
      p_description: description || null,
      p_lost_reason: selectedStageIsLost && lostReason.trim() ? lostReason.trim() : null,
    })
    setSaving(false)
    if (error || !res?.is_success) { toast.error(error ?? res?.message ?? 'Failed to update deal'); return }
    toast.success('Deal updated')
    onChanged()
    onClose()
  }

  const remove = async () => {
    if (!detail) return
    setSaving(true)
    const { data: res, error } = await HttpHelper.rpc(FN_DELETE, { p_deal_id: detail.deal.id })
    setSaving(false)
    if (error || !res?.is_success) { toast.error(error ?? res?.message ?? 'Failed to delete deal'); return }
    toast.success('Deal deleted')
    onChanged()
    onClose()
  }

  if (dealId === null) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[440px] h-full flex flex-col border-l shadow-2xl"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b flex-none" style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>
              {detail?.deal.name ?? 'Loading…'}
            </div>
            {detail && (
              <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                #{detail.deal.id} · created {timeAgo(detail.deal.created_at)}
                {detail.deal.status !== 'open' && (
                  <span className="ml-2 font-semibold uppercase" style={{ color: detail.deal.status === 'won' ? '#16a34a' : 'var(--c-primary)' }}>
                    {detail.deal.status}
                  </span>
                )}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:opacity-70" style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {!detail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
          </div>
        ) : (
          <>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3.5">

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Deal Name<span className="ml-0.5" style={{ color: '#ef4444' }}>*</span></span>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="text-[13px] rounded-lg px-3 py-2 border" style={inputStyle} />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Amount</span>
                  <input type="number" min="0" value={amount} onChange={e => setAmount(e.target.value)}
                    className="text-[13px] rounded-lg px-3 py-2 border" style={inputStyle} />
                </label>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Currency</span>
                  <SearchableDropdown
                    options={CURRENCIES.map(c => ({ id: c, name: c }))}
                    value={currency}
                    onChange={v => { if (v != null) setCurrency(String(v)) }}
                    placeholder="Currency"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Stage</span>
                  <SearchableDropdown
                    options={stages}
                    value={stageId === '' ? null : stageId}
                    onChange={v => { if (v != null) setStageId(Number(v)) }}
                    placeholder="Stage"
                  />
                </div>
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Expected close</span>
                  <input type="date" value={closeDate} onChange={e => setCloseDate(e.target.value)}
                    className="text-[13px] rounded-lg px-3 py-2 border" style={inputStyle} />
                </label>
              </div>

              {selectedStageIsLost && (
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-primary)' }}>Lost Reason</span>
                  <textarea value={lostReason} onChange={e => setLostReason(e.target.value)} rows={2}
                    placeholder="Why was this deal lost?"
                    className="text-[13px] rounded-lg px-3 py-2 border resize-none"
                    style={{ ...inputStyle, borderColor: 'var(--c-primary)' }} />
                </label>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Account</span>
                  <SearchableDropdown
                    options={options?.accounts ?? []}
                    value={accountId === '' ? null : accountId}
                    onChange={v => { setAccountId(v == null ? '' : Number(v)); setContactId('') }}
                    placeholder="— None —"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Primary contact</span>
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
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Owner</span>
                  <SearchableDropdown
                    options={options?.owners ?? []}
                    value={ownerId === '' ? null : ownerId}
                    onChange={v => setOwnerId(v == null ? '' : Number(v))}
                    placeholder="— Unassigned —"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Lead source</span>
                  <SearchableDropdown
                    options={LEAD_SOURCES.map(s => ({ id: s, name: s }))}
                    value={leadSource || null}
                    onChange={v => setLeadSource(v == null ? '' : String(v))}
                    placeholder="— None —"
                  />
                </div>
              </div>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>Description</span>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3}
                  className="text-[13px] rounded-lg px-3 py-2 border resize-none" style={inputStyle} />
              </label>

              {/* Deal contacts */}
              <div className="mt-1">
                <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--c-t2)' }}>
                  Contacts <span className="font-normal" style={{ color: 'var(--c-t4)' }}>({detail.deal_contacts.length})</span>
                </div>
                <div className="rounded-xl border px-3.5 py-3 flex flex-col gap-2.5" style={{ borderColor: 'var(--c-border)' }}>
                  {detail.deal_contacts.map(dc => (
                    <div key={dc.contact_id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium truncate" style={{ color: 'var(--c-t1)' }}>
                          {dc.name}
                          {dc.is_primary && (
                            <span className="text-[10px] font-medium rounded-full px-2 py-px ml-1.5"
                              style={{ background: 'rgba(22,163,74,.12)', color: '#16a34a' }}>primary</span>
                          )}
                        </div>
                        <div className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>
                          {[dc.role, dc.job_title, dc.email].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      <button
                        onClick={() => removeContact(dc.contact_id)}
                        disabled={contactBusy}
                        title="Remove from deal"
                        className="p-1 rounded-md transition hover:opacity-70 disabled:opacity-40 flex-none"
                        style={{ color: 'var(--c-t4)' }}
                      >
                        <X size={13} />
                      </button>
                    </div>
                  ))}
                  {detail.deal_contacts.length === 0 && (
                    <div className="text-[12px]" style={{ color: 'var(--c-t4)' }}>No contacts on this deal yet</div>
                  )}

                  {/* Add contact row */}
                  <div className="flex items-center gap-2 pt-2.5 border-t" style={{ borderColor: 'var(--c-border)' }}>
                    <div className="flex-1 min-w-0">
                      <SearchableDropdown
                        options={(options?.contacts ?? []).filter(c => !detail.deal_contacts.some(dc => dc.contact_id === c.id))}
                        value={addContactId === '' ? null : addContactId}
                        onChange={v => setAddContactId(v == null ? '' : Number(v))}
                        placeholder="Add contact…"
                      />
                    </div>
                    <div className="w-[130px] flex-none">
                      <SearchableDropdown
                        options={CONTACT_ROLES.map(r => ({ id: r, name: r }))}
                        value={addRole || null}
                        onChange={v => setAddRole(v == null ? '' : String(v))}
                        placeholder="Role"
                      />
                    </div>
                    <button
                      onClick={addContact}
                      disabled={contactBusy || addContactId === ''}
                      title="Add contact to deal"
                      className="btn-primary p-2 rounded-lg flex-none disabled:opacity-50"
                    >
                      {contactBusy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="mt-1">
                <div className="text-[12px] font-semibold mb-2" style={{ color: 'var(--c-t2)' }}>Stage history</div>
                <div className="rounded-xl border px-4 py-3" style={{ borderColor: 'var(--c-border)' }}>
                  {detail.timeline.map((t, i) => (
                    <div key={i} className="flex gap-2.5">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full mt-1.5 flex-none" style={{
                          background: t.to_stage_type === 'won' ? '#16a34a' : t.to_stage_type === 'lost' ? 'var(--c-primary)' : t.from_stage ? 'var(--c-primary)' : 'var(--c-t5)',
                        }} />
                        {i < detail.timeline.length - 1 && <div className="w-[2px] flex-1" style={{ background: 'var(--c-border)' }} />}
                      </div>
                      <div className="pb-3.5">
                        <div className="text-[12px]" style={{ color: 'var(--c-t2)' }}>
                          {t.from_stage ? <>Moved <b>{t.from_stage}</b> → <b>{t.to_stage}</b></> : <>Created in <b>{t.to_stage}</b></>}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
                          {timeAgo(t.changed_at)}{t.changed_by_name ? ` · ${t.changed_by_name}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  {detail.timeline.length === 0 && <div className="text-[12px]" style={{ color: 'var(--c-t4)' }}>No history</div>}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-2 px-5 py-4 border-t flex-none" style={{ borderColor: 'var(--c-border)' }}>
              {confirmDelete ? (
                <>
                  <span className="text-[12px] flex-1" style={{ color: 'var(--c-primary)' }}>Delete this deal?</span>
                  <button onClick={() => setConfirmDelete(false)} className="text-[13px] rounded-lg px-3.5 py-2 border"
                    style={{ background: 'var(--c-panel)', color: 'var(--c-t2)', borderColor: 'var(--c-border-strong)' }}>
                    Cancel
                  </button>
                  <button onClick={remove} disabled={saving}
                    className="btn-primary text-[13px] font-medium rounded-lg px-3.5 py-2 flex items-center gap-1.5 disabled:opacity-60">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />} Delete
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setConfirmDelete(true)} className="p-2 rounded-lg border" title="Delete deal"
                    style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border-strong)', color: 'var(--c-primary)' }}>
                    <Trash2 size={14} />
                  </button>
                  <div className="flex-1" />
                  <button onClick={onClose} className="text-[13px] rounded-lg px-4 py-2 border"
                    style={{ background: 'var(--c-panel)', color: 'var(--c-t2)', borderColor: 'var(--c-border-strong)' }}>
                    Cancel
                  </button>
                  <button onClick={save} disabled={saving}
                    className="btn-primary text-[13px] font-medium rounded-lg px-4 py-2 flex items-center gap-2 disabled:opacity-60">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Save
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
