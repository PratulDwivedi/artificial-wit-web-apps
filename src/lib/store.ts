'use client'
import { create } from 'zustand'

export type SectionId =
  | 'chat' | 'knowledge-base' | 'agents'
  | 'llm' | 'prompts' | 'profile' | 'settings'

export interface ProfileData {
  id: number
  email: string
  user_id: string
  user_name: string
  tenant_id: number
  tenant: {
    id: number
    code: string
    name: string
    data?: { logo_url?: string | null }
  }
  data: {
    profile_pic?: string | null
    route_name_web?: string | null
    route_name_mobile?: string | null
    is_admin?: boolean
    currency?: string
    currency_symbol?: string
    language?: string
    datetime_format?: string
    mobile_no?: number
    show_editor?: boolean
    is_edit_mode?: boolean
  }
}

interface AppState {
  userEmail:      string | null
  userName:       string | null
  profilePic:     string | null
  tenantName:     string | null
  tenantLogoUrl:  string | null
  startupRoute:   string | null

  setUserEmail:     (email: string | null) => void
  setUserName:      (name: string | null)  => void
  setProfilePic:    (url: string | null)   => void
  setTenantName:    (n: string | null)     => void
  setTenantLogoUrl: (url: string | null)   => void
  setStartupRoute:  (route: string | null) => void
  setProfile:       (profile: ProfileData) => void
}

export const useAppStore = create<AppState>((set) => ({
  userEmail:     null,
  userName:      null,
  profilePic:    null,
  tenantName:    null,
  tenantLogoUrl: null,
  startupRoute:  null,

  setUserEmail:     (email)  => set({ userEmail: email }),
  setUserName:      (name)   => set({ userName: name }),
  setProfilePic:    (url)    => set({ profilePic: url }),
  setTenantName:    (n)      => set({ tenantName: n }),
  setTenantLogoUrl: (url)    => set({ tenantLogoUrl: url }),
  setStartupRoute:  (route)  => set({ startupRoute: route }),

  // Convenience: set all profile fields at once
  setProfile: (p) => set({
    userEmail:     p.email ?? null,
    userName:      p.user_name ?? null,
    profilePic:    p.data?.profile_pic ?? null,
    tenantName:    p.tenant?.name ?? null,
    tenantLogoUrl: p.tenant?.data?.logo_url ?? null,
    startupRoute:  p.data?.route_name_web ?? null,
  }),
}))
