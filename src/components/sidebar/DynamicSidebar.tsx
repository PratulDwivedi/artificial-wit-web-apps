'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText,
  Sun, Moon, User, Settings, LogOut, Building2, Upload, Loader2, X, Save, Link,
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { useTheme, PRIMARY_COLORS } from '@/lib/theme'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import { ProfilePage } from '@/components/profile/ProfilePage'
import { SettingsPage } from '@/components/settings/SettingsPage'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PageItem {
  id: number
  name: string
  descr: string | null
  children: PageItem[]
  item_icon: string | null
  item_color: string | null
  route_name: string
  display_order: number
  parent_page_id: number
  display_location_id: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function resolveIcon(name: string | null, fallback: React.ElementType): React.ElementType {
  if (!name) return fallback
  const Icon = (LucideIcons as Record<string, unknown>)[name]
  return typeof Icon === 'function' ? (Icon as React.ElementType) : fallback
}

function collectQuickLinks(items: PageItem[]): PageItem[] {
  const links: PageItem[] = []
  function walk(nodes: PageItem[]) {
    for (const node of nodes) {
      if (node.display_location_id === 18) links.push(node)
      if (node.children?.length) walk(node.children)
    }
  }
  walk(items)
  return links
}

// ── TreeNode ───────────────────────────────────────────────────────────────────

function TreeNode({
  item, depth, activeRoute, onNavigate,
}: {
  item: PageItem
  depth: number
  activeRoute: string
  onNavigate: (route: string) => void
}) {
  const hasChildren = item.children && item.children.length > 0
  const [open, setOpen] = useState(false)
  const isActive = !hasChildren && activeRoute === item.route_name
  const pl = 8 + depth * 14

  if (hasChildren) {
    const FolderIcon = resolveIcon(item.item_icon, open ? FolderOpen : Folder)
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-1.5 py-1.5 rounded-lg transition-colors text-left hover:bg-[var(--c-hover)]"
          style={{ paddingLeft: pl, paddingRight: 8, color: 'var(--c-t2)' }}
        >
          {open
            ? <ChevronDown  size={11} className="shrink-0" style={{ color: 'var(--c-t5)' }} />
            : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--c-t5)' }} />
          }
          <FolderIcon
            size={13}
            className="shrink-0"
            style={{ color: item.item_color ?? 'var(--c-t4)' }}
          />
          <span className="text-[11px] font-medium truncate leading-tight">{item.name}</span>
        </button>

        {open && (
          <div>
            {[...item.children]
              .sort((a, b) => a.display_order - b.display_order)
              .map(child => (
                <TreeNode
                  key={child.id}
                  item={child}
                  depth={depth + 1}
                  activeRoute={activeRoute}
                  onNavigate={onNavigate}
                />
              ))}
          </div>
        )}
      </div>
    )
  }

  const LeafIcon = resolveIcon(item.item_icon, FileText)
  return (
    <button
      onClick={() => onNavigate(item.route_name)}
      className="w-full flex items-center gap-1.5 py-1.5 rounded-lg transition-colors text-left"
      style={{
        paddingLeft: pl,
        paddingRight: 8,
        background: isActive ? 'var(--c-active)' : undefined,
        color: isActive ? 'var(--c-primary)' : 'var(--c-t3)',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--c-hover)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
    >
      <LeafIcon
        size={13}
        className="shrink-0"
        style={{ color: item.item_color ?? (isActive ? 'var(--c-primary)' : 'var(--c-t4)') }}
      />
      <span className={clsx('text-[11px] truncate leading-tight', isActive && 'font-semibold')}>
        {item.name}
      </span>
    </button>
  )
}

// ── QuickLinkItem ──────────────────────────────────────────────────────────────

function QuickLinkItem({ item, isActive, onNavigate }: {
  item: PageItem
  isActive: boolean
  onNavigate: (route: string) => void
}) {
  const Icon = resolveIcon(item.item_icon, Link)
  return (
    <button
      onClick={() => onNavigate(item.route_name)}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors text-left"
      style={{
        background: isActive ? 'var(--c-active)' : undefined,
        color: isActive ? 'var(--c-primary)' : 'var(--c-t2)',
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--c-hover)' }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = '' }}
    >
      <Icon
        size={13}
        className="shrink-0"
        style={{ color: item.item_color ?? (isActive ? 'var(--c-primary)' : 'var(--c-t4)') }}
      />
      <span className={clsx('text-[12px] truncate', isActive && 'font-semibold')}>{item.name}</span>
    </button>
  )
}

// ── TenantEditPopup ────────────────────────────────────────────────────────────

function logoSrc(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `/api/profile-pics/download?filename=${encodeURIComponent(url)}`
}

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
      <div className="w-[340px] rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
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
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 border flex items-center justify-center"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-hover)' }}>
              {logoUrl
                ? <img src={logoSrc(logoUrl) ?? ''} alt="Logo" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <Building2 size={22} style={{ color: 'var(--c-t5)' }} />}
            </div>
            <div className="flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                style={{ color: 'var(--c-t4)' }}>Company Logo</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition disabled:opacity-60"
                style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)', background: 'var(--c-hover)' }}
                onMouseEnter={e => { if (!uploading) e.currentTarget.style.background = 'var(--c-active)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)' }}>
                {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                {uploading ? 'Uploading…' : 'Upload logo'}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block"
              style={{ color: 'var(--c-t4)' }}>Company Name</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Company name"
              className="w-full rounded-xl px-3 py-2 text-[13px] border focus:outline-none transition"
              style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
          </div>

          {msg && (
            <div className="text-[12px] rounded-lg px-3 py-2.5 border"
              style={msg.ok
                ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.3)' }
                : { background: 'rgba(220,38,38,0.08)', color: '#ef4444', borderColor: 'rgba(220,38,38,0.2)' }}>
              {msg.text}
            </div>
          )}

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

// ── TenantLogo ─────────────────────────────────────────────────────────────────

function TenantLogo() {
  const [open, setOpen] = useState(false)
  const { tenantLogoUrl } = useAppStore()

  return (
    <>
      <button onClick={() => setOpen(true)} title="Company settings"
        className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-sm transition-opacity hover:opacity-75 flex items-center justify-center"
        style={{ background: 'var(--c-hover)' }}>
        {tenantLogoUrl
          ? <img src={logoSrc(tenantLogoUrl) ?? ''} alt="Company" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
          : <Image src="/logo.png" alt="AW" width={32} height={32} className="w-full h-full object-cover" priority />}
      </button>
      {open && <TenantEditPopup onClose={() => setOpen(false)} />}
    </>
  )
}

// ── ProfileModal / SettingsModal ───────────────────────────────────────────────

function ProfileModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <ProfilePage onClose={onClose} />
    </div>,
    document.body
  )
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <SettingsPage onClose={onClose} />
    </div>,
    document.body
  )
}

// ── UserMenu ───────────────────────────────────────────────────────────────────

function UserMenu() {
  const [open, setOpen]                 = useState(false)
  const [showProfile,  setShowProfile]  = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const { theme, primary, toggle: toggleTheme, setPrimary } = useTheme()
  const { profilePic, userName, userEmail } = useAppStore()

  // Initials from actual user_name ("Demo User" → "DU")
  const initials = userName
    ? userName.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'AW'

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Profile is loaded centrally by AppBootstrap; store values are read here.

  const signOut = () => { HttpHelper.clearToken(); router.push('/login') }

  return (
    <div ref={ref} className="relative px-2 pb-1">
      {showProfile  && <ProfileModal  onClose={() => setShowProfile(false)}  />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      <button onClick={() => setOpen(!open)} title={userEmail ?? userName ?? 'User'}
        className="flex items-center gap-2 w-full px-1 py-1.5 rounded-lg transition hover:bg-[var(--c-hover)]">
        <div className="w-6 h-6 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: 'var(--c-primary)' }}>
          {profilePic
            ? <img src={`/api/profile-pics/download?filename=${encodeURIComponent(profilePic)}`} alt={initials} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <span className="text-white text-[9px] font-bold">{initials}</span>}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[11px] font-semibold truncate leading-tight" style={{ color: 'var(--c-t1)' }}>
            {userName ?? 'User'}
          </p>
          {userEmail && (
            <p className="text-[9px] truncate leading-tight" style={{ color: 'var(--c-t5)' }}>{userEmail}</p>
          )}
        </div>
        <ChevronDown size={11} style={{ color: 'var(--c-t5)' }} />
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl border shadow-2xl overflow-hidden z-50"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
          <div className="py-1">
            <button onClick={() => { setOpen(false); setShowProfile(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t2)' }}>
              <User size={13} style={{ color: 'var(--c-t4)' }} /> Profile
            </button>
            <button onClick={() => { setOpen(false); setShowSettings(true) }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-[12px] transition-colors hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t2)' }}>
              <Settings size={13} style={{ color: 'var(--c-t4)' }} /> Settings
            </button>

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

            <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--c-border)' }}>
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--c-t5)' }}>
                Primary Colour
              </p>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PRIMARY_COLORS.map(c => (
                  <button key={c.value} title={c.name} onClick={() => setPrimary(c.value)}
                    className="w-5 h-5 rounded-full transition-transform hover:scale-110 shrink-0"
                    style={{ background: c.value, outline: primary === c.value ? `2px solid ${c.value}` : 'none', outlineOffset: '2px' }} />
                ))}
                <label title="Custom colour"
                  className="w-5 h-5 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer shrink-0 hover:scale-110 transition-transform overflow-hidden"
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
              <LogOut size={13} /> Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── DynamicSidebar (main export) ───────────────────────────────────────────────

export function DynamicSidebar() {
  const router   = useRouter()
  const pathname = usePathname()
  const activeRoute = pathname.slice(1) // '/knowledge_base' → 'knowledge_base'

  const [pages,   setPages]   = useState<PageItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    HttpHelper.rpc<{ is_success: boolean; data: PageItem[] }>('fn_get_user_pages', { p_platform_id: 21 })
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: PageItem[] }
        if (env?.is_success) setPages(env.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const quickLinks = collectQuickLinks(pages)

  const navigate = (route: string) => router.push(`/${route}`)

  return (
    <aside
      className="flex flex-col w-[240px] min-w-[240px] h-full border-r"
      style={{ background: 'var(--c-rail)', borderColor: 'var(--c-border)' }}
    >
      {/* Header: logo + app name */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--c-border)' }}>
        <TenantLogo />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'var(--c-t1)' }}>
            Artificial Wit
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--c-t5)' }}>AI Assistant</p>
        </div>
      </div>

      {/* Nav area */}
      <div className="flex-1 overflow-y-auto py-2 px-1.5 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
          </div>
        ) : (
          <>
            {/* Quick links */}
            {quickLinks.length > 0 && (
              <div className="mb-3">
                <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--c-t5)' }}>
                  Quick Links
                </p>
                {quickLinks.map(item => (
                  <QuickLinkItem
                    key={item.id}
                    item={item}
                    isActive={activeRoute === item.route_name}
                    onNavigate={navigate}
                  />
                ))}
              </div>
            )}

            {/* Features tree */}
            {quickLinks.length > 0 && pages.length > 0 && (
              <div className="mx-2 mb-2 h-px" style={{ background: 'var(--c-border)' }} />
            )}

            {pages.length > 0 && (
              <>
                <p className="px-2 pb-1 text-[9px] font-bold uppercase tracking-widest"
                  style={{ color: 'var(--c-t5)' }}>
                  Features
                </p>
                {[...pages]
                  .sort((a, b) => a.display_order - b.display_order)
                  .map(item => (
                    <TreeNode
                      key={item.id}
                      item={item}
                      depth={0}
                      activeRoute={activeRoute}
                      onNavigate={navigate}
                    />
                  ))}
              </>
            )}
          </>
        )}
      </div>

      {/* User menu */}
      <div className="border-t shrink-0 pt-1" style={{ borderColor: 'var(--c-border)' }}>
        <UserMenu />
      </div>
    </aside>
  )
}
