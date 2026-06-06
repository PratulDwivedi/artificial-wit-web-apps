export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'MCP'

export interface Environment {
  id: string
  name: string
  baseUrl: string
}

export interface Param {
  name: string
  value: string
  type: string
  description?: string
  required?: boolean
  enabled?: boolean
}

export interface Header {
  name: string
  value: string
  enabled: boolean
}

export interface RequestBody {
  type: 'json' | 'form' | 'none'
  content: string
}

export interface EndpointRequest {
  headers?: Header[]
  params?: Param[]
  body?: RequestBody
}

export interface Endpoint {
  id: string
  name: string
  method: HttpMethod
  path: string
  description: string
  tags: string[]
  request: EndpointRequest
  responses?: Record<string, { description: string; example: string }>
  mcpTool?: string
  isMcpEndpoint?: boolean
}

export interface Group {
  id: string
  name: string
  endpoints: Endpoint[]
}

export interface Collection {
  id: string
  name: string
  icon: string
  groups: Group[]
}

export interface McpToolSchema {
  type: string
  properties: Record<string, { type: string; title?: string; description: string; required?: boolean; source?: string }>
}

export interface McpTool {
  id: string
  name: string
  title: string
  description: string
  inputSchema: McpToolSchema
}

export interface ApiData {
  environments: Environment[]
  mcpServer: { url: string; connected: boolean }
  collections: Collection[]
  mcpTools: McpTool[]
}

export type ViewMode = 'rest' | 'mcp'
export type TabId = 'params' | 'body' | 'headers' | 'auth' | 'docs'
