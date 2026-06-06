'use client'

import { useState, useRef, useEffect } from 'react'
import { HttpHelper } from '@/lib/http'
import { getInitials } from '@/lib/profile-utils'

interface Props {
  fullName:        string | null
  email:           string
  collapsed?:      boolean
  onOpenSettings?: () => void
}

export default function UserFooter({ fullName, email, collapsed = false, onOpenSettings }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const initials    = getInitials(fullName, email)
  const displayName = fullName || email

  function handleSignOut() {
    HttpHelper.clearToken()
    window.location.href = '/login'
  }

  useEffect(() => {
    if (!menuOpen) return
    function onOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutsideClick)
    return () => document.removeEventListener('mousedown', onOutsideClick)
  }, [menuOpen])

  return (
    <div className="sidebar-foot">
      <div className="user-card" title={collapsed ? displayName : email}>
        <div className="user-avatar">{initials}</div>

        {!collapsed && (
          <>
            <div className="user-info">
              <div className="user-name">{displayName}</div>
              <div className="user-email">{email}</div>
            </div>

            <div className="user-menu-wrap" ref={menuRef}>
              <button
                className="user-menu-btn"
                onClick={() => setMenuOpen(o => !o)}
                title="More options"
              >
                ⋮
              </button>

              {menuOpen && (
                <div className="user-menu-popup">
                  <button
                    className="user-menu-item"
                    onClick={() => { onOpenSettings?.(); setMenuOpen(false) }}
                  >
                    <span>⚙️</span>
                    Settings
                  </button>
                  <button className="user-menu-item" onClick={handleSignOut}>
                    <span>⎋</span>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
