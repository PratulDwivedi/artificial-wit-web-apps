'use client'

import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Search, Check, Loader2, ChevronDown } from 'lucide-react'

export interface SearchableSelectOption<T extends string | number = string> {
  value: T
  label: string
}

export interface SearchableSelectProps<T extends string | number = string> {
  value: T | ''
  onChange: (v: T | '') => void
  options: SearchableSelectOption<T>[]
  placeholder?: string
  loading?: boolean
  required?: boolean
  clearable?: boolean
  className?: string
}

export default function SearchableSelect<T extends string | number = string>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  loading,
  required,
  clearable,
  className,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const selected = options.find(o => o.value === value)

  const openDropdown = () => {
    if (loading) return
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect())
    setOpen(true)
    setQuery('')
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  const close = () => { setOpen(false); setQuery('') }
  const select = (v: T | '') => { onChange(v); close() }

  return (
    <div className={`relative ${className ?? ''}`}>
      {required && (
        <input
          tabIndex={-1}
          required
          value={value === '' ? '' : String(value)}
          onChange={() => {}}
          className="absolute inset-0 opacity-0 pointer-events-none"
        />
      )}
      <button
        type="button"
        ref={triggerRef}
        onClick={openDropdown}
        className="w-full flex items-center justify-between rounded-xl px-3 py-2 text-[12px] border text-left transition"
        style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
      >
        {loading ? (
          <span className="flex items-center gap-1.5 flex-1" style={{ color: 'var(--c-t4)' }}>
            <Loader2 size={12} className="animate-spin" /> Loading…
          </span>
        ) : (
          <span className="flex-1 truncate" style={{ color: selected ? 'var(--c-t2)' : 'var(--c-t5)' }}>
            {selected?.label ?? placeholder}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {clearable && value !== '' && !loading && (
            <span
              role="button"
              onClick={e => { e.stopPropagation(); onChange('' as T | '') }}
              className="hover:opacity-70 cursor-pointer"
              style={{ color: 'var(--c-t4)' }}
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown
            size={12}
            className={`flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--c-t4)' }}
          />
        </div>
      </button>

      {open && rect && createPortal(
        <>
          <div className="fixed inset-0 z-[200]" onClick={close} />
          <div
            className="fixed z-[201] rounded-xl border shadow-2xl overflow-hidden"
            style={{
              top: rect.bottom + 4,
              left: rect.left,
              width: Math.max(rect.width, 220),
              background: 'var(--c-panel)',
              borderColor: 'var(--c-border)',
            }}
          >
            <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
              <div className="relative">
                <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t4)' }} />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search…"
                  className="w-full pl-6 pr-2 bg-transparent text-[12px] focus:outline-none"
                  style={{ color: 'var(--c-t1)' }}
                />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-3 py-2.5 text-[12px]" style={{ color: 'var(--c-t4)' }}>
                  {query ? 'No results' : 'No options'}
                </p>
              ) : filtered.map(o => (
                <button
                  key={String(o.value)}
                  type="button"
                  onClick={() => select(o.value)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left text-[12px] transition hover:bg-[var(--c-hover)]"
                  style={{
                    color: o.value === value ? 'var(--c-primary)' : 'var(--c-t2)',
                    fontWeight: o.value === value ? 600 : undefined,
                  }}
                >
                  <span className="truncate">{o.label}</span>
                  {o.value === value && <Check size={11} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}
