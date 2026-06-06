'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import type { DropdownOption } from '@/lib/schema'

interface Props {
  options: DropdownOption[]
  value: unknown
  onChange: (value: unknown) => void
  placeholder?: string
  loading?: boolean
  disabled?: boolean
  required?: boolean
  multiple?: boolean
}

export function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder,
  loading = false,
  disabled = false,
  required = false,
  multiple = false,
}: Props) {
  const [open,     setOpen]     = useState(false)
  const [query,    setQuery]    = useState('')
  const [focused,  setFocused]  = useState(-1)

  const containerRef  = useRef<HTMLDivElement>(null)
  const panelRef      = useRef<HTMLDivElement>(null)
  const searchRef     = useRef<HTMLInputElement>(null)
  const listRef       = useRef<HTMLDivElement>(null)

  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 })

  // Derived selections
  const selectedId  = !multiple && value != null ? String(value) : null
  const selectedIds: string[] = multiple && Array.isArray(value)
    ? (value as unknown[]).map(String)
    : []

  const filtered = query.trim()
    ? options.filter(o => o.name.toLowerCase().includes(query.toLowerCase()))
    : options

  const hasValue = multiple ? selectedIds.length > 0 : selectedId != null

  // Close on outside click — must also allow clicks inside the portalled panel
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      const inTrigger = containerRef.current?.contains(target)
      const inPanel   = panelRef.current?.contains(target)
      if (!inTrigger && !inPanel) {
        setOpen(false)
        setQuery('')
        setFocused(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Focus search when opening
  useEffect(() => {
    if (open) {
      searchRef.current?.focus()
      setFocused(-1)
    }
  }, [open])

  // Scroll focused item into view
  useEffect(() => {
    if (focused < 0 || !listRef.current) return
    const item = listRef.current.children[focused] as HTMLElement | undefined
    item?.scrollIntoView({ block: 'nearest' })
  }, [focused])

  const selectOption = useCallback((opt: DropdownOption) => {
    const v = isNaN(Number(opt.id)) ? opt.id : Number(opt.id)
    if (multiple) {
      const cur = Array.isArray(value) ? (value as unknown[]) : []
      const idx = cur.findIndex(x => String(x) === String(opt.id))
      onChange(idx >= 0 ? cur.filter((_, i) => i !== idx) : [...cur, v])
    } else {
      onChange(v)
      setOpen(false)
      setQuery('')
      setFocused(-1)
    }
  }, [multiple, value, onChange])

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(multiple ? [] : null)
  }

  const removeOne = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    const cur = Array.isArray(value) ? (value as unknown[]) : []
    onChange(cur.filter(x => String(x) !== id))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(i => Math.min(i + 1, filtered.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); if (focused >= 0 && filtered[focused]) selectOption(filtered[focused]) }
    if (e.key === 'Escape')    { setOpen(false); setQuery(''); setFocused(-1) }
  }

  const displayText = () => {
    if (loading) return 'Loading…'
    if (!multiple) {
      if (!selectedId) return placeholder ?? '— Select —'
      return options.find(o => String(o.id) === selectedId)?.name ?? placeholder ?? '— Select —'
    }
    return null
  }

  const chips = multiple
    ? selectedIds.map(id => ({ id, name: options.find(o => String(o.id) === id)?.name ?? id }))
    : []

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => {
          if (disabled || loading) return
          if (!open && containerRef.current) {
            const r = containerRef.current.getBoundingClientRect()
            setDropPos({ top: r.bottom + 4, left: r.left, width: r.width })
          }
          setOpen(v => !v)
        }}
        className="w-full min-h-[38px] flex items-start justify-between gap-2 rounded-xl px-3 py-2 text-[13px] border transition
                   focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)]
                   disabled:opacity-50 disabled:cursor-not-allowed text-left"
        style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}
      >
        {/* Content area */}
        <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
          {multiple ? (
            chips.length > 0 ? chips.map(chip => (
              <span key={chip.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium"
                style={{ background: 'var(--c-active)', color: 'var(--c-primary)' }}>
                {chip.name}
                {!disabled && (
                  <span onClick={e => removeOne(e, chip.id)} className="hover:opacity-60 cursor-pointer leading-none">
                    <X size={9} />
                  </span>
                )}
              </span>
            )) : (
              <span className="py-0.5" style={{ color: 'var(--c-t5)' }}>
                {loading ? 'Loading…' : placeholder ?? '— Select —'}
              </span>
            )
          ) : (
            <span className="py-0.5 truncate" style={{ color: hasValue ? 'var(--c-t1)' : 'var(--c-t5)' }}>
              {displayText()}
            </span>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 mt-0.5 shrink-0">
          {hasValue && !disabled && (
            <span onClick={clearAll}
              className="p-0.5 rounded transition hover:bg-[var(--c-border-strong)]"
              style={{ color: 'var(--c-t5)' }}>
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13}
            className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
            style={{ color: 'var(--c-t4)' }} />
        </div>
      </button>

      {/* Dropdown panel — portalled to body so overflow:hidden on ancestors can't clip it */}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          className="rounded-xl border shadow-2xl overflow-hidden"
          style={{
            position: 'fixed',
            top: dropPos.top,
            left: dropPos.left,
            width: dropPos.width,
            zIndex: 9999,
            background: 'var(--c-panel)',
            borderColor: 'var(--c-border)',
          }}
        >
          {/* Search bar */}
          <div className="p-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 border"
              style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
              <Search size={12} style={{ color: 'var(--c-t5)' }} className="shrink-0" />
              <input ref={searchRef} type="text"
                value={query}
                onChange={e => { setQuery(e.target.value); setFocused(-1) }}
                onKeyDown={handleKeyDown}
                placeholder="Search…"
                className="flex-1 bg-transparent text-[12px] focus:outline-none"
                style={{ color: 'var(--c-t1)' }} />
              {query && (
                <button type="button" onClick={() => setQuery('')}>
                  <X size={11} style={{ color: 'var(--c-t5)' }} />
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <div ref={listRef} className="overflow-y-auto max-h-[220px] py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-[12px] text-center" style={{ color: 'var(--c-t5)' }}>
                No options found
              </p>
            ) : filtered.map((opt, i) => {
              const isSelected = multiple
                ? selectedIds.includes(String(opt.id))
                : String(opt.id) === selectedId
              const isFocused = i === focused
              return (
                <button key={String(opt.id)} type="button"
                  onClick={() => selectOption(opt)}
                  onMouseEnter={() => setFocused(i)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[13px] transition text-left"
                  style={{
                    background: isFocused || isSelected ? 'var(--c-active)' : undefined,
                    color: isSelected ? 'var(--c-primary)' : 'var(--c-t2)',
                  }}>
                  <span className="truncate">{opt.name}</span>
                  {isSelected && <Check size={13} className="shrink-0 ml-2" style={{ color: 'var(--c-primary)' }} />}
                </button>
              )
            })}
          </div>
        </div>,
        document.body
      )}

      {/* Hidden input for native form required validation */}
      {required && !hasValue && (
        <input type="text" required tabIndex={-1} aria-hidden
          className="absolute inset-0 opacity-0 pointer-events-none w-full"
          defaultValue="" />
      )}
    </div>
  )
}
