'use client'
import { create } from 'zustand'

/** Pick the startup route for the current product from route_name_web.
 *  Handles both the legacy string shape and the new { apps, admin, … } object shape. */
export function resolveStartupRoute(
  routeNameWeb: string | Record<string, string> | null | undefined
): string | null {
  if (!routeNameWeb) return null
  if (typeof routeNameWeb === 'string') return routeNameWeb
  const product = process.env.NEXT_PUBLIC_PRODUCT_NAME
  return (product ? routeNameWeb[product] : null) ?? Object.values(routeNameWeb)[0] ?? null
}


export interface ProfileData {
  id: number
  email: string
  user_id: string
  user_name: string
  full_name?: string | null
  tenant_id: number
  tenant: {
    id: number
    code: string
    name: string
    data?: {
      logo_url?:        string | null
      datetime_format?: string
      time_zone?:       string
      currency?:        string
      currency_symbol?: string
    } | null
  }
  data: {
    profile_pic?: string | null
    route_name_web?: string | Record<string, string> | null
    route_name_mobile?: string | null
    is_admin?: boolean
    currency?: string
    currency_symbol?: string
    language?: string
    datetime_format?: string
    time_zone?: string
    mobile_no?: number
    show_editor?: boolean
    is_edit_mode?: boolean
  }
}

interface AppState {
  userEmail:      string | null
  userName:       string | null
  fullName:       string | null
  profilePic:     string | null
  tenantName:     string | null
  tenantLogoUrl:  string | null
  startupRoute:   string | null
  sidebarOpen:    boolean
  editMode:       boolean
  canEditMode:    boolean
  datetimeFormat: string | null
  timeZone:       string | null
  currency:       string | null
  currencySymbol: string | null

  setUserEmail:     (email: string | null) => void
  setUserName:      (name: string | null)  => void
  setProfilePic:    (url: string | null)   => void
  setTenantName:    (n: string | null)     => void
  setTenantLogoUrl: (url: string | null)   => void
  setStartupRoute:  (route: string | null) => void
  setSidebarOpen:   (open: boolean)        => void
  setEditMode:      (v: boolean)           => void
  setProfile:       (profile: ProfileData) => void
}

export const useAppStore = create<AppState>((set) => ({
  userEmail:      null,
  userName:       null,
  fullName:       null,
  profilePic:     null,
  tenantName:     null,
  tenantLogoUrl:  null,
  startupRoute:   null,
  sidebarOpen:    false,
  editMode:       false,
  canEditMode:    false,
  datetimeFormat: null,
  timeZone:       null,
  currency:       null,
  currencySymbol: null,

  setUserEmail:     (email)  => set({ userEmail: email }),
  setUserName:      (name)   => set({ userName: name }),
  setProfilePic:    (url)    => set({ profilePic: url }),
  setTenantName:    (n)      => set({ tenantName: n }),
  setTenantLogoUrl: (url)    => set({ tenantLogoUrl: url }),
  setStartupRoute:  (route)  => set({ startupRoute: route }),
  setSidebarOpen:   (open)   => set({ sidebarOpen: open }),
  setEditMode:      (v)      => set({ editMode: v }),

  // Convenience: set all profile fields at once
  setProfile: (p) => set({
    userEmail:      p.email ?? null,
    userName:       p.user_name ?? null,
    fullName:       p.full_name ?? null,
    profilePic:     p.data?.profile_pic ?? null,
    tenantName:     p.tenant?.name ?? null,
    tenantLogoUrl:  p.tenant?.data?.logo_url ?? null,
    startupRoute:   resolveStartupRoute(p.data?.route_name_web),
    canEditMode:    p.data?.show_editor === true,
    datetimeFormat: p.tenant?.data?.datetime_format ?? p.data?.datetime_format ?? null,
    timeZone:       p.tenant?.data?.time_zone       ?? p.data?.time_zone       ?? null,
    currency:       p.tenant?.data?.currency        ?? p.data?.currency        ?? null,
    currencySymbol: p.tenant?.data?.currency_symbol ?? p.data?.currency_symbol ?? null,
  }),
}))
