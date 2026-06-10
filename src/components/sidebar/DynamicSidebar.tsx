'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import clsx from 'clsx'
import {
  ChevronRight, ChevronDown, Folder, FolderOpen, FileText,
  Sun, Moon, User, Settings, LogOut, Loader2, X, Link, Search,
} from 'lucide-react'
import { resolveIcon } from '@/lib/icons'
import { useTheme, PRIMARY_COLORS } from '@/lib/theme'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import { ProfilePage } from '@/components/profile/ProfilePage'
import { TenantPage } from '@/components/profile/TenantPage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { PageSearchModal } from './PageSearchModal'

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

// ── TenantLogo ─────────────────────────────────────────────────────────────────

function logoSrc(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('http')) return url
  return `/api/profile-pics/download?filename=${encodeURIComponent(url)}`
}

function TenantLogo() {
  const { tenantLogoUrl } = useAppStore()
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} title="Company settings"
        className="w-8 h-8 rounded-xl overflow-hidden shrink-0 shadow-sm transition-opacity hover:opacity-75 flex items-center justify-center"
        style={{ background: 'var(--c-hover)' }}>
        {tenantLogoUrl
          ? <img src={logoSrc(tenantLogoUrl) ?? ''} alt="Company" className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
          : <Image src="/logo.png" alt="AW" width={32} height={32} className="w-full h-full object-cover" priority />}
      </button>
      {open && <TenantModal onClose={() => setOpen(false)} />}
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

function TenantModal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <TenantPage onClose={onClose} />
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
  const { profilePic, fullName, userName, userEmail } = useAppStore()

  const displayName = fullName || userName || 'User'
  const initials    = displayName.trim().split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()

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

      <button onClick={() => setOpen(!open)} title={userEmail ?? displayName}
        className="flex items-center gap-2.5 w-full px-2 py-2 rounded-lg transition hover:bg-[var(--c-hover)]">
        <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0"
          style={{ background: 'var(--c-primary)', outline: '2px solid var(--c-border)' }}>
          {profilePic
            ? <img src={`/api/profile-pics/download?filename=${encodeURIComponent(profilePic)}`} alt={initials} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
            : <span className="text-white text-[11px] font-bold">{initials}</span>}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'var(--c-t1)' }}>
            {displayName}
          </p>
          {userEmail && (
            <p className="text-[10px] truncate leading-tight" style={{ color: 'var(--c-t4)' }}>{userEmail}</p>
          )}
        </div>
        <ChevronDown size={11} style={{ color: 'var(--c-t5)' }} />
      </button>

      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-1 rounded-xl border shadow-2xl overflow-hidden z-50"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

          {/* User info header */}
{/*           
          <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0"
              style={{ background: 'var(--c-primary)' }}>
              {profilePic
                ? <img src={`/api/profile-pics/download?filename=${encodeURIComponent(profilePic)}`} alt={initials} className="w-full h-full object-cover" /> // eslint-disable-line @next/next/no-img-element
                : <span className="text-white text-[13px] font-bold">{initials}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--c-t1)' }}>{displayName}</p>
              {userEmail && (
                <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>{userEmail}</p>
              )}
            </div>
          </div> */}

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
  const activeRoute = pathname.slice(1)

  const [pages,      setPages]      = useState<PageItem[]>([])
  const [loading,    setLoading]    = useState(true)
  const [showSearch, setShowSearch] = useState(false)

  const { sidebarOpen, setSidebarOpen } = useAppStore()

  useEffect(() => {
    HttpHelper.rpc<{ is_success: boolean; data: PageItem[] }>('fn_get_user_pages', { p_platform_id: 21 })
      .then(({ data }) => {
        const env = data as unknown as { is_success: boolean; data: PageItem[] }
        if (env?.is_success) setPages(env.data ?? [])
      })
      .finally(() => setLoading(false))
  }, [])

  const quickLinks = collectQuickLinks(pages)

  const navigate = (route: string) => {
    router.push(`/${route}`)
    setSidebarOpen(false) // auto-close drawer on mobile after navigation
  }

  return (
    <>
      {showSearch && <PageSearchModal pages={pages} onClose={() => setShowSearch(false)} />}

      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={clsx(
          'flex flex-col w-[240px] min-w-[240px] h-full border-r',
          // Mobile: fixed overlay, slide in/out
          'fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out',
          // Desktop: back to normal document flow
          'lg:static lg:z-auto lg:translate-x-0 lg:transition-none',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        style={{ background: 'var(--c-rail)', borderColor: 'var(--c-border)' }}
      >
      {/* Header: logo + app name + mobile close */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b shrink-0"
        style={{ borderColor: 'var(--c-border)' }}>
        <TenantLogo />
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold truncate leading-tight" style={{ color: 'var(--c-t1)' }}>
            Artificial Wit
          </p>
          <p className="text-[10px] truncate" style={{ color: 'var(--c-t5)' }}>AI Assistant</p>
        </div>
        {/* Close button — only visible on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded-lg transition hover:bg-[var(--c-hover)] shrink-0"
          style={{ color: 'var(--c-t4)' }}
        >
          <X size={15} />
        </button>
      </div>

      {/* Search trigger */}
      <div className="px-2 py-1.5 shrink-0 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-left"
          style={{ background: 'var(--c-hover)', color: 'var(--c-t4)' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-active)'; e.currentTarget.style.color = 'var(--c-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'var(--c-hover)';  e.currentTarget.style.color = 'var(--c-t4)' }}
        >
          <Search size={12} className="shrink-0" />
          <span className="text-[11px] flex-1">Search…</span>
          <kbd className="text-[9px] px-1.5 py-0.5 rounded border"
            style={{ borderColor: 'var(--c-border-strong)', background: 'var(--c-panel)', color: 'var(--c-t5)' }}>
            /
          </kbd>
        </button>
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
    </>
  )
}
