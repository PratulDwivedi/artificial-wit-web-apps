'use client'
import { create } from 'zustand'
import type { Endpoint, ViewMode, TabId, McpTool } from './types'

export type SectionId =
  | 'chat' | 'knowledge-base' | 'agents' | 'credentials' | 'tool-test'
  | 'llm' | 'variables' | 'api-configs' | 'prompts' | 'resources' | 'connectors' | 'artifacts' | 'profile' | 'settings'

interface AppState {
  selectedEndpoint: Endpoint | null
  viewMode: ViewMode
  activeTab: TabId
  mcpConnected: boolean
  mcpServerUrl: string
  expandedCollections: Set<string>
  expandedGroups: Set<string>
  requestBody: string
  responseData: string | null
  responseStatus: number | null
  responseTime: number | null
  responseHeaders: Record<string, string> | null
  isLoading: boolean
  selectedMcpTool: McpTool | null
  userEmail:      string | null
  profilePic:     string | null
  tenantName:     string | null
  tenantLogoUrl:  string | null

  setSelectedEndpoint: (ep: Endpoint | null) => void
  setViewMode: (m: ViewMode) => void
  setActiveTab: (t: TabId) => void
  toggleCollection: (id: string) => void
  toggleGroup: (id: string) => void
  setMcpConnected: (v: boolean) => void
  setMcpServerUrl: (url: string) => void
  setRequestBody: (body: string) => void
  setResponse: (data: string | null, status: number | null, time: number | null, headers?: Record<string, string> | null) => void
  setLoading: (v: boolean) => void
  setSelectedMcpTool: (tool: McpTool | null) => void
  setUserEmail:     (email: string | null) => void
  setProfilePic:    (url: string | null)   => void
  setTenantName:    (n: string | null)     => void
  setTenantLogoUrl: (url: string | null)   => void
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedEndpoint: null,
  viewMode: 'rest',
  activeTab: 'params',
  mcpConnected: false,
  mcpServerUrl: process.env.NEXT_PUBLIC_AW_MCP_BASE_URL ?? '',
  expandedCollections: new Set(['access-control', 'api-artificial-wit', 'mcp-tools']),
  expandedGroups: new Set(['access', 'assets-group', 'orders-group', 'vendors-group', 'scanned-group', 'mcp-tools-group']),
  requestBody: '',
  responseData: null,
  responseStatus: null,
  responseTime: null,
  responseHeaders: null,
  isLoading: false,
  selectedMcpTool: null,
  userEmail:     null,
  profilePic:    null,
  tenantName:    null,
  tenantLogoUrl: null,

  setSelectedEndpoint: (ep) => set({
    selectedEndpoint: ep,
    requestBody: ep?.request.body?.content ?? '',
    activeTab: ep?.request.body ? 'body' : 'headers',
    responseData: null,
    responseStatus: null,
    responseTime: null,
    responseHeaders: null,
  }),
  setViewMode: (m) => set({ viewMode: m }),
  setActiveTab: (t) => set({ activeTab: t }),
  toggleCollection: (id) => set((s) => {
    const next = new Set(s.expandedCollections)
    next.has(id) ? next.delete(id) : next.add(id)
    return { expandedCollections: next }
  }),
  toggleGroup: (id) => set((s) => {
    const next = new Set(s.expandedGroups)
    next.has(id) ? next.delete(id) : next.add(id)
    return { expandedGroups: next }
  }),
  setMcpConnected: (v) => set({ mcpConnected: v }),
  setMcpServerUrl: (url) => set({ mcpServerUrl: url }),
  setRequestBody: (body) => set({ requestBody: body }),
  setResponse: (data, status, time, headers) => set({ responseData: data, responseStatus: status, responseTime: time, responseHeaders: headers ?? null }),
  setLoading: (v) => set({ isLoading: v }),
  setSelectedMcpTool: (tool) => set({ selectedMcpTool: tool }),
  setUserEmail:     (email) => set({ userEmail: email }),
  setProfilePic:    (url)   => set({ profilePic: url }),
  setTenantName:    (n)     => set({ tenantName: n }),
  setTenantLogoUrl: (url)   => set({ tenantLogoUrl: url }),
}))
