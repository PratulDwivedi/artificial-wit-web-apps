'use client'
import { Globe, TestTube2, BookOpen, History, Settings, Zap, Sun, Moon, LogOut } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'
import Image from 'next/image'
import clsx from 'clsx'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

type NavItem = { icon: React.ReactNode; label: string; id: string }

const items: NavItem[] = [
  { icon: <Globe size={18} />, label: 'APIs', id: 'apis' },
  { icon: <TestTube2 size={18} />, label: 'Tests', id: 'tests' },
  { icon: <BookOpen size={18} />, label: 'Docs', id: 'docs' },
  { icon: <History size={18} />, label: 'History', id: 'history' },
  { icon: <Zap size={18} />, label: 'MCP', id: 'mcp' },
]

export function IconNav() {
  const [active, setActive] = useState('apis')
  const [showUser, setShowUser] = useState(false)
  const { theme, toggle } = useTheme()
  const { userEmail } = useAppStore()
  const router = useRouter()

  const initials = userEmail
    ? userEmail.split('@')[0].slice(0, 2).toUpperCase()
    : 'AW'

  const signOut = () => {
    HttpHelper.clearToken()
    router.push('/login')
  }

  return (
    <nav
      className="flex flex-col items-center w-[62px] min-w-[62px] border-r py-2 h-full relative"
      style={{ background: 'var(--c-rail)', borderColor: 'var(--c-border)' }}
    >
      {/* Logo */}
      <div className="w-10 h-10 rounded-xl overflow-hidden mb-3 shrink-0 shadow-sm">
        <Image src="/logo.png" alt="AW API Doc" width={40} height={40} className="w-full h-full object-cover" priority />
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col items-center gap-0.5 w-full px-1.5">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => setActive(item.id)}
            title={item.label}
            className={clsx('w-full flex flex-col items-center gap-1 py-2.5 rounded-lg transition-colors',
              active === item.id ? 'text-blue-500' : 'hover:text-[var(--c-t2)]'
            )}
            style={{
              color: active === item.id ? undefined : 'var(--c-t4)',
              background: active === item.id ? 'var(--c-active)' : undefined,
            }}
          >
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom section */}
      <div className="flex flex-col items-center gap-0.5 w-full px-1.5 pb-1">
        {/* Theme toggle */}
        <button onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          className="w-full flex flex-col items-center gap-1 py-2.5 rounded-lg transition-colors hover:bg-[var(--c-hover)]"
          style={{ color: 'var(--c-t4)' }}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          <span className="text-[10px] font-medium">{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>

        <button title="Settings"
          className="w-full flex flex-col items-center gap-1 py-2.5 rounded-lg transition-colors hover:bg-[var(--c-hover)]"
          style={{ color: 'var(--c-t4)' }}>
          <Settings size={18} />
          <span className="text-[10px] font-medium">Settings</span>
        </button>

        {/* User avatar + sign out popover */}
        <div className="relative mt-1">
          <button
            onClick={() => setShowUser(!showUser)}
            title={userEmail ?? 'User'}
            className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm hover:ring-2 hover:ring-blue-400/50 transition-all"
          >
            <span className="text-white text-[10px] font-bold">{initials}</span>
          </button>

          {showUser && (
            <div
              className="absolute bottom-full left-full ml-2 mb-1 w-[200px] rounded-lg border shadow-xl overflow-hidden z-50"
              style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
            >
              <div className="px-3 py-2.5 border-b" style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
                <p className="text-[10px] font-medium truncate" style={{ color: 'var(--c-t1)' }}>{userEmail}</p>
                <p className="text-[9px] mt-0.5" style={{ color: 'var(--c-t5)' }}>Signed in</p>
              </div>
              <button
                onClick={signOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[11px] transition-colors hover:bg-red-500/10 text-red-500"
              >
                <LogOut size={12} />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
