import { HttpHelper } from './http'

export interface KbNode {
  id: number
  name: string
  parent_id: number | null
  description: string
  item_count: number
  child_count: number
  created_at: string
  updated_at: string
  access_control: Record<string, any>
  children?: KbNode[]
}

export interface KbItem {
  id: number
  name: string
  kb_id: number
  url: string | null
  file_type: string | null
  file_size: number
  item_type: 'website' | 'file' | string
  embed_status: 'pending' | 'embedded' | 'error' | string
  is_embedded: boolean
  embed_error: string | null
  storage_path: string | null
  access_control: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ── Build parent→children tree from flat list ─────────────────────────────────
export function buildKbTree(nodes: KbNode[]): KbNode[] {
  const map = new Map<number, KbNode>(nodes.map(n => [n.id, { ...n, children: [] }]))
  const roots: KbNode[] = []
  map.forEach(node => {
    if (node.parent_id === null) roots.push(node)
    else map.get(node.parent_id!)?.children?.push(node)
  })
  return roots
}

// ── List / fetch ──────────────────────────────────────────────────────────────
export async function listKnowledgeBases(): Promise<KbNode[]> {
  const { data, error } = await HttpHelper.rpc('fn_list_knowledge_bases')
  if (error) { console.error('[kb] listKnowledgeBases:', error); return [] }
  return (data as any)?.data ?? []
}

export async function listKbItems(kbId: number, search: string | null = null): Promise<KbItem[]> {
  const { data, error } = await HttpHelper.rpc('fn_list_kb_items', {
    p_kb_id: kbId,
    p_search: search ?? null,
  })
  if (error) { console.error('[kb] listKbItems:', error); return [] }
  return (data as any)?.data ?? []
}

// ── Create knowledge base ─────────────────────────────────────────────────────
export async function createKnowledgeBase(
  name: string,
  description?: string,
  parentId?: number | null,
): Promise<KbNode | null> {
  const { data, error } = await HttpHelper.rpc('fn_create_knowledge_base', {
    p_name:        name,
    p_description: description ?? null,
    p_parent_id:   parentId ?? null,
  })
  if (error) { console.error('[kb] createKnowledgeBase:', error); return null }
  return (data as any)?.data?.[0] ?? null
}

// ── Add item ──────────────────────────────────────────────────────────────────
export async function addKbUrlItem(kbId: number, name: string, url: string): Promise<KbItem | null> {
  const { data, error } = await HttpHelper.rpc('fn_add_kb_url_item', {
    p_kb_id: kbId,
    p_name: name,
    p_url: url,
  })
  if (error) { console.error('[kb] addKbUrlItem:', error); return null }
  return (data as any)?.data?.[0] ?? null
}

export async function addKbFileItem(
  kbId: number,
  name: string,
  fileType: string,
  fileSize: number,
  storagePath: string,
): Promise<KbItem | null> {
  const { data, error } = await HttpHelper.rpc('fn_add_kb_file_item', {
    p_kb_id:        kbId,
    p_name:         name,
    p_file_type:    fileType,
    p_file_size:    fileSize,
    p_storage_path: storagePath,
  })
  if (error) { console.error('[kb] addKbFileItem:', error); return null }
  return (data as any)?.data?.[0] ?? null
}

// ── Delete knowledge base ─────────────────────────────────────────────────────
export async function deleteKnowledgeBase(id: number): Promise<boolean> {
  const { data, error } = await HttpHelper.rpc('fn_delete_knowledge_base', { p_id: id })
  if (error) { console.error('[kb] deleteKnowledgeBase:', error); return false }
  return (data as any)?.is_success ?? true
}

// ── Re-embed single item  POST /embed { item_id } ─────────────────────────────
export async function reEmbedItem(itemId: number): Promise<boolean> {
  try {
    const res = await fetch('/api/kb/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: itemId }),
    })
    if (!res.ok) { console.error('[kb] reEmbedItem HTTP', res.status); return false }
    return true
  } catch (e: any) {
    console.error('[kb] reEmbedItem:', e.message)
    return false
  }
}

// ── Re-embed all items in a KB (sequential) ───────────────────────────────────
export async function reEmbedAll(items: KbItem[]): Promise<void> {
  for (const item of items) {
    await reEmbedItem(item.id)
  }
}

// ── Delete item via Supabase RPC ──────────────────────────────────────────────
export async function deleteKbItem(itemId: number): Promise<boolean> {
  const { error } = await HttpHelper.rpc('fn_delete_kb_item', { p_id: itemId })
  if (error) { console.error('[kb] deleteKbItem:', error); return false }
  return true
}
