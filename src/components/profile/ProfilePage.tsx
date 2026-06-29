'use client'

import { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback } from 'react'
import {
  User, Lock, Loader2,
  RefreshCw, Upload, Save, ChevronDown, Search,
} from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { useAppStore } from '@/lib/store'
import { ModalShell } from '@/components/common/ModalShell'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfileData {
  user_name:  string
  full_name?: string | null
  email:      string
  data: {
    mobile_no?:       number | string | null
    language?:        string | null
    currency?:        string | null
    currency_symbol?: string | null
    datetime_format?: string | null
    time_zone?:       string | null
    profile_pic?:     string | null
  }
}

interface LookupItem { id: number; code: string; name: string; data?: { symbol?: string } | null }
interface TimeZoneItem { name: string; abbrev: string; utc_offset: string; is_dst: boolean }

function fmtUtcOffset(utc_offset: string): string {
  const neg = utc_offset.startsWith('-')
  const abs = neg ? utc_offset.slice(1) : utc_offset
  const [hh = '00', mm = '00'] = abs.split(':')
  return `UTC${neg ? '-' : '+'}${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`
}

type Tab = 'profile' | 'password'

export interface TabRef { save: () => Promise<void> }

const TABS: { id: Tab; label: string }[] = [
  { id: 'profile',  label: 'Profile'        },
  { id: 'password', label: 'Change Password' },
]

// ── Shared input style ─────────────────────────────────────────────────────────

const inputCls   = 'w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition'
const inputStyle = { background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }

// ── Searchable select ──────────────────────────────────────────────────────────

interface SearchSelectOption { value: string; label: string }

function SearchSelect({
  value, onChange, options, placeholder = '— Select —',
}: {
  value: string; onChange: (v: string) => void; options: SearchSelectOption[]; placeholder?: string
}) {
  const [open,  setOpen]  = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find(o => o.value === value)
  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  useEffect(() => { if (!open) setQuery('') }, [open])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className={`${inputCls} flex items-center justify-between gap-2 text-left`}
        style={inputStyle}>
        <span className="truncate" style={{ color: selected ? 'var(--c-t1)' : 'var(--c-t5)' }}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={13} className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          style={{ color: 'var(--c-t4)' }} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border shadow-xl overflow-hidden"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <Search size={13} style={{ color: 'var(--c-t4)', flexShrink: 0 }} />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Search…" className="flex-1 text-[12px] bg-transparent outline-none"
              style={{ color: 'var(--c-t1)' }} />
          </div>
          <div className="max-h-52 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[12px]" style={{ color: 'var(--c-t5)' }}>No results</p>
            ) : filtered.map(opt => (
              <button key={opt.value} type="button"
                onClick={() => { onChange(opt.value); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-[13px] transition"
                style={{
                  background: opt.value === value ? 'var(--c-primary-light)' : 'transparent',
                  color:      opt.value === value ? 'var(--c-primary)' : 'var(--c-t2)',
                  fontWeight: opt.value === value ? 600 : undefined,
                }}
                onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'var(--c-hover)' }}
                onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent' }}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Alert ─────────────────────────────────────────────────────────────────────

function Alert({ msg, ok }: { msg: string; ok?: boolean }) {
  return (
    <div className="text-[12px] rounded-lg px-4 py-3 border"
      style={ok
        ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a',  borderColor: 'rgba(22,163,74,0.3)'  }
        : { background: 'rgba(220,38,38,0.08)', color: '#ef4444',  borderColor: 'rgba(220,38,38,0.2)'  }}>
      {msg}
    </div>
  )
}

// ── Tab: Profile ───────────────────────────────────────────────────────────────

const ProfileTabComponent = forwardRef<TabRef, { profile: ProfileData; inModal?: boolean }>(
  ({ profile, inModal }, ref) => {
    const { setProfilePic: setStorePic } = useAppStore()

    const [fullName,       setFullName]       = useState(profile.full_name ?? '')
    const [userName,       setUserName]       = useState(profile.user_name ?? '')
    const [email,          setEmail]          = useState(profile.email ?? '')
    const [mobileNo,       setMobileNo]       = useState(String(profile.data?.mobile_no ?? ''))
    const [language,       setLanguage]       = useState(profile.data?.language ?? 'EN')
    const [currency,       setCurrency]       = useState(profile.data?.currency ?? 'USD')
    const [currencySymbol, setCurrencySymbol] = useState(profile.data?.currency_symbol ?? '')
    const [datetimeFormat, setDatetimeFormat] = useState(profile.data?.datetime_format ?? '')
    const [timeZone,       setTimeZone]       = useState(profile.data?.time_zone ?? '')
    const [profilePic,     setProfilePic]     = useState<string | null>(profile.data?.profile_pic ?? null)
    const [uploading,      setUploading]      = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [languages,  setLanguages]  = useState<LookupItem[]>([])
    const [currencies, setCurrencies] = useState<LookupItem[]>([])
    const [dtFormats,  setDtFormats]  = useState<LookupItem[]>([])
    const [timeZones,  setTimeZones]  = useState<TimeZoneItem[]>([])
    const [saving,     setSaving]     = useState(false)
    const [msg,        setMsg]        = useState<{ text: string; ok: boolean } | null>(null)

    useEffect(() => {
      Promise.all([
        HttpHelper.rpc<LookupItem[]>('fn_get_languages').then(({ data }) => {
          if (data?.is_success) setLanguages(data.data ?? [])
        }),
        HttpHelper.rpc<LookupItem[]>('fn_get_currencies').then(({ data }) => {
          if (data?.is_success) setCurrencies(data.data ?? [])
        }),
        HttpHelper.rpc<LookupItem[]>('fn_get_datetime_formats').then(({ data }) => {
          if (data?.is_success) setDtFormats(data.data ?? [])
        }),
        HttpHelper.rpc<TimeZoneItem[]>('fn_get_time_zones').then(({ data }) => {
          if (data?.is_success) setTimeZones(data.data ?? [])
        }),
      ])
    }, [])

    const handleCurrencyChange = (code: string) => {
      setCurrency(code)
      const found = currencies.find(c => c.code === code)
      if (found?.data?.symbol) setCurrencySymbol(found.data.symbol)
    }

    const handleSave = useCallback(async () => {
      setSaving(true); setMsg(null)
      try {
        const { data, error } = await HttpHelper.rpc('fn_save_user_profile', {
          p_full_name: fullName  || null,
          p_user_name: userName  || null,
          p_email:     email     || null,
          p_data: {
            mobile_no:       mobileNo ? Number(mobileNo) : null,
            datetime_format: datetimeFormat || null,
            language:        language || null,
            currency:        currency || null,
            currency_symbol: currencySymbol || null,
            time_zone:       timeZone || null,
            profile_pic:     profilePic,
          },
        })
        if (error) throw error
        const env = data as { is_success: boolean; message: string }
        setMsg({ text: env?.message ?? 'Saved', ok: env?.is_success ?? true })
      } catch (e: unknown) {
        setMsg({ text: e instanceof Error ? e.message : 'Failed to save', ok: false })
      } finally {
        setSaving(false)
      }
    }, [fullName, userName, email, mobileNo, datetimeFormat, language, currency, currencySymbol, timeZone, profilePic])

    useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave])

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      setUploading(true); setMsg(null)
      try {
        const form = new FormData()
        form.append('file', file)
        const res  = await fetch('/api/profile-pics/upload', { method: 'POST', body: form })
        const json = await res.json() as { success: boolean; url?: string; error?: string; detail?: string }
        if (!json.success) throw new Error([json.error, json.detail].filter(Boolean).join(' — '))
        const url = json.url ?? null
        setProfilePic(url)
        setStorePic(url)
        await HttpHelper.rpc('fn_save_user_profile', { p_data: { profile_pic: url } })
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : 'Upload failed', ok: false })
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }

    const initials = (profile.user_name ?? profile.email ?? '?')
      .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

    return (
      <div className="flex flex-col gap-5">
        {/* Avatar row */}
        <div className="flex items-center gap-4">
          {profilePic ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/profile-pics/download?filename=${encodeURIComponent(profilePic)}`}
              alt="Profile" className="w-16 h-16 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[22px] font-bold"
              style={{ background: 'var(--c-primary)' }}>
              {initials}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[16px] font-semibold" style={{ color: 'var(--c-t1)' }}>{profile.user_name}</p>
            <p className="text-[13px]" style={{ color: 'var(--c-t4)' }}>{profile.email}</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border text-[12px] font-medium transition disabled:opacity-60"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
            onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = 'var(--c-active)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
        </div>

        <div className="h-px" style={{ background: 'var(--c-border)' }} />

        {/* Fields */}
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Full name</label>
              <input value={fullName ?? ''} onChange={e => setFullName(e.target.value)}
                placeholder="e.g. John Smith" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Username</label>
              <input value={userName ?? ''} onChange={e => setUserName(e.target.value)}
                placeholder="e.g. jsmith" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Email</label>
              <input type="email" value={email ?? ''} onChange={e => setEmail(e.target.value)}
                placeholder="e.g. john@example.com" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Mobile number</label>
              <input value={mobileNo} onChange={e => setMobileNo(e.target.value)}
                placeholder="e.g. 9999999999" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Date &amp; time format</label>
              <SearchSelect value={datetimeFormat} onChange={setDatetimeFormat}
                options={dtFormats.map(f => ({ value: f.code, label: f.name }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Language</label>
              <SearchSelect value={language} onChange={setLanguage}
                options={languages.map(l => ({ value: l.code, label: l.name }))} />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Time zone</label>
            <SearchSelect value={timeZone} onChange={setTimeZone}
              options={timeZones.map(tz => ({ value: tz.name, label: `(${fmtUtcOffset(tz.utc_offset)}) ${tz.name} — ${tz.abbrev}` }))} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Currency</label>
              <SearchSelect value={currency} onChange={handleCurrencyChange}
                options={currencies.map(c => ({ value: c.code, label: `${c.code} (${c.data?.symbol ?? ''}) — ${c.name}` }))} />
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
                style={{ color: 'var(--c-t4)' }}>Currency symbol</label>
              <input value={currencySymbol} onChange={e => setCurrencySymbol(e.target.value)}
                placeholder="e.g. ₹" className={inputCls} style={inputStyle} />
            </div>
          </div>
        </div>

        {msg && <Alert msg={msg.text} ok={msg.ok} />}

        {!inModal && (
          <div className="flex justify-end">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 btn-primary rounded-xl text-[13px] font-semibold transition disabled:opacity-60">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save changes
            </button>
          </div>
        )}
      </div>
    )
  }
)
ProfileTabComponent.displayName = 'ProfileTab'

// ── Tab: Change Password ───────────────────────────────────────────────────────

const PasswordTabComponent = forwardRef<TabRef, { inModal?: boolean }>(
  ({ inModal }, ref) => {
    const [newPwd,   setNewPwd]   = useState('')
    const [confirm,  setConfirm]  = useState('')
    const [saving,   setSaving]   = useState(false)
    const [msg,      setMsg]      = useState<{ text: string; ok: boolean } | null>(null)

    const handleSave = useCallback(async () => {
      if (newPwd.length < 8) { setMsg({ text: 'Password must be at least 8 characters.', ok: false }); return }
      if (newPwd !== confirm)  { setMsg({ text: 'Passwords do not match.', ok: false }); return }
      setSaving(true); setMsg(null)
      try {
        setMsg({ text: 'Password change is not yet available.', ok: false })
      } finally {
        setSaving(false)
      }
    }, [newPwd, confirm])

    useImperativeHandle(ref, () => ({ save: handleSave }), [handleSave])

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 mb-1">
          <Lock size={16} style={{ color: 'var(--c-t3)' }} />
          <div>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>Change password</p>
            <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>
              Use at least 8 characters. You&apos;ll stay signed in after changing it.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>New password</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)}
              placeholder="••••••••" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Confirm password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              placeholder="••••••••" className={inputCls} style={inputStyle} />
          </div>
        </div>

        {msg && <Alert msg={msg.text} ok={msg.ok} />}

        {!inModal && (
          <div>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border text-[13px] font-medium transition disabled:opacity-60"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              Update password
            </button>
          </div>
        )}
      </div>
    )
  }
)
PasswordTabComponent.displayName = 'PasswordTab'

// ── Main page ──────────────────────────────────────────────────────────────────

export function ProfilePage({ onClose }: { onClose?: () => void }) {
  const [tab,          setTab]          = useState<Tab>('profile')
  const [profile,      setProfile]      = useState<ProfileData | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [footerSaving, setFooterSaving] = useState(false)
  const profileTabRef  = useRef<TabRef>(null)
  const passwordTabRef = useRef<TabRef>(null)

  useEffect(() => {
    HttpHelper.rpc('fn_get_profile').then(({ data }) => {
      const env = data as { is_success: boolean; data: ProfileData[] }
      if (env?.is_success && env.data?.length > 0) setProfile(env.data[0])
      setLoading(false)
    })
  }, [])

  const handleFooterSave = async () => {
    setFooterSaving(true)
    try {
      if (tab === 'profile')  await profileTabRef.current?.save()
      if (tab === 'password') await passwordTabRef.current?.save()
    } finally {
      setFooterSaving(false)
    }
  }

  const isModal  = !!onClose
  const showSave = isModal && (tab === 'profile' || tab === 'password')
  const saveLabel = tab === 'password' ? 'Update password' : 'Save changes'

  const tabContent = loading ? (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={22} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
    </div>
  ) : (
    <>
      {tab === 'profile'  && profile && <ProfileTabComponent  ref={profileTabRef}  profile={profile} inModal={isModal} />}
      {tab === 'password' && <PasswordTabComponent ref={passwordTabRef} inModal={isModal} />}
    </>
  )

  // ── Page layout ──────────────────────────────────────────────────────────────
  if (!isModal) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-y-auto" style={{ background: 'var(--c-base)' }}>
        <div className="max-w-3xl w-full mx-auto px-6 py-8">
          <div className="flex items-center gap-4 mb-7">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--c-primary-light)' }}>
              <User size={22} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold" style={{ color: 'var(--c-t1)' }}>Profile</h1>
              <p className="text-[13px]" style={{ color: 'var(--c-t4)' }}>
                Manage your personal preferences and contact details.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 mb-6 border-b pb-0" style={{ borderColor: 'var(--c-border)' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className="px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition border-b-2 -mb-px"
                style={{
                  color:       tab === t.id ? 'var(--c-t1)' : 'var(--c-t4)',
                  borderColor: tab === t.id ? 'var(--c-primary)' : 'transparent',
                  fontWeight:  tab === t.id ? 600 : undefined,
                }}>
                {t.label}
              </button>
            ))}
          </div>
          {tabContent}
        </div>
      </div>
    )
  }

  // ── Modal layout ─────────────────────────────────────────────────────────────
  const tabBar = (
    <>
      {TABS.map(t => {
        const isActive = tab === t.id
        return (
          <button key={t.id} onClick={() => setTab(t.id)}
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
    </>
  )

  return (
    <ModalShell
      icon={<User size={16} style={{ color: 'var(--c-primary)' }} />}
      title="Profile"
      subtitle="Manage your personal preferences and contact details."
      onClose={onClose}
      tabs={tabBar}
      onSave={showSave ? handleFooterSave : undefined}
      saveLabel={saveLabel}
      saving={footerSaving}
    >
      {tabContent}
    </ModalShell>
  )
}
