'use client'

import { QrCode, Barcode, Type, Square, Minus, Image, Trash2, Lock, Unlock, ChevronUp, ChevronDown } from 'lucide-react'
import type { CanvasElement, LabelTemplate } from '@/lib/label-template'

// ── Element type icon ─────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: CanvasElement['type'] }) {
  const props = { size: 12 }
  switch (type) {
    case 'qr':      return <QrCode  {...props} />
    case 'barcode': return <Barcode {...props} />
    case 'text':    return <Type    {...props} />
    case 'rect':    return <Square  {...props} />
    case 'line':    return <Minus   {...props} />
    case 'image':   return <Image   {...props} />
  }
}

function elementLabel(el: CanvasElement): string {
  switch (el.type) {
    case 'qr':      return el.value_template ? `QR: ${el.value_template.slice(0, 16)}` : 'QR Code'
    case 'barcode': return el.value_template ? `BC: ${el.value_template.slice(0, 16)}` : 'Barcode'
    case 'text':    return el.content        ? el.content.slice(0, 20)                 : 'Text'
    case 'rect':    return 'Rectangle'
    case 'line':    return 'Line'
    case 'image':   return 'Image'
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  template:   LabelTemplate
  selectedId: string | null
  onSelect:   (id: string | null) => void
  onAdd:      (type: CanvasElement['type']) => void
  onDelete:   (id: string) => void
  onToggleLock: (id: string) => void
  onReorder:  (id: string, dir: 'up' | 'down') => void
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

const ADD_ITEMS: { type: CanvasElement['type']; label: string; Icon: React.ElementType }[] = [
  { type: 'qr',      label: 'QR Code', Icon: QrCode  },
  { type: 'barcode', label: 'Barcode', Icon: Barcode  },
  { type: 'text',    label: 'Text',    Icon: Type     },
  { type: 'rect',    label: 'Rect',    Icon: Square   },
  { type: 'line',    label: 'Line',    Icon: Minus    },
  { type: 'image',   label: 'Image',   Icon: Image    },
]

export function ElementToolbar({
  template, selectedId, onSelect, onAdd, onDelete, onToggleLock, onReorder,
}: Props) {
  const els = [...template.elements].reverse()   // top layer first in UI

  return (
    <div className="flex flex-col border-r overflow-hidden"
      style={{ width: 200, background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

      {/* Add elements */}
      <div className="p-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--c-t5)' }}>
          Add Element
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {ADD_ITEMS.map(({ type, label, Icon }) => (
            <button
              key={type}
              type="button"
              onClick={() => onAdd(type)}
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-medium transition"
              style={{ borderColor: 'var(--c-border)', color: 'var(--c-t2)', background: 'var(--c-hover)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--c-primary)'; e.currentTarget.style.color = 'var(--c-primary)'; e.currentTarget.style.background = 'var(--c-active)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--c-border)'; e.currentTarget.style.color = 'var(--c-t2)'; e.currentTarget.style.background = 'var(--c-hover)' }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Layers */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <p className="text-[10px] font-semibold uppercase tracking-widest px-3 pt-3 pb-2 shrink-0" style={{ color: 'var(--c-t5)' }}>
          Layers ({template.elements.length})
        </p>
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
          {els.length === 0 ? (
            <p className="text-[11px] text-center py-6" style={{ color: 'var(--c-t5)' }}>No elements yet</p>
          ) : els.map(el => {
            const isSelected = selectedId === el.id
            return (
              <div
                key={el.id}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer transition"
                style={{
                  background:  isSelected ? 'var(--c-active)' : undefined,
                  border:      isSelected ? '1px solid var(--c-primary)' : '1px solid transparent',
                  color:       isSelected ? 'var(--c-primary)' : 'var(--c-t2)',
                }}
                onClick={() => onSelect(isSelected ? null : el.id)}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-hover)' }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '' }}
              >
                <TypeIcon type={el.type} />
                <span className="flex-1 text-[11px] truncate">{elementLabel(el)}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onReorder(el.id, 'up') }}
                    className="p-0.5 rounded opacity-50 hover:opacity-100 transition"
                    title="Bring forward">
                    <ChevronUp size={10} />
                  </button>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onReorder(el.id, 'down') }}
                    className="p-0.5 rounded opacity-50 hover:opacity-100 transition"
                    title="Send back">
                    <ChevronDown size={10} />
                  </button>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onToggleLock(el.id) }}
                    className="p-0.5 rounded opacity-50 hover:opacity-100 transition"
                    title={el.locked ? 'Unlock' : 'Lock'}>
                    {el.locked ? <Lock size={9} /> : <Unlock size={9} />}
                  </button>
                  <button type="button"
                    onClick={e => { e.stopPropagation(); onDelete(el.id) }}
                    className="p-0.5 rounded opacity-50 hover:opacity-100 hover:text-red-500 transition"
                    title="Delete">
                    <Trash2 size={9} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
