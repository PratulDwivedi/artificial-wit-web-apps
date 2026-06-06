export interface PageControl {
  id: number
  name: string
  binding_name: string
  display_order: number
  control_type_id: number
  display_mode_id: number
  data?: Record<string, unknown>
  binding_list_page_id?: number
  binding_list_route_name?: string
  cascade_from_binding_name?: string
}

export interface PageSection {
  id: number
  name: string
  controls: PageControl[]
  is_active: boolean
  tenant_id: number
  created_at: string
  created_by: number
  updated_at?: string
  updated_by?: number
  platform_id: number
  binding_name?: string
  display_order: number
  display_mode_id: number
  child_display_mode_id: number
}

export interface PageSchema {
  id: number
  name: string
  descr?: string | null
  data?: {
    item_icon?: string
    is_clear_page?: boolean
  }
  sections: PageSection[]
  is_active: boolean
  module_id: number
  tenant_id: number
  created_at: string
  created_by: number
  route_name: string
  updated_at?: string
  updated_by?: number
  platform_id: number
  page_type_id: number
  display_order: number
  parent_page_id?: number
  binding_type_id: number
  binding_name_get?: string
  binding_name_post?: string
  display_location_id: number
}

export interface DropdownOption {
  id: number | string
  name: string
  [key: string]: unknown
}

export interface RpcEnvelope<T = unknown> {
  is_success: boolean
  data: T
  message: string
  status_code?: number
}
