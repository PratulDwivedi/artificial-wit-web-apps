'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  Plus, Bot, User, Loader2, Search, Clock,
  MessageCircle, ChevronRight, Sparkles, ArrowUp,
  Pencil, Trash2, Check, X,
} from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { BlockForm, BlockTable, BlockChart, BlockMarkdown } from './blocks'
import { MarkdownContent } from './blocks/BlockMarkdown'
import type { Block } from './blocks'

// ── Types ──────────────────────────────────────────────────────────────────────

interface ChatSession {
  id: number
  name: string
  agent_id: number | null
  created_at: string
}

interface ChatMessage {
  id: number
  role: 'user' | 'assistant'
  content: string
  sources: unknown[]
  created_at: string
}

interface Agent {
  id: number
  name: string
  avatar: string | null
  description: string
}

interface ReadyPrompt {
  id: number
  name: string
  prompt: string
}

interface ParsedContent {
  content: string
  blocks: Block[]
}

// ── Parse message content ──────────────────────────────────────────────────────

function unwrapBlock(b: unknown): Block | null {
  if (!b || typeof b !== 'object') return null
  let block = b as Record<string, unknown>
  // Unwrap tool_block envelope: {type:'tool_block', block:{...}}
  if (block.type === 'tool_block' && block.block && typeof block.block === 'object') {
    block = block.block as Record<string, unknown>
  }
  // Normalize table blocks: API uses 'data' for rows, ensure id/title exist
  if (block.type === 'table') {
    return {
      ...block,
      id:    block.id    ?? `table-${Math.random().toString(36).slice(2)}`,
      title: block.title ?? 'Table',
      rows:  block.rows  ?? block.data ?? [],
    } as unknown as Block
  }
  return block as unknown as Block
}

function parseContent(raw: string): ParsedContent | null {
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && Array.isArray(p.blocks)) {
      return { content: p.content ?? '', blocks: p.blocks.map(unwrapBlock).filter(Boolean) as Block[] }
    }
  } catch { /* plain text */ }
  return null
}

function dedupeMessages(msgs: ChatMessage[]): ChatMessage[] {
  return msgs.filter((msg, i) => {
    if (msg.role !== 'assistant') return true
    const parsed = parseContent(msg.content)
    if (parsed) return true
    // plain text — skip if next assistant message is its JSON counterpart
    const next = msgs[i + 1]
    if (next?.role === 'assistant') {
      const nextParsed = parseContent(next.content)
      if (nextParsed && nextParsed.content.trim() === msg.content.trim()) return false
    }
    return true
  })
}

// ── MCP activity type ─────────────────────────────────────────────────────────

interface McpEvent { tool: string; done: boolean; rowCount?: number }

// ── Single message bubble ──────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user'
  const parsed = isUser ? null : parseContent(msg.content)

  if (isUser) {
    return (
      <div className="flex justify-end items-start gap-2.5 px-5 py-1.5">
        <p className="max-w-[72%] text-[13px] leading-relaxed whitespace-pre-wrap text-right"
          style={{ color: 'var(--c-t2)' }}>
          {msg.content}
        </p>
        <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'var(--c-hover)', border: '1px solid var(--c-border-strong)' }}>
          <User size={14} style={{ color: 'var(--c-t3)' }} />
        </div>
      </div>
    )
  }

  const textContent = parsed ? parsed.content : msg.content

  return (
    <div className="flex gap-3 px-5 py-1.5">
      {/* Bot avatar */}
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--c-primary-light)' }}>
        <Bot size={14} style={{ color: 'var(--c-primary)' }} />
      </div>

      <div className="flex-1 min-w-0 max-w-[80%]">
        {/* Text rendered as markdown */}
        {textContent && <MarkdownContent content={textContent} />}

        {/* Blocks */}
        {parsed?.blocks.map((block, i) => {
          if (block.type === 'form')     return <BlockForm     key={i} block={block} />
          if (block.type === 'table')    return <BlockTable    key={i} block={block} />
          if (block.type === 'chart')    return <BlockChart    key={i} block={block} />
          if (block.type === 'markdown') return <BlockMarkdown key={i} block={block} />
          return null
        })}

        <p className="text-[10px] mt-1" style={{ color: 'var(--c-t5)' }}>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

// ── Streaming assistant bubble ────────────────────────────────────────────────

function StreamingMessage({
  content, blocks, mcpActivity,
}: {
  content: string
  blocks: Block[]
  mcpActivity: McpEvent[]
}) {
  return (
    <div className="flex gap-3 px-5 py-1.5">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{ background: 'var(--c-primary-light)' }}>
        <Bot size={14} style={{ color: 'var(--c-primary)' }} />
      </div>

      <div className="flex-1 min-w-0 max-w-[80%]">
        {/* MCP tool activity chips */}
        {mcpActivity.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {mcpActivity.map((a, i) => (
              <span key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border"
                style={a.done
                  ? { background: 'rgba(22,163,74,0.08)', color: '#16a34a', borderColor: 'rgba(22,163,74,0.2)' }
                  : { background: 'var(--c-hover)', color: 'var(--c-t3)', borderColor: 'var(--c-border-strong)' }
                }>
                {a.done
                  ? <Check size={9} />
                  : <Loader2 size={9} className="animate-spin" />
                }
                {a.tool}{a.rowCount !== undefined ? ` · ${a.rowCount}` : ''}
              </span>
            ))}
          </div>
        )}

        {/* Streaming text with blinking cursor — plain pre-wrap during stream */}
        {content && (
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--c-t1)' }}>
            {content}
            <span className="inline-block w-0.5 h-3.5 ml-0.5 align-middle animate-pulse"
              style={{ background: 'var(--c-t3)' }} />
          </p>
        )}

        {/* Streaming blocks */}
        {blocks.map((block, i) => {
          if (block.type === 'form')     return <BlockForm     key={i} block={block} />
          if (block.type === 'table')    return <BlockTable    key={i} block={block} />
          if (block.type === 'chart')    return <BlockChart    key={i} block={block} />
          if (block.type === 'markdown') return <BlockMarkdown key={i} block={block} />
          return null
        })}

        {/* Typing dots while waiting for first content */}
        {!content && blocks.length === 0 && (
          <div className="flex items-center gap-1 py-1">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-1.5 h-1.5 rounded-full animate-bounce"
                style={{ background: 'var(--c-t4)', animationDelay: `${delay}ms` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Agent picker ───────────────────────────────────────────────────────────────

function AgentPicker({
  agents, selected, onSelect,
}: {
  agents: Agent[]
  selected: Agent | null
  onSelect: (a: Agent) => void
}) {
  const [open, setOpen]     = useState(false)
  const [pos,  setPos]      = useState({ bottom: 0, left: 0 })
  const btnRef              = useRef<HTMLButtonElement>(null)
  const dropRef             = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        btnRef.current  && !btnRef.current.contains(e.target as Node) &&
        dropRef.current && !dropRef.current.contains(e.target as Node)
      ) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({
        bottom: window.innerHeight - r.top + 8,
        left:   r.left,
      })
    }
    setOpen(v => !v)
  }

  const dropdown = open ? createPortal(
    <div ref={dropRef}
      className="w-[240px] rounded-2xl border shadow-2xl overflow-hidden"
      style={{
        position:   'fixed',
        bottom:     pos.bottom,
        left:       pos.left,
        zIndex:     9999,
        background: 'var(--c-panel)',
        borderColor: 'var(--c-border)',
      }}>
      <div className="px-3 py-2.5 border-b text-[11px] font-semibold uppercase tracking-wider"
        style={{ borderColor: 'var(--c-border)', color: 'var(--c-t4)', background: 'var(--c-topbar)' }}>
        Select Agent
      </div>
      {agents.length === 0 ? (
        <p className="px-4 py-3 text-[12px]" style={{ color: 'var(--c-t4)' }}>No agents available</p>
      ) : (
        agents.map(a => (
          <button key={a.id} onClick={() => { onSelect(a); setOpen(false) }}
            className="w-full flex items-start gap-3 px-4 py-3 text-left transition hover:bg-[var(--c-hover)]"
            style={{ background: selected?.id === a.id ? 'var(--c-active)' : undefined }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'var(--c-primary-light)' }}>
              <Bot size={14} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold leading-tight" style={{ color: 'var(--c-t1)' }}>
                {a.name}
              </p>
              <p className="text-[11px] mt-0.5 line-clamp-1" style={{ color: 'var(--c-t4)' }}>
                {a.description}
              </p>
            </div>
          </button>
        ))
      )}
    </div>,
    document.body
  ) : null

  return (
    <>
      <button ref={btnRef} type="button" onClick={toggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-medium transition"
        style={{
          background:  selected ? 'var(--c-primary-light)' : 'var(--c-hover)',
          borderColor: selected ? 'rgba(220,38,38,0.25)'   : 'var(--c-border-strong)',
          color:       selected ? 'var(--c-primary)'        : 'var(--c-t3)',
        }}>
        <Bot size={13} />
        {selected ? selected.name : 'Select Agent'}
        <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="ml-0.5">
          <path d="M1 1l3 3 3-3" stroke="currentColor" strokeWidth="1.4"
            strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {dropdown}
    </>
  )
}

// ── Session item (with inline rename / delete) ────────────────────────────────

function SessionItem({
  session, isActive, onSelect, onRenamed, onDeleted,
}: {
  session: ChatSession
  isActive: boolean
  onSelect: () => void
  onRenamed: (id: number, name: string) => void
  onDeleted: (id: number) => void
}) {
  const [hovered,    setHovered]    = useState(false)
  const [renaming,   setRenaming]   = useState(false)
  const [newName,    setNewName]    = useState(session.name)
  const [saving,     setSaving]     = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      setNewName(session.name)
      setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select() }, 0)
    }
  }, [renaming, session.name])

  const handleRename = async () => {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === session.name) { setRenaming(false); return }
    setSaving(true)
    try {
      const { data } = await HttpHelper.rpc('fn_rename_chat_session', {
        p_session_id: session.id, p_name: trimmed,
      })
      const env = data as { is_success: boolean } | null
      if (env?.is_success) onRenamed(session.id, trimmed)
    } catch { /* ignore */ } finally {
      setSaving(false); setRenaming(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      const { data } = await HttpHelper.rpc('fn_delete_chat_session', { p_session_id: session.id })
      const env = data as { is_success: boolean } | null
      if (env?.is_success) onDeleted(session.id)
    } catch { /* ignore */ } finally {
      setDeleting(false); setConfirmDel(false)
    }
  }

  const rowBg = isActive ? 'var(--c-active)' : hovered ? 'var(--c-hover)' : ''

  if (renaming) {
    return (
      <div className="flex items-center gap-1 px-2 py-1.5 rounded-lg mb-0.5"
        style={{ background: 'var(--c-active)' }}>
        <input ref={inputRef} value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false) }}
          className="flex-1 min-w-0 text-[11px] rounded-md px-2 py-1 border focus:outline-none"
          style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
        <button onClick={handleRename} disabled={saving}
          className="p-1 rounded-md transition hover:bg-[var(--c-hover)] flex-shrink-0"
          style={{ color: 'var(--c-primary)' }}>
          {saving ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
        </button>
        <button onClick={() => setRenaming(false)}
          className="p-1 rounded-md transition hover:bg-[var(--c-hover)] flex-shrink-0"
          style={{ color: 'var(--c-t4)' }}>
          <X size={11} />
        </button>
      </div>
    )
  }

  if (confirmDel) {
    return (
      <div className="px-2.5 py-2.5 rounded-lg mb-0.5 border"
        style={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.2)' }}>
        <p className="text-[10px] mb-2 font-medium" style={{ color: 'var(--c-t2)' }}>Delete this chat?</p>
        <div className="flex items-center gap-1.5">
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] font-medium rounded-md transition">
            {deleting ? <Loader2 size={9} className="animate-spin mx-auto" /> : 'Delete'}
          </button>
          <button onClick={() => { setConfirmDel(false); setHovered(false) }}
            className="flex-1 py-0.5 text-[10px] rounded-md border transition hover:bg-[var(--c-hover)]"
            style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex items-start gap-2 px-2.5 py-2.5 rounded-lg mb-0.5 cursor-pointer transition"
      style={{ background: rowBg }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onSelect}>
      <MessageCircle size={13} className="shrink-0 mt-0.5"
        style={{ color: isActive ? 'var(--c-primary)' : 'var(--c-t4)' }} />

      <div className="flex-1 min-w-0">
        <p className="text-[11px] leading-snug line-clamp-2 pr-1"
          style={{ color: isActive ? 'var(--c-t1)' : 'var(--c-t2)', fontWeight: isActive ? 600 : 400 }}>
          {session.name}
        </p>
        <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--c-t5)' }}>
          <Clock size={9} />
          {new Date(session.created_at).toLocaleDateString()}
        </p>
      </div>

      {/* Hover actions */}
      {hovered && (
        <div className="flex items-center gap-0.5 flex-shrink-0 -mt-0.5"
          onClick={e => e.stopPropagation()}>
          <button onClick={() => setRenaming(true)} title="Rename"
            className="p-1 rounded-md transition hover:bg-[var(--c-active)]"
            style={{ color: 'var(--c-t4)' }}>
            <Pencil size={11} />
          </button>
          <button onClick={() => setConfirmDel(true)} title="Delete"
            className="p-1 rounded-md transition hover:bg-red-500/10"
            style={{ color: 'var(--c-t4)' }}>
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sessions sidebar ───────────────────────────────────────────────────────────

function SessionsSidebar({
  sessions, loading, selected, onSelect, onNew, onRenamed, onDeleted,
}: {
  sessions: ChatSession[]
  loading: boolean
  selected: ChatSession | null
  onSelect: (s: ChatSession) => void
  onNew: () => void
  onRenamed: (id: number, name: string) => void
  onDeleted: (id: number) => void
}) {
  const [search, setSearch] = useState('')
  const filtered = search
    ? sessions.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
    : sessions

  return (
    <div className="w-[240px] min-w-[240px] border-r flex flex-col h-full"
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

      {/* Header */}
      <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--c-t1)' }}>
            Conversations
          </span>
        </div>
        <button onClick={onNew}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium text-white btn-primary transition-colors">
          <Plus size={13} /> New Chat
        </button>
      </div>

      {/* Search */}
      <div className="px-2 pt-2 pb-1 shrink-0">
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t5)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full rounded-lg pl-7 pr-2 py-1.5 text-[11px] border focus:outline-none"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={14} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <p className="px-3 py-3 text-[11px]" style={{ color: 'var(--c-t5)' }}>No conversations yet</p>
        ) : (
          filtered.map(s => (
            <SessionItem
              key={s.id}
              session={s}
              isActive={selected?.id === s.id}
              onSelect={() => onSelect(s)}
              onRenamed={onRenamed}
              onDeleted={onDeleted}
            />
          ))
        )}
      </div>
    </div>
  )
}

// ── Chat area ──────────────────────────────────────────────────────────────────

function ChatArea({
  session, messages, messagesLoading, prompts,
  agents, selectedAgent, onSelectAgent,
  input, setInput, onSend, onSelectPrompt,
  isStreaming, streamContent, streamBlocks, mcpActivity,
}: {
  session: ChatSession | null
  messages: ChatMessage[]
  messagesLoading: boolean
  prompts: ReadyPrompt[]
  agents: Agent[]
  selectedAgent: Agent | null
  onSelectAgent: (a: Agent) => void
  input: string
  setInput: (v: string) => void
  onSend: () => void
  onSelectPrompt: (p: string) => void
  isStreaming: boolean
  streamContent: string
  streamBlocks: Block[]
  mcpActivity: McpEvent[]
}) {
  const endRef      = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto scroll on new messages or streaming content
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent, isStreaming])

  // Auto resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }, [input])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && input.trim() && selectedAgent && !isStreaming) {
      e.preventDefault()
      onSend()
    }
  }

  const showWelcome = !session || (!messagesLoading && messages.length === 0)

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden relative" style={{ background: 'var(--c-base)' }}>

      {/* Messages / Welcome — pb-32 so last message isn't hidden under floating input */}
      <div className="flex-1 overflow-y-auto pb-32">
        {messagesLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
          </div>
        ) : showWelcome ? (
          /* Welcome / empty state with ready prompts */
          <div className="flex flex-col items-center justify-center min-h-full px-6 py-12 gap-6">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: 'var(--c-primary-light)' }}>
              <Sparkles size={24} style={{ color: 'var(--c-primary)' }} />
            </div>
            <div className="text-center">
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--c-t1)' }}>
                {session ? 'No messages yet' : 'Start a Conversation'}
              </h2>
              <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                {session ? 'Send a message to begin.' : 'Select an agent and start chatting.'}
              </p>
            </div>

            {/* Ready prompts */}
            {prompts.length > 0 && (
              <div className="w-full max-w-xl">
                <p className="text-[11px] font-semibold uppercase tracking-wider mb-3 text-center"
                  style={{ color: 'var(--c-t4)' }}>
                  Quick Prompts
                </p>
                <div className="flex flex-col gap-2">
                  {prompts.map(p => (
                    <button key={p.id} onClick={() => onSelectPrompt(p.prompt)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition hover:shadow-sm"
                      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)', color: 'var(--c-t2)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--c-primary)')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--c-border)')}>
                      <ChevronRight size={14} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />
                      <span className="text-[12px] leading-snug">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Messages */
          <div className="py-4 flex flex-col gap-1">
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} />)}
            {isStreaming && (
              <StreamingMessage
                content={streamContent}
                blocks={streamBlocks}
                mcpActivity={mcpActivity}
              />
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input area — absolutely positioned so it floats over the scroll area */}
      <div className="absolute bottom-0 inset-x-0 px-6 py-3 flex flex-col items-center pointer-events-none">
        <div className="w-full max-w-2xl rounded-2xl border shadow-sm overflow-hidden pointer-events-auto"
          style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border-strong)' }}>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedAgent ? `Message ${selectedAgent.name}…` : 'Select an agent and type your message…'}
            rows={2}
            className="w-full px-4 pt-3 pb-2 text-[13px] resize-none focus:outline-none bg-transparent leading-relaxed"
            style={{ color: 'var(--c-t1)', minHeight: 56, maxHeight: 180 }}
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-3 pb-3 pt-1 gap-3">
            {/* Agent picker */}
            <AgentPicker agents={agents} selected={selectedAgent} onSelect={onSelectAgent} />

            {/* Hint */}
            <span className="text-[10px] flex-1 text-center" style={{ color: 'var(--c-t5)' }}>
              {input ? 'Enter to send · Shift+Enter for newline' : ''}
            </span>

            {/* Send */}
            <button
              onClick={onSend}
              disabled={!input.trim() || !selectedAgent || isStreaming}
              className="w-8 h-8 rounded-xl flex items-center justify-center btn-primary
                         disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              {isStreaming
                ? <Loader2 size={13} className="text-white animate-spin" />
                : <ArrowUp size={15} className="text-white" />
              }
            </button>
          </div>
        </div>

        {/* Hints */}
        {!session && (
          <p className="text-center text-[11px] mt-1.5" style={{ color: 'var(--c-t5)' }}>
            Select a conversation from the sidebar to start chatting
          </p>
        )}
        {session && !selectedAgent && (
          <p className="text-center text-[11px] mt-1.5" style={{ color: 'var(--c-t5)' }}>
            Please select an agent to start chatting
          </p>
        )}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ChatPage() {

  const [sessions,        setSessions]        = useState<ChatSession[]>([])
  const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null)
  const [messages,        setMessages]        = useState<ChatMessage[]>([])
  const [agents,          setAgents]          = useState<Agent[]>([])
  const [prompts,         setPrompts]         = useState<ReadyPrompt[]>([])
  const [selectedAgent,   setSelectedAgent]   = useState<Agent | null>(null)
  const [input,           setInput]           = useState('')
  const [sessionsLoading, setSessionsLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [isStreaming,     setIsStreaming]      = useState(false)
  const [streamContent,   setStreamContent]    = useState('')
  const [streamBlocks,    setStreamBlocks]     = useState<Block[]>([])
  const [mcpActivity,     setMcpActivity]      = useState<McpEvent[]>([])

  // Load sessions + agents + prompts in parallel on mount
  useEffect(() => {
    Promise.all([
      HttpHelper.rpc('fn_list_chat_sessions', { p_search: null, p_limit: 200 }),
      HttpHelper.rpc('fn_get_agents_list'),
      HttpHelper.rpc('fn_get_prompts'),
    ]).then(([sessRes, agentRes, promptRes]) => {
      const sessEnv   = sessRes.data  as { is_success: boolean; data: ChatSession[]   } | null
      const agentEnv  = agentRes.data as { is_success: boolean; data: Agent[]         } | null
      const promptEnv = promptRes.data as { is_success: boolean; data: ReadyPrompt[]  } | null

      if (sessEnv?.is_success)   setSessions(sessEnv.data ?? [])
      if (agentEnv?.is_success)  { setAgents(agentEnv.data ?? []); if ((agentEnv.data ?? []).length > 0) setSelectedAgent(agentEnv.data[0]) }
      if (promptEnv?.is_success) setPrompts(promptEnv.data ?? [])
      setSessionsLoading(false)
    })
  }, [])

  // Load messages when session changes
  useEffect(() => {
    if (!selectedSession) { setMessages([]); return }
    setMessagesLoading(true)
    HttpHelper.rpc('fn_list_chat_messages', { p_session_id: selectedSession.id })
      .then(({ data }) => {
        const env = data as { is_success: boolean; data: ChatMessage[] } | null
        if (env?.is_success) setMessages(dedupeMessages(env.data ?? []))
        setMessagesLoading(false)
      })
  }, [selectedSession ])

  const handleSend = useCallback(async () => {
    if (!input.trim() || !selectedAgent || isStreaming) return

    const messageText = input.trim()
    setInput('')

    // 1. Resolve (or create) the session ID
    let chatSessionId: string
    let userMsg: ChatMessage = {
      id: Date.now(), role: 'user', content: messageText,
      sources: [], created_at: new Date().toISOString(),
    }

    if (selectedSession) {
      // Existing session — save message and use its ID
      chatSessionId = String(selectedSession.id)
      try {
        const { data } = await HttpHelper.rpc('fn_save_chat_message', {
          p_session_id: selectedSession.id,
          p_role:       'user',
          p_content:    messageText,
        })
        const env = data as { is_success: boolean; data: { id: number; created_at: string }[] } | null
        if (env?.is_success && env.data[0]) {
          userMsg = { ...userMsg, id: env.data[0].id, created_at: env.data[0].created_at }
        }
      } catch { /* optimistic fallback */ }
    } else {
      // New chat — create session first, then save message
      const { data: createData } = await HttpHelper.rpc('fn_create_chat_session', {
        p_name:     messageText.slice(0, 100),
        p_agent_id: selectedAgent.id,
      })
      const createEnv = createData as { is_success: boolean; data: ChatSession[] } | null
      const newSession = createEnv?.data?.[0] ?? null

      if (!newSession) {
        console.error('[chat] fn_create_chat_session failed')
        setInput(messageText)
        return
      }

      chatSessionId = String(newSession.id)

      // Save user message to the new session
      try {
        const { data } = await HttpHelper.rpc('fn_save_chat_message', {
          p_session_id: newSession.id,
          p_role:       'user',
          p_content:    messageText,
        })
        const env = data as { is_success: boolean; data: { id: number; created_at: string }[] } | null
        if (env?.is_success && env.data[0]) {
          userMsg = { ...userMsg, id: env.data[0].id, created_at: env.data[0].created_at }
        }
      } catch { /* optimistic fallback */ }

      // Add new session to sidebar and select it
      setSessions(prev => [newSession, ...prev])
      setSelectedSession(newSession)
    }

    setMessages(prev => [...prev, userMsg])

    // 2. Stream assistant response
    setIsStreaming(true)
    setStreamContent('')
    setStreamBlocks([])
    setMcpActivity([])

    let accContent = ''
    const accBlocks: Block[] = []

    try {
      const res = await fetch('/api/chat', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${HttpHelper.getToken() ?? ''}`,
        },
        body: JSON.stringify({
          agent_id:   selectedAgent.id,
          session_id: chatSessionId,
          message:    messageText,
          stream:     true,
        }),
      })

      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => '')
        throw new Error(`HTTP ${res.status}: ${detail}`)
      }

      const reader   = res.body.getReader()
      const decoder  = new TextDecoder()
      let buffer     = ''
      let streamDone = false

      while (!streamDone) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const json = line.slice(6).trim()
          if (!json) continue

          try {
            const event = JSON.parse(json) as {
              type: string; text?: string; block?: Block
              tool?: string; rowCount?: number
            }

            switch (event.type) {
              case 'text_delta':
                if (event.text) { accContent += event.text; setStreamContent(accContent) }
                break
              case 'tool_block': {
                const nb = event.block ? unwrapBlock(event.block) : null
                if (nb) { accBlocks.push(nb); setStreamBlocks([...accBlocks]) }
                break
              }
              case 'mcp_call':
                if (event.tool)
                  setMcpActivity(prev => [...prev, { tool: event.tool!, done: false }])
                break
              case 'mcp_result':
                if (event.tool)
                  setMcpActivity(prev => prev.map(a =>
                    a.tool === event.tool ? { ...a, done: true, rowCount: event.rowCount } : a
                  ))
                break
              case 'done':
                streamDone = true
                break
            }
          } catch { /* skip malformed event */ }

          if (streamDone) break
        }
      }

      // 3. Add finalized assistant message
      if (accContent || accBlocks.length > 0) {
        const finalContent = accBlocks.length > 0
          ? JSON.stringify({ content: accContent, blocks: accBlocks })
          : accContent
        setMessages(prev => [...prev, {
          id: Date.now() + 1, role: 'assistant' as const,
          content: finalContent, sources: [],
          created_at: new Date().toISOString(),
        }])
      }
    } catch (err) {
      console.error('[chat] stream error:', err)
    } finally {
      setIsStreaming(false)
      setStreamContent('')
      setStreamBlocks([])
      setMcpActivity([])
    }
  }, [input, selectedAgent, selectedSession, isStreaming ])

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      <SessionsSidebar
        sessions={sessions}
        loading={sessionsLoading}
        selected={selectedSession}
        onSelect={s => setSelectedSession(s)}
        onNew={() => setSelectedSession(null)}
        onRenamed={(id, name) =>
          setSessions(prev => prev.map(s => s.id === id ? { ...s, name } : s))
        }
        onDeleted={id => {
          setSessions(prev => prev.filter(s => s.id !== id))
          if (selectedSession?.id === id) setSelectedSession(null)
        }}
      />
      <ChatArea
        session={selectedSession}
        messages={messages}
        messagesLoading={messagesLoading}
        prompts={prompts}
        agents={agents}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        input={input}
        setInput={setInput}
        onSend={handleSend}
        onSelectPrompt={p => setInput(p)}
        isStreaming={isStreaming}
        streamContent={streamContent}
        streamBlocks={streamBlocks}
        mcpActivity={mcpActivity}
      />
    </div>
  )
}
