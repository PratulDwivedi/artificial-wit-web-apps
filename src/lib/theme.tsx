'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

export const PRIMARY_COLORS = [
  { name: 'Red',    value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Amber',  value: '#d97706' },
  { name: 'Green',  value: '#16a34a' },
  { name: 'Blue',   value: '#2563eb' },
  { name: 'Violet', value: '#7c3aed' },
  { name: 'Pink',   value: '#db2777' },
  { name: 'Slate',  value: '#475569' },
] as const

const DEFAULT_PRIMARY = '#dc2626'

interface ThemeCtx {
  theme: Theme
  primary: string
  toggle: () => void
  setPrimary: (color: string) => void
}

const ThemeContext = createContext<ThemeCtx>({
  theme: 'dark', primary: DEFAULT_PRIMARY,
  toggle: () => {}, setPrimary: () => {},
})

function applyPrimary(color: string) {
  const root = document.documentElement
  root.style.setProperty('--c-primary', color)
  // Derive a light variant (color + 12% opacity)
  const hex = color.replace('#', '')
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  root.style.setProperty('--c-primary-light', `rgba(${r},${g},${b},0.12)`)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme]     = useState<Theme>('dark')
  const [primary, setPrimary_] = useState<string>(DEFAULT_PRIMARY)

  useEffect(() => {
    const savedTheme   = localStorage.getItem('awt-theme') as Theme | null
    const savedPrimary = localStorage.getItem('awt-primary') ?? DEFAULT_PRIMARY
    if (savedTheme === 'light') setTheme('light')
    setPrimary_(savedPrimary)
    applyPrimary(savedPrimary)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') root.classList.add('dark')
    else root.classList.remove('dark')
    localStorage.setItem('awt-theme', theme)
  }, [theme])

  const setPrimary = (color: string) => {
    setPrimary_(color)
    applyPrimary(color)
    localStorage.setItem('awt-primary', color)
  }

  return (
    <ThemeContext.Provider value={{ theme, primary, toggle: () => setTheme(t => t === 'dark' ? 'light' : 'dark'), setPrimary }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
