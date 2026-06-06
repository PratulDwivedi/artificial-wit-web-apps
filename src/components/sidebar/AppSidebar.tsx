'use client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  MessageCircle, Library, Bot, Plug, Cpu, Globe,
  FileText, Package, Sun, Moon, User, Settings, LogOut, KeyRound, Webhook, Cable, LayoutDashboard,
  Building2, Upload, Loader2, X, Save,
} from 'lucide-react'
import { useTheme, PRIMARY_COLORS } from '@/lib/theme'
import { useAppStore, type SectionId } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import { ProfilePage } from '@/components/profile/ProfilePage'
import { SettingsPage } from '@/components/settings/SettingsPage'

// ── Helpers ───────────────────────────────────────────────────────────────────
function logoSrc(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `/api/profile-pics/download?filename=${encodeURIComponent(url)}`
}

const NAV_ITEMS: { id: SectionId; label: string; icon: React.ElementType }[] = [
  { id: 'chat',           label: 'Chat',        icon: MessageCircle   },
  { id: 'knowledge-base', label: 'Knowledge',   icon: Library         },
  { id: 'artifacts',      label: 'Artifacts',   icon: LayoutDashboard },
  { id: 'agents',         label: 'Agents',      icon: Bot             },
  { id: 'llm',            label: 'LLM',         icon: Cpu             },
  { id: 'variables',      label: 'Variables',   icon: Globe           },
  { id: 'credentials',    label: 'Credentials', icon: KeyRound        },
  { id: 'api-configs',    label: 'API / Tools', icon: Webhook         },
  { id: 'prompts',        label: 'Prompts',     icon: FileText        },
  { id: 'resources',      label: 'Resources',   icon: Package         },
  { id: 'connectors',     label: 'Connectors',  icon: Cable           },
  { id: 'tool-test',      label: 'Tool Test',   icon: Plug            },
]

const DIVIDER_BEFORE = new Set<SectionId>(['agents', 'api-configs', 'tool-test'])

// ── User avatar + dropdown ────────────────────────────────────────────────────
function UserMenu({ email }: { email: string | null }) {
  const [open, setOpen] = useState(false)
  const [showProfile,  setShowProfile]  = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { theme, primary, toggle: toggleTheme, setPrimary } = useTheme()
  const { profilePic, setProfilePic, setTenantName, setTenantLogoUrl } = useAppStore()

  const initials = email ? email.split('@')[0].slice(0, 2).toUpperCase() : 'AW'
  const name = email
    ? email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    : 'User'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Load profile pic + tenant info once on mount
  useEffect(() => {
    HttpHelper.rpc<{ data?: { profile_pic?: string | null }; tenant?: { name?: string | null; data?: { logo_url?: string | null } } }[]>('fn_get_profile').then(({ data }) => {
      const profile = data?.data?.[0]
      setProfilePic(profile?.data?.profile_pic ?? null)
      setTenantName(profile?.tenant?.name ?? null)
      setTenantLogoUrl(profile?.tenant?.data?.logo_url ?? null)
    })
  }, [])

  const signOut = () => {
    HttpHelper.clearToken()
    router.push('/login')
  }

  return (
    <div ref={ref} className="relative flex justify-center pb-1">
      {showProfile  && <ProfileModal  onClose={() => setShowProfile(false)}  />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      <button
        onClick={() => setOpen(!open)}
        title={email ?? 'User'}
        className="w-8 h-8 rounded-full overflow-hidden shadow-sm transition-all hover:opacity-90 flex items-center justify-center"
        style={{ background: 'var(--c-primary)' }}
      >
        {profilePic ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/profile-pics/download?filename=${encodeURIComponent(profilePic)}`}
            alt={initials}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-white text-[10px] font-bold">{initials}</span>
        )}
      </button>

      {open && (
        <div
          className="absolute bottom-full left-1 mb-2 w-[210px] rounded-xl border shadow-2xl overflow-hidden z-50"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
        >
          {/* User header */}
          <div className="flex items-center gap-2.5 px-3 py-3 border-b"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
            <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: 'var(--c-primary)' }}>
              {profilePic ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/profile-pics/download?filename=${encodeURIComponent(profilePic)}`}
                  alt={initials} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-[11px] font-bold">{initials}</span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>{name}</p>
              <p className="text-[10px] truncate" style={{ color: 'var(--c-t4)' }}>{email}</p>
            </div>
          </div>

          <div className="py-1">
            <button onClick={() => { setOpen(false); setShowProfile(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t2)' }}>
              <User size={13} style={{ color: 'var(--c-t4)' }} />
              Profile
            </button>
            <button onClick={() => { setOpen(false); setShowSettings(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t2)' }}>
              <Settings size={13} style={{ color: 'var(--c-t4)' }} />
              Settings
            </button>

            {/* Theme toggle */}
            <button onClick={toggleTheme}
              className="w-full flex items-center justify-between px-3 py-2 text-[12px] transition-colors hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t2)' }}>
              <div className="flex items-center gap-2.5">
                {theme === 'dark'
                  ? <Sun  size={13} style={{ color: 'var(--c-t4)' }} />
                  : <Moon size={13} style={{ color: 'var(--c-t4)' }} />}
                <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
              </div>
              <div className="w-8 h-4 rounded-full relative shrink-0 transition-colors"
                style={{ background: theme === 'dark' ? 'var(--c-primary)' : '#d1d5db' }}>
                <div className={clsx('w-3 h-3 rounded-full bg-white absolute top-0.5 shadow-sm transition-transform',
                  theme === 'dark' ? 'translate-x-4' : 'translate-x-0.5')} />
              </div>
            </button>

            {/* Primary colour picker */}
            <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--c-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-t5)' }}>
                Primary Colour
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRIMARY_COLORS.map(c => (
                  <button
                    key={c.value}
                    title={c.name}
                    onClick={() => setPrimary(c.value)}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110 shrink-0"
                    style={{
                      background: c.value,
                      outline: primary === c.value ? `2px solid ${c.value}` : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
                <label title="Custom colour" className="w-5 h-5 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer shrink-0 hover:scale-110 transition-transform overflow-hidden"
                  style={{ borderColor: 'var(--c-t5)' }}>
                  <input type="color" value={primary} onChange={e => setPrimary(e.target.value)}
                    className="w-8 h-8 opacity-0 absolute cursor-pointer" />
                  <span className="text-[8px] font-bold" style={{ color: 'var(--c-t4)' }}>+</span>
                </label>
              </div>
            </div>
          </div>

          <div className="border-t py-1" style={{ borderColor: 'var(--c-border)' }}>
            <button onClick={signOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] text-red-500 transition-colors hover:bg-red-500/10">
              <LogOut size={13} />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Profile modal ─────────────────────────────────────────────────────────────
function ProfileModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <ProfilePage onClose={onClose} />
    </div>,
    document.body
  )
}

// ── Settings modal ────────────────────────────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <SettingsPage onClose={onClose} />
    </div>,
    document.body
  )
}

// ── Tenant edit popup ─────────────────────────────────────────────────────────
function TenantEditPopup({ onClose }: { onClose: () => void }) {
  const { tenantName, tenantLogoUrl, setTenantName, setTenantLogoUrl } = useAppStore()
  const [name,      setName]      = useState(tenantName ?? '')
  const [logoUrl,   setLogoUrl]   = useState(tenantLogoUrl ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState<{ text: string; ok: boolean } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setMsg(null)
    try {
      const form = new FormData()
      form.append('file', file)
      const res  = await fetch('/api/profile-pics/upload', { method: 'POST', body: form })
      const json = await res.json() as { success: boolean; url?: string; error?: string; detail?: string }
      if (!json.success) throw new Error([json.error, json.detail].filter(Boolean).join(' — '))
      setLogoUrl(json.url ?? '')
    } catch (err) {
      setMsg({ text: err instanceof Error ? err.message : 'Upload failed', ok: false })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleSave = async () => {
    setSaving(true); setMsg(null)
    try {
      const { data, error } = await HttpHelper.rpc('fn_update_tenant', {
        p_name: name,
        p_data: { logo_url: logoUrl },
      })
      if (error) throw error
      const env = data as { is_success: boolean; message: string }
      if (!env?.is_success) throw new Error(env?.message ?? 'Update failed')
      setTenantName(name)
      setTenantLogoUrl(logoUrl)
      setMsg({ text: env.message ?? 'Saved', ok: true })
      setTimeout(onClose, 900)
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : 'Failed to save', ok: false })
    } finally {
      setSaving(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-[340px] rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
          <div className="flex items-center gap-2">
            <Building2 size={14} style={{ color: 'var(--c-t3)' }} />
            <p className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>Company Settings</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition hover:bg-[var(--c-hover)]"
            style={{ color: 'var(--c-t4)' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* Logo row */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}>
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc(logoUrl) ?? ''} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={22} style={{ color: 'var(--c-t5)' }} />
              )}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--c-t4)' }}>Company Logo</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition disabled:opacity-60"
                style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
                onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = 'var(--c-active)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
                {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                {uploading ? 'Uploading…' : 'Upload logo'}
              </button>
            </div>
          </div>

          {/* Company name */}
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Company Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Company name"
              className="w-full rounded-xl px-3 py-2 text-[13px] border focus:outline-none transition"
              style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
            />
          </div>

          {msg && (
            <div className="text-[12px] rounded-lg px-3 py-2.5 border"
              style={msg.ok
                ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.3)' }
                : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {msg.text}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button onClick={onClose}
              className="px-4 py-2 rounded-xl border text-[12px] font-medium transition"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 btn-primary rounded-xl text-[12px] font-semibold transition disabled:opacity-60">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Tenant logo button ────────────────────────────────────────────────────────
function TenantLogo() {
  const [open, setOpen] = useState(false)
  const { tenantLogoUrl } = useAppStore()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Company settings"
        className="w-9 h-9 rounded-xl overflow-hidden mb-3 shrink-0 shadow-sm transition-opacity hover:opacity-75 flex items-center justify-center"
        style={{ background: 'var(--c-hover)' }}
      >
        {tenantLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoSrc(tenantLogoUrl) ?? ''} alt="Company" className="w-full h-full object-cover" />
        ) : (
          <Image src="/logo.png" alt="AW" width={36} height={36} className="w-full h-full object-cover" priority />
        )}
      </button>
      {open && <TenantEditPopup onClose={() => setOpen(false)} />}
    </>
  )
}

// ── Main sidebar ──────────────────────────────────────────────────────────────
export function AppSidebar() {
  const { userEmail } = useAppStore()
  const router = useRouter()
  const pathname = usePathname()
  const activeSection = pathname.slice(1) // '/llm' → 'llm'

  return (
    <aside
      className="flex flex-col items-center w-[66px] min-w-[66px] h-full border-r py-2"
      style={{ background: 'var(--c-rail)', borderColor: 'var(--c-border)' }}
    >
      {/* Logo */}
      <TenantLogo />

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center gap-0.5 w-full px-1.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id

          return (
            <div key={item.id} className="w-full">
              {DIVIDER_BEFORE.has(item.id) && (
                <div className="mx-2 my-1.5 h-px" style={{ background: 'var(--c-border)' }} />
              )}

              <button
                onClick={() => router.push(`/${item.id}`)}
                title={item.label}
                className="w-full flex flex-col items-center gap-0.5 py-2 rounded-lg transition-colors"
                style={{
                  background: isActive ? 'var(--c-active)' : undefined,
                  color: isActive ? 'var(--c-t1)' : 'var(--c-t4)',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--c-hover)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
              >
                <Icon size={17} style={{ color: isActive ? 'var(--c-primary)' : undefined }} />
                <span className={clsx('text-[9px] leading-tight text-center w-full px-0.5 truncate',
                  isActive ? 'font-semibold' : '')}
                  style={isActive ? { color: 'var(--c-primary)' } : {}}>
                  {item.label}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      {/* User avatar */}
      <div className="w-full px-1.5 pt-2 border-t mt-1" style={{ borderColor: 'var(--c-border)' }}>
        <UserMenu email={userEmail} />
      </div>
    </aside>
  )
}
