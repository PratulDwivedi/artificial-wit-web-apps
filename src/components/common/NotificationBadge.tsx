'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import {
  Bell, ChevronRight,
  User, Users, Ticket, ShoppingCart,
  Package, Star, Mail, FileText, Settings,
  AlertCircle, type LucideIcon,
} from 'lucide-react'
import { HttpHelper } from '@/lib/http'

interface NotificationItem {
  url:       string
  title:     string
  item_icon: string
  sub_title: string
}

interface NotifResponse {
  data:      NotificationItem[]
  paging:    { total_records: number }
  is_success: boolean
}

// ── Icon map ──────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  lucid_icon_person:   User,
  lucid_icon_users:    Users,
  lucid_icon_ticket:   Ticket,
  lucid_icon_cart:     ShoppingCart,
  lucid_icon_package:  Package,
  lucid_icon_star:     Star,
  lucid_icon_mail:     Mail,
  lucid_icon_file:     FileText,
  lucid_icon_settings: Settings,
}

function NotifItemIcon({ name }: { name: string }) {
  const Icon = ICON_MAP[name] ?? AlertCircle
  return <Icon size={14} style={{ color: 'var(--c-primary)' }} />
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationBadge() {
  const router = useRouter()
  const [items,   setItems]   = useState<NotificationItem[]>([])
  const [count,   setCount]   = useState(0)
  const [open,    setOpen]    = useState(false)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })

  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef   = useRef<HTMLDivElement>(null)

  useEffect(() => {
    HttpHelper.rpc('fn_get_notifications', {})
      .then(({ data }) => {
        const env = data as unknown as NotifResponse
        if (env?.is_success) {
          setItems(env.data ?? [])
          setCount(env.paging?.total_records ?? env.data?.length ?? 0)
        }
      })
  }, [])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!triggerRef.current?.contains(t) && !panelRef.current?.contains(t)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleToggle = () => {
    if (!open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setDropPos({ top: r.bottom + 6, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  const handleNavigate = (url: string) => {
    setOpen(false)
    router.push(url)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        title="Notifications"
        className="relative p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]"
        style={{ color: 'var(--c-t3)' }}
      >
        <Bell size={17} />
        {count > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[9px] font-bold px-1 leading-none"
            style={{ background: 'var(--c-primary)', color: '#fff' }}
          >
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="rounded-2xl border shadow-2xl overflow-hidden"
          style={{
            position: 'fixed',
            top:      dropPos.top,
            right:    dropPos.right,
            width:    300,
            zIndex:   9999,
            background:  'var(--c-panel)',
            borderColor: 'var(--c-border)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
            <div className="flex items-center gap-2">
              <Bell size={13} style={{ color: 'var(--c-primary)' }} />
              <span className="text-[13px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                Notifications
              </span>
            </div>
            {count > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'var(--c-active)', color: 'var(--c-primary)' }}>
                {count}
              </span>
            )}
          </div>

          {/* List */}
          <div className="overflow-y-auto" style={{ maxHeight: 360 }}>
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={24} className="mx-auto mb-2 opacity-25" style={{ color: 'var(--c-t4)' }} />
                <p className="text-[12px]" style={{ color: 'var(--c-t5)' }}>No notifications</p>
              </div>
            ) : items.map((item, i) => (
              <button key={i} type="button"
                onClick={() => handleNavigate(item.url)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition border-b last:border-0"
                style={{ borderColor: 'var(--c-border)' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-hover)' }}
                onMouseLeave={e => { e.currentTarget.style.background = '' }}
              >
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--c-active)' }}>
                  <NotifItemIcon name={item.item_icon} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate" style={{ color: 'var(--c-t1)' }}>
                    {item.title}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>
                    {item.sub_title}
                  </p>
                </div>
                <ChevronRight size={12} style={{ color: 'var(--c-t5)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
