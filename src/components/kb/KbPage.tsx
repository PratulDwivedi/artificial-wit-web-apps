'use client'
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'
import {
  ChevronRight, ChevronDown, FolderOpen, Folder,
  Plus, Search, RefreshCw, Globe, File as FileIcon,
  Clock, CheckCircle2, AlertCircle, Library, Upload,
  Loader2, Trash2, RotateCcw, X, MoreHorizontal,
  FolderPlus, Pencil, ShieldCheck,
} from 'lucide-react'
import {
  listKnowledgeBases, listKbItems, buildKbTree,
  reEmbedItem, reEmbedAll, deleteKbItem, createKnowledgeBase,
  deleteKnowledgeBase,
  type KbNode, type KbItem,
} from '@/lib/kb-api'
import { AddItemModal } from './AddItemModal'
import AccessControl, { type AccessControlValue } from '@/components/common/AccessControl'

// ── Embed status badge ────────────────────────────────────────────────────────
function EmbedBadge({ status }: { status: string }) {
  if (status === 'ready' || status === 'embedded') return (
    <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
      <CheckCircle2 size={11} /> Ready
    </span>
  )
  if (status === 'failed' || status === 'error') return (
    <span className="flex items-center gap-1 text-[10px] text-red-500 font-medium">
      <AlertCircle size={11} /> Failed
    </span>
  )
  if (status === 'processing') return (
    <span className="flex items-center gap-1 text-[10px] text-blue-500 font-medium">
      <Loader2 size={11} className="animate-spin" /> Processing
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-[10px] text-amber-500 font-medium">
      <Clock size={11} /> Pending
    </span>
  )
}

// ── KB node context menu (portal, fixed position) ────────────────────────────
function KbContextMenu({ node, anchorRect, onClose, onAddSub, onRename, onDelete, onAccessControl }: {
  node: KbNode
  anchorRect: DOMRect
  onClose: () => void
  onAddSub: () => void
  onRename: () => void
  onDelete: () => void
  onAccessControl: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const [deleting, setDeleting]     = useState(false)

  // Close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', h), 0)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const handleDelete = async () => {
    setDeleting(true)
    const ok = await deleteKnowledgeBase(node.id)
    setDeleting(false)
    if (ok) { onDelete(); onClose() }
  }

  // Position: to the right of the anchor, vertically aligned
  const style: React.CSSProperties = {
    position: 'fixed',
    top: anchorRect.top,
    left: anchorRect.right + 4,
    zIndex: 9999,
    width: 200,
  }

  const menu = (
    <div ref={ref}
      className="rounded-xl border shadow-2xl overflow-hidden py-1"
      style={{ ...style, background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
      {[
        { icon: FolderPlus,  label: 'Add sub-KB',     action: () => { onAddSub(); onClose() } },
        { icon: Pencil,      label: 'Rename / Move',  action: () => { onRename(); onClose() } },
        { icon: ShieldCheck, label: 'Access Control', action: () => { onAccessControl(); onClose() } },
      ].map(({ icon: Icon, label, action }) => (
        <button key={label} onClick={action}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] transition-colors hover:bg-[var(--c-hover)]"
          style={{ color: 'var(--c-t2)' }}>
          <Icon size={15} style={{ color: 'var(--c-t4)' }} />
          {label}
        </button>
      ))}

      <div className="h-px mx-3 my-1" style={{ background: 'var(--c-border)' }} />

      {!confirmDel ? (
        <button onClick={() => setConfirmDel(true)}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-[13px] text-red-500 transition-colors hover:bg-red-500/10">
          <Trash2 size={15} /> Delete
        </button>
      ) : (
        <div className="px-4 py-2.5 flex items-center gap-2">
          <span className="text-[11px] flex-1" style={{ color: 'var(--c-t3)' }}>Are you sure?</span>
          <button onClick={handleDelete} disabled={deleting}
            className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[11px] rounded transition-colors">
            {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
          </button>
          <button onClick={() => setConfirmDel(false)}
            className="px-2 py-0.5 rounded text-[11px] hover:bg-[var(--c-hover)] transition-colors"
            style={{ color: 'var(--c-t4)' }}>No</button>
        </div>
      )}
    </div>
  )

  return createPortal(menu, document.body)
}

// ── KB tree node ──────────────────────────────────────────────────────────────
function KbTreeNode({ node, depth, selectedId, onSelect, expanded, onToggle, onAddSub, onRename, onDeleted, onAccessControl }: {
  node: KbNode; depth: number; selectedId: number | null
  onSelect: (n: KbNode) => void
  expanded: Set<number>; onToggle: (id: number) => void
  onAddSub: (n: KbNode) => void
  onRename: (n: KbNode) => void
  onDeleted: (id: number) => void
  onAccessControl: (n: KbNode) => void
}) {
  const [showMenu, setShowMenu]     = useState(false)
  const [menuRect, setMenuRect]     = useState<DOMRect | null>(null)
  const btnRef                      = useRef<HTMLButtonElement>(null)
  const isSelected  = node.id === selectedId
  const isExpanded  = expanded.has(node.id)
  const hasChildren = (node.children?.length ?? 0) > 0

  const openMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    const rect = btnRef.current?.getBoundingClientRect() ?? null
    setMenuRect(rect)
    setShowMenu(v => !v)
  }

  return (
    <div>
      <div
        className="flex items-center pr-1 rounded-sm group transition-colors"
        style={{ paddingLeft: `${8 + depth * 14}px`, background: isSelected ? 'var(--c-active)' : undefined }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-hover)' }}
        onMouseLeave={e => { if (!isSelected && !showMenu) e.currentTarget.style.background = '' }}
      >
        {/* Chevron + folder + name */}
        <button onClick={() => { onSelect(node); if (hasChildren) onToggle(node.id) }}
          className="flex-1 flex items-center gap-1.5 py-[5px] text-left min-w-0">
          {hasChildren
            ? (isExpanded
                ? <ChevronDown  size={11} className="shrink-0" style={{ color: 'var(--c-t5)' }} />
                : <ChevronRight size={11} className="shrink-0" style={{ color: 'var(--c-t5)' }} />)
            : <span className="w-[11px] shrink-0" />}
          {isExpanded && hasChildren
            ? <FolderOpen size={13} className="shrink-0" style={{ color: isSelected ? '#3b82f6' : 'var(--c-t4)' }} />
            : <Folder    size={13} className="shrink-0" style={{ color: isSelected ? '#3b82f6' : 'var(--c-t4)' }} />}
          <span className="flex-1 text-[12px] truncate" style={{ color: isSelected ? 'var(--c-t1)' : 'var(--c-t2)' }}>
            {node.name}
          </span>
          <span className="text-[10px] ml-1 shrink-0" style={{ color: 'var(--c-t5)' }}>{node.item_count}</span>
        </button>

        {/* "..." trigger */}
        <button ref={btnRef} onClick={openMenu}
          className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity shrink-0 hover:bg-[var(--c-active)]"
          style={{ color: 'var(--c-t4)' }}>
          <MoreHorizontal size={13} />
        </button>
      </div>

      {/* Context menu rendered in portal */}
      {showMenu && menuRect && (
        <KbContextMenu
          node={node}
          anchorRect={menuRect}
          onClose={() => setShowMenu(false)}
          onAddSub={() => onAddSub(node)}
          onRename={() => onRename(node)}
          onDelete={() => onDeleted(node.id)}
          onAccessControl={() => onAccessControl(node)}
        />
      )}

      {isExpanded && node.children?.map(child => (
        <KbTreeNode key={child.id} node={child} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect}
          expanded={expanded} onToggle={onToggle}
          onAddSub={onAddSub} onRename={onRename} onDeleted={onDeleted}
          onAccessControl={onAccessControl} />
      ))}
    </div>
  )
}

// ── Parent KB tree picker ─────────────────────────────────────────────────────
function ParentPickerNode({ node, depth, selectedId, onSelect, expanded, onToggle }: {
  node: KbNode; depth: number; selectedId: number | null
  onSelect: (id: number | null) => void
  expanded: Set<number>; onToggle: (id: number) => void
}) {
  const isSelected = node.id === selectedId
  const isExpanded = expanded.has(node.id)
  const hasChildren = (node.children?.length ?? 0) > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => { onSelect(isSelected ? null : node.id); if (hasChildren) onToggle(node.id) }}
        className="w-full flex items-center gap-1.5 py-1.5 pr-3 rounded-lg text-left transition-colors"
        style={{ paddingLeft: `${10 + depth * 16}px`, background: isSelected ? 'var(--c-active)' : undefined }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-hover)' }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '' }}
      >
        {hasChildren
          ? (isExpanded
              ? <ChevronDown  size={12} className="shrink-0" style={{ color: 'var(--c-t5)' }} />
              : <ChevronRight size={12} className="shrink-0" style={{ color: 'var(--c-t5)' }} />)
          : <span className="w-3 shrink-0" />}
        {isExpanded && hasChildren
          ? <FolderOpen size={14} className="shrink-0" style={{ color: isSelected ? '#3b82f6' : 'var(--c-t4)' }} />
          : <Folder    size={14} className="shrink-0" style={{ color: isSelected ? '#3b82f6' : 'var(--c-t4)' }} />}
        <span className="flex-1 text-[12px] truncate" style={{ color: isSelected ? 'var(--c-t1)' : 'var(--c-t2)' }}>
          {node.name}
        </span>
        {isSelected && <span className="text-[10px] text-blue-500 font-medium shrink-0 ml-1">Selected</span>}
      </button>
      {isExpanded && node.children?.map(child => (
        <ParentPickerNode key={child.id} node={child} depth={depth + 1}
          selectedId={selectedId} onSelect={onSelect}
          expanded={expanded} onToggle={onToggle} />
      ))}
    </div>
  )
}

// ── Rename KB modal ───────────────────────────────────────────────────────────
function RenameKbModal({ node, onClose, onRenamed }: {
  node: KbNode
  onClose: () => void
  onRenamed: (id: number, name: string) => void
}) {
  const [name, setName]     = useState(node.name)
  const [saving, setSaving] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || name.trim() === node.name) { onClose(); return }
    setSaving(true)
    // RPC not yet provided — optimistic update only
    onRenamed(node.id, name.trim())
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-[400px] rounded-2xl shadow-2xl overflow-hidden border"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
          <h2 className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>Rename Knowledge Base</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--c-hover)]" style={{ color: 'var(--c-t4)' }}><X size={15} /></button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide mb-1.5 block" style={{ color: 'var(--c-t4)' }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus
              className="w-full rounded-lg px-3 py-2.5 text-[13px] border focus:outline-none focus:border-blue-500/50"
              style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 btn-primary disabled:opacity-60 text-white text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-[13px] border transition-colors hover:bg-[var(--c-hover)]"
              style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── New KB modal ──────────────────────────────────────────────────────────────
function NewKbModal({ onClose, onCreated, allNodes, initialParentId = null }: {
  onClose: () => void
  onCreated: (node: KbNode) => void
  allNodes: KbNode[]
  initialParentId?: number | null
}) {
  const [name, setName]           = useState('')
  const [description, setDesc]    = useState('')
  const [parentId, setParentId]   = useState<number | null>(initialParentId ?? null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [pickerExpanded, setPickerExpanded] = useState<Set<number>>(new Set())

  const tree = buildKbTree(allNodes)
  const selectedParent = allNodes.find(n => n.id === parentId)

  const togglePicker = (id: number) => setPickerExpanded(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)
    const node = await createKnowledgeBase(name.trim(), description.trim() || undefined, parentId)
    setSaving(false)
    if (!node) { setError('Failed to create knowledge base. Please try again.'); return }
    onCreated({ ...node, children: [], item_count: 0, child_count: 0, access_control: {} })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="w-[680px] rounded-2xl shadow-2xl overflow-hidden border"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
          <div>
            <h2 className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>New Knowledge Base</h2>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--c-t4)' }}>
              Create a new KB to organise your documents and URLs
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--c-hover)] transition-colors" style={{ color: 'var(--c-t4)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Two-column body */}
        <div className="flex min-h-[360px]">

          {/* Left: form fields */}
          <form onSubmit={submit} className="flex-1 px-6 py-5 flex flex-col gap-4 border-r"
            style={{ borderColor: 'var(--c-border)' }}>

            <div>
              <label className="text-[11px] font-semibold mb-1.5 block uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>
                Name <span className="text-red-500">*</span>
              </label>
              <input value={name} onChange={e => setName(e.target.value)} required autoFocus
                placeholder="e.g. HR Policies"
                className="w-full rounded-lg px-3 py-2.5 text-[13px] border focus:outline-none focus:border-blue-500/50 transition-colors"
                style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
            </div>

            <div>
              <label className="text-[11px] font-semibold mb-1.5 block uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>
                Description
              </label>
              <textarea value={description} onChange={e => setDesc(e.target.value)} rows={3}
                placeholder="Brief description of what this KB contains…"
                className="w-full rounded-lg px-3 py-2.5 text-[13px] border focus:outline-none focus:border-blue-500/50 transition-colors resize-none"
                style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }} />
            </div>

            {/* Selected parent display */}
            <div>
              <label className="text-[11px] font-semibold mb-1.5 block uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>
                Parent KB
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
                {selectedParent
                  ? <><Folder size={13} className="text-blue-500 shrink-0" />
                      <span className="text-[12px] flex-1" style={{ color: 'var(--c-t1)' }}>{selectedParent.name}</span>
                      <button type="button" onClick={() => setParentId(null)} className="text-[10px] hover:text-red-500 transition-colors" style={{ color: 'var(--c-t4)' }}>Clear</button>
                    </>
                  : <span className="text-[12px]" style={{ color: 'var(--c-t5)' }}>None — top-level KB (select from tree →)</span>
                }
              </div>
            </div>

            {error && (
              <p className="text-[11px] text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-2 mt-auto pt-2">
              <button type="submit" disabled={saving}
                className="flex-1 py-2.5 btn-primary disabled:opacity-60 text-white text-[13px] font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? 'Creating…' : 'Create Knowledge Base'}
              </button>
              <button type="button" onClick={onClose}
                className="px-5 py-2.5 rounded-lg text-[13px] border transition-colors hover:bg-[var(--c-hover)]"
                style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}>
                Cancel
              </button>
            </div>
          </form>

          {/* Right: parent KB tree picker */}
          <div className="w-[260px] min-w-[260px] flex flex-col">
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
              <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--c-t4)' }}>
                Select Parent (optional)
              </p>
            </div>
            <div className="flex-1 overflow-y-auto py-1 px-1">
              {/* None option */}
              <button
                type="button"
                onClick={() => setParentId(null)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-left transition-colors mb-1"
                style={{ background: parentId === null ? 'var(--c-active)' : undefined, color: parentId === null ? 'var(--c-t1)' : 'var(--c-t4)' }}
                onMouseEnter={e => { if (parentId !== null) e.currentTarget.style.background = 'var(--c-hover)' }}
                onMouseLeave={e => { if (parentId !== null) e.currentTarget.style.background = '' }}
              >
                <span className="w-3 shrink-0" />
                <Folder size={14} className="shrink-0" style={{ color: parentId === null ? '#3b82f6' : 'var(--c-t5)' }} />
                <span className="text-[12px] italic">None (top-level)</span>
                {parentId === null && <span className="text-[10px] text-blue-500 font-medium ml-auto">Selected</span>}
              </button>
              <div className="h-px mx-2 mb-1" style={{ background: 'var(--c-border)' }} />

              {tree.length === 0
                ? <p className="px-3 py-2 text-[11px]" style={{ color: 'var(--c-t5)' }}>No existing knowledge bases</p>
                : tree.map(node => (
                    <ParentPickerNode key={node.id} node={node} depth={0}
                      selectedId={parentId}
                      onSelect={setParentId}
                      expanded={pickerExpanded}
                      onToggle={togglePicker} />
                  ))
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── KB item row ───────────────────────────────────────────────────────────────
function KbItemRow({ item, index, onDeleted, onReembedded, onAccessControlSaved }: {
  item: KbItem
  index: number
  onDeleted: (id: number) => void
  onReembedded: () => void
  onAccessControlSaved: (id: number, ac: AccessControlValue) => void
}) {
  const [reembedding, setReembedding] = useState(false)
  const [deleting, setDeleting]       = useState(false)
  const [confirmDel, setConfirmDel]   = useState(false)
  const [showAccess, setShowAccess]   = useState(false)
  const Icon = item.item_type === 'website' ? Globe : FileIcon

  const handleReembed = async () => {
    setReembedding(true)
    await reEmbedItem(item.id)
    setReembedding(false)
    onReembedded()
  }

  const handleDelete = async () => {
    setDeleting(true)
    const ok = await deleteKbItem(item.id)
    setDeleting(false)
    if (ok) onDeleted(item.id)
    setConfirmDel(false)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b transition-colors hover:bg-[var(--c-hover)]"
      style={{ borderColor: 'var(--c-border)' }}>
      <span className="text-[11px] font-mono w-8 shrink-0 text-right" style={{ color: 'var(--c-t5)' }}>
        {index}
      </span>
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--c-hover)' }}>
        <Icon size={15} style={{ color: 'var(--c-t3)' }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium truncate" style={{ color: 'var(--c-t1)' }}>{item.name}</p>
        <p className="text-[11px] truncate" style={{ color: 'var(--c-t4)' }}>
          {item.url ?? item.storage_path ?? item.item_type}
        </p>
      </div>

      <div className="shrink-0 flex items-center gap-3">
        <EmbedBadge status={item.embed_status} />
        <span className="text-[10px]" style={{ color: 'var(--c-t5)' }}>
          {new Date(item.created_at).toLocaleDateString()}
        </span>

        {/* Actions — visible on hover */}
        <div className="flex items-center gap-1">
          {/* Access Control */}
          <button
            onClick={() => setShowAccess(true)}
            title="Access Control"
            className="p-1.5 rounded-lg hover:bg-[var(--c-active)] transition-colors"
            style={{ color: 'var(--c-t4)' }}
          >
            <ShieldCheck size={13} />
          </button>

          {/* Re-embed */}
          <button
            onClick={handleReembed}
            disabled={reembedding}
            title="Re-embed"
            className="p-1.5 rounded-lg hover:bg-[var(--c-active)] transition-colors"
            style={{ color: 'var(--c-t4)' }}
          >
            {reembedding
              ? <Loader2 size={13} className="animate-spin text-blue-500" />
              : <RotateCcw size={13} />}
          </button>

          {/* Delete */}
          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              title="Delete"
              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
              style={{ color: 'var(--c-t4)' }}
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-[10px]" style={{ color: 'var(--c-t4)' }}>Delete?</span>
              <button onClick={handleDelete} disabled={deleting}
                className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white text-[10px] rounded transition-colors">
                {deleting ? <Loader2 size={10} className="animate-spin" /> : 'Yes'}
              </button>
              <button onClick={() => setConfirmDel(false)}
                className="px-1.5 py-0.5 rounded text-[10px] hover:bg-[var(--c-hover)] transition-colors"
                style={{ color: 'var(--c-t4)' }}>
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {showAccess && (
        <AccessControl
          resourceName={item.name}
          recordId={item.id}
          routeName="knowledge_base_items"
          accessControl={item.access_control}
          onClose={() => setShowAccess(false)}
          onSaved={ac => { onAccessControlSaved(item.id, ac); setShowAccess(false) }}
        />
      )}
    </div>
  )
}

// ── Main KB page ──────────────────────────────────────────────────────────────
export function KbPage() {
  const [tree, setTree]             = useState<KbNode[]>([])
  const [flat, setFlat]             = useState<KbNode[]>([])
  const [selected, setSelected]     = useState<KbNode | null>(null)
  const [expanded, setExpanded]     = useState<Set<number>>(new Set())
  const [items, setItems]           = useState<KbItem[]>([])
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [showAdd, setShowAdd]       = useState(false)
  const [showNewKb, setShowNewKb]   = useState(false)
  const [newKbParent, setNewKbParent] = useState<KbNode | null>(null)
  const [renameNode, setRenameNode]           = useState<KbNode | null>(null)
  const [accessControlNode, setAccessControlNode] = useState<KbNode | null>(null)
  const [reembedAllLoading, setReembedAllLoading] = useState(false)

  // Load KB tree
  useEffect(() => {
    (async () => {
      setLoading(true)
      const nodes = await listKnowledgeBases()
      setFlat(nodes)
      setTree(buildKbTree(nodes))
      const first = nodes.find(n => n.parent_id === null)
      if (first) setSelected(first)
      setLoading(false)
    })()
  }, [])

  // Load items when KB selected
  useEffect(() => {
    if (!selected) return
    setItemsLoading(true)
    listKbItems(selected.id).then(data => {
      setItems(data)
      setItemsLoading(false)
    })
  }, [selected])

  const handleSearch = async () => {
    if (!selected) return
    setItemsLoading(true)
    const data = await listKbItems(selected.id, search || null)
    setItems(data)
    setItemsLoading(false)
  }

  const handleReembedAll = async () => {
    if (!items.length) return
    setReembedAllLoading(true)
    await reEmbedAll(items)
    setReembedAllLoading(false)
  }

  const handleNodeDeleted = (id: number) => {
    const next = flat.filter(n => n.id !== id && n.parent_id !== id)
    setFlat(next)
    setTree(buildKbTree(next))
    if (selected?.id === id) setSelected(next.find(n => n.parent_id === null) ?? null)
  }

  const toggleExpand = (id: number) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const filteredItems = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* ── Left: KB tree ───────────────────────────────────── */}
      <div className="w-[240px] min-w-[240px] border-r flex flex-col h-full"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}>

        <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[12px] font-semibold" style={{ color: 'var(--c-t1)' }}>
              Knowledge Bases
            </span>
          </div>
          <button onClick={() => setShowNewKb(true)}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium text-white btn-primary transition-colors">
            <Plus size={13} /> New KB
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1 px-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={16} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
            </div>
          ) : (
            tree.map(node => (
              <KbTreeNode key={node.id} node={node} depth={0}
                selectedId={selected?.id ?? null}
                onSelect={n => { setSelected(n); setSearch('') }}
                expanded={expanded} onToggle={toggleExpand}
                onAddSub={n => { setNewKbParent(n); setShowNewKb(true) }}
                onRename={n => setRenameNode(n)}
                onDeleted={handleNodeDeleted}
                onAccessControl={n => setAccessControlNode(n)} />
            ))
          )}
        </div>
      </div>

      {/* ── Right: items panel ──────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden" style={{ background: 'var(--c-base)' }}>
        {selected ? (
          <>
            {/* Header */}
            <div className="px-5 py-3.5 border-b flex items-center justify-between shrink-0"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'var(--c-hover)' }}>
                  <Library size={17} style={{ color: '#991b1b' }} />
                </div>
                <div>
                  <h2 className="text-[14px] font-semibold" style={{ color: 'var(--c-t1)' }}>{selected.name}</h2>
                  <p className="text-[11px]" style={{ color: 'var(--c-t4)' }}>{selected.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReembedAll}
                  disabled={reembedAllLoading || items.length === 0}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border transition-colors hover:bg-[var(--c-hover)] disabled:opacity-40"
                  style={{ borderColor: 'var(--c-border-strong)', color: 'var(--c-t3)' }}
                >
                  {reembedAllLoading
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />}
                  Re-embed All
                </button>
                <button onClick={() => setShowAdd(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-white btn-primary transition-colors">
                  <Plus size={12} /> Add Item
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b shrink-0"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t4)' }} />
                <input
                  value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search items..."
                  className="w-full rounded-lg pl-9 pr-3 py-2 text-[12px] border focus:outline-none focus:border-blue-500/40"
                  style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)', color: 'var(--c-t1)' }}
                />
              </div>
            </div>

            {/* Items list */}
            <div className="flex-1 overflow-y-auto" style={{ background: 'var(--c-panel)' }}>
              {itemsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={18} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4 text-center px-8">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--c-hover)' }}>
                    <Upload size={24} style={{ color: 'var(--c-t4)' }} />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--c-t2)' }}>No items yet</p>
                    <p className="text-[12px] mt-1" style={{ color: 'var(--c-t4)' }}>
                      Add files or URLs to build your knowledge base.
                    </p>
                  </div>
                  <button onClick={() => setShowAdd(true)}
                    className="px-4 py-2 btn-primary text-white text-[12px] font-medium rounded-lg transition-colors">
                    Add your first source
                  </button>
                </div>
              ) : (
                filteredItems.map((item, i) => (
                  <KbItemRow
                    key={item.id}
                    item={item}
                    index={i + 1}
                    onDeleted={id => {
                      setItems(prev => prev.filter(i => i.id !== id))
                      setSelected(prev => prev ? { ...prev, item_count: Math.max(0, prev.item_count - 1) } : prev)
                    }}
                    onReembedded={async () => {
                      if (selected) {
                        const data = await listKbItems(selected.id)
                        setItems(data)
                      }
                    }}
                    onAccessControlSaved={(id, ac) =>
                      setItems(prev => prev.map(i =>
                        i.id === id ? { ...i, access_control: ac as unknown as Record<string, unknown> } : i
                      ))
                    }
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1">
            <p className="text-[12px]" style={{ color: 'var(--c-t4)' }}>Select a knowledge base</p>
          </div>
        )}
      </div>

      {showNewKb && (
        <NewKbModal
          allNodes={flat}
          initialParentId={newKbParent?.id ?? null}
          onClose={() => { setShowNewKb(false); setNewKbParent(null) }}
          onCreated={node => {
            const next = [...flat, node]
            setFlat(next)
            setTree(buildKbTree(next))
            setSelected(node)
          }}
        />
      )}

      {renameNode && (
        <RenameKbModal
          node={renameNode}
          onClose={() => setRenameNode(null)}
          onRenamed={(id, name) => {
            const next = flat.map(n => n.id === id ? { ...n, name } : n)
            setFlat(next); setTree(buildKbTree(next))
            if (selected?.id === id) setSelected(s => s ? { ...s, name } : s)
            setRenameNode(null)
          }}
        />
      )}

      {showAdd && selected && (
        <AddItemModal
          kb={selected}
          onClose={() => setShowAdd(false)}
          onAdded={item => {
            setItems(prev => [item, ...prev])
            setSelected(prev => prev ? { ...prev, item_count: prev.item_count + 1 } : prev)
          }}
        />
      )}

      {accessControlNode && (
        <AccessControl
          resourceName={accessControlNode.name}
          recordId={accessControlNode.id}
          routeName="knowledge_base"
          accessControl={accessControlNode.access_control}
          onClose={() => setAccessControlNode(null)}
          onSaved={(ac: AccessControlValue) => {
            const next = flat.map(n =>
              n.id === accessControlNode.id ? { ...n, access_control: ac } : n
            )
            setFlat(next)
            setTree(buildKbTree(next))
            if (selected?.id === accessControlNode.id)
              setSelected(s => s ? { ...s, access_control: ac } : s)
            setAccessControlNode(null)
          }}
        />
      )}
    </div>
  )
}
