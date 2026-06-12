'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link, Quote, Table,
  Code, Type,
} from 'lucide-react'

// ── ToolBtn ───────────────────────────────────────────────────────────────────

function ToolBtn({ title, onClick, children }: {
  title: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <button type="button" title={title}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      className="w-7 h-7 flex items-center justify-center rounded-lg transition"
      style={{ color: 'var(--c-t3)' }}
      onMouseEnter={e => { e.currentTarget.style.background = 'var(--c-hover)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
      {children}
    </button>
  )
}

// ── RichEditor ────────────────────────────────────────────────────────────────

export interface RichEditorProps {
  value: string
  onChange: (html: string) => void
  onFocus?: () => void
  editorRef: { current: HTMLDivElement | null }
}

/**
 * Before loading HTML into contentEditable, neutralize <style> tags by giving
 * them a non-CSS MIME type so the browser won't apply them to the host page.
 * The tags remain in the DOM so innerHTML round-trips correctly.
 */
function deactivateStyles(html: string): string {
  if (typeof document === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('style:not([type])').forEach(el => el.setAttribute('type', 'text/x-noop'))
  doc.querySelectorAll('script').forEach(el => el.remove())
  return doc.body.innerHTML
}

/**
 * Before calling onChange, undo the neutralization so the value stored
 * upstream preserves the original <style> tags.
 */
function restoreStyles(html: string): string {
  if (typeof document === 'undefined') return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('style[type="text/x-noop"]').forEach(el => el.removeAttribute('type'))
  doc.querySelectorAll('script').forEach(el => el.remove())
  return doc.body.innerHTML
}

export function RichEditor({ value, onChange, onFocus, editorRef }: RichEditorProps) {
  const [mode, setMode]   = useState<'visual' | 'code'>('visual')
  const codeRef           = useRef<HTMLTextAreaElement>(null)
  const isFocusedRef      = useRef(false)
  const initializedRef    = useRef(false)

  // Set initial value once; re-sync when value changes externally and editor is not focused
  useEffect(() => {
    if (editorRef.current && (!initializedRef.current || !isFocusedRef.current)) {
      editorRef.current.innerHTML = deactivateStyles(value)
      initializedRef.current = true
    }
  }, [value, editorRef])

  const syncToParent = useCallback(() => {
    if (editorRef.current) onChange(restoreStyles(editorRef.current.innerHTML))
  }, [editorRef, onChange])

  function switchMode(next: 'visual' | 'code') {
    if (next === 'code' && editorRef.current && codeRef.current) {
      // Show the real HTML (with <style>) in the code textarea
      codeRef.current.value = restoreStyles(editorRef.current.innerHTML)
    } else if (next === 'visual' && codeRef.current && editorRef.current) {
      const restored = restoreStyles(codeRef.current.value)
      editorRef.current.innerHTML = deactivateStyles(restored)
      onChange(restored)
    }
    setMode(next)
  }

  function exec(command: string, val?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, val)
    setTimeout(syncToParent, 0)
  }

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--c-border-strong)' }}>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap border-b"
        style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>

        {/* Visual / Code tabs */}
        <div className="flex rounded-lg overflow-hidden border mr-2" style={{ borderColor: 'var(--c-border-strong)' }}>
          {(['visual', 'code'] as const).map(m => (
            <button key={m} type="button" onClick={() => switchMode(m)}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition"
              style={{ background: mode === m ? 'var(--c-primary)' : 'transparent', color: mode === m ? '#fff' : 'var(--c-t3)' }}>
              {m === 'visual' ? <><Type size={10} /> Visual</> : <><Code size={10} /> Code</>}
            </button>
          ))}
        </div>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--c-border-strong)' }} />
        <ToolBtn title="Bold"      onClick={() => exec('bold')}      ><Bold      size={12} /></ToolBtn>
        <ToolBtn title="Italic"    onClick={() => exec('italic')}    ><Italic    size={12} /></ToolBtn>
        <ToolBtn title="Underline" onClick={() => exec('underline')} ><Underline size={12} /></ToolBtn>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--c-border-strong)' }} />
        <ToolBtn title="H1"        onClick={() => exec('formatBlock', 'H1')}><span className="text-[10px] font-bold">H1</span></ToolBtn>
        <ToolBtn title="H2"        onClick={() => exec('formatBlock', 'H2')}><span className="text-[10px] font-bold">H2</span></ToolBtn>
        <ToolBtn title="H3"        onClick={() => exec('formatBlock', 'H3')}><span className="text-[10px] font-bold">H3</span></ToolBtn>
        <ToolBtn title="Paragraph" onClick={() => exec('formatBlock', 'P')} ><span className="text-[10px] font-bold">P</span></ToolBtn>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--c-border-strong)' }} />
        <ToolBtn title="Align left"   onClick={() => exec('justifyLeft')}  ><AlignLeft   size={12} /></ToolBtn>
        <ToolBtn title="Align center" onClick={() => exec('justifyCenter')}><AlignCenter size={12} /></ToolBtn>
        <ToolBtn title="Align right"  onClick={() => exec('justifyRight')} ><AlignRight  size={12} /></ToolBtn>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--c-border-strong)' }} />
        <ToolBtn title="Bullet list"   onClick={() => exec('insertUnorderedList')}><List        size={12} /></ToolBtn>
        <ToolBtn title="Numbered list" onClick={() => exec('insertOrderedList')}  ><ListOrdered size={12} /></ToolBtn>

        <div className="w-px h-4 mx-0.5" style={{ background: 'var(--c-border-strong)' }} />
        <ToolBtn title="Insert link" onClick={() => {
          const url = window.prompt('Enter URL:')
          if (url) exec('createLink', url)
        }}><Link size={12} /></ToolBtn>

        <ToolBtn title="Blockquote"   onClick={() => exec('formatBlock', 'BLOCKQUOTE')}><Quote size={12} /></ToolBtn>

        <ToolBtn title="Insert table" onClick={() => exec('insertHTML',
          '<table border="1" style="border-collapse:collapse;width:100%;margin:4px 0">' +
          '<tr><td style="padding:4px">&nbsp;</td><td style="padding:4px">&nbsp;</td><td style="padding:4px">&nbsp;</td></tr>' +
          '<tr><td style="padding:4px">&nbsp;</td><td style="padding:4px">&nbsp;</td><td style="padding:4px">&nbsp;</td></tr>' +
          '</table>'
        )}><Table size={12} /></ToolBtn>
      </div>

      {/* ── Visual editing area ── */}
      <div
        ref={editorRef as React.RefObject<HTMLDivElement>}
        contentEditable="true"
        suppressContentEditableWarning
        onInput={syncToParent}
        onFocus={() => { isFocusedRef.current = true; onFocus?.() }}
        onBlur={() => { isFocusedRef.current = false; syncToParent() }}
        className={`rich-editor-content min-h-[130px] p-3 text-[13px] outline-none leading-relaxed ${mode !== 'visual' ? 'hidden' : ''}`}
        style={{ background: 'var(--c-panel)', color: 'var(--c-t1)' }}
      />

      {/* ── Code editing area ── */}
      <textarea
        ref={codeRef}
        onChange={e => onChange(e.target.value)}
        onFocus={() => onFocus?.()}
        className={`w-full min-h-[130px] p-3 text-[12px] font-mono resize-none outline-none ${mode !== 'code' ? 'hidden' : ''}`}
        style={{ background: 'var(--c-code)', color: 'var(--c-t2)', border: 'none' }}
        defaultValue={value}
      />
    </div>
  )
}
