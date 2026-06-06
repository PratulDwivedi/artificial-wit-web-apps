'use client'
import { create } from 'zustand'

export type SectionId =
  | 'chat' | 'knowledge-base' | 'agents'
  | 'llm' | 'prompts' | 'profile' | 'settings'

interface AppState {
  userEmail:      string | null
  userName:       string | null
  profilePic:     string | null
  tenantName:     string | null
  tenantLogoUrl:  string | null

  setUserEmail:     (email: string | null) => void
  setUserName:      (name: string | null)  => void
  setProfilePic:    (url: string | null)   => void
  setTenantName:    (n: string | null)     => void
  setTenantLogoUrl: (url: string | null)   => void
}

export const useAppStore = create<AppState>((set) => ({
  userEmail:     null,
  userName:      null,
  profilePic:    null,
  tenantName:    null,
  tenantLogoUrl: null,

  setUserEmail:     (email) => set({ userEmail: email }),
  setUserName:      (name)  => set({ userName: name }),
  setProfilePic:    (url)   => set({ profilePic: url }),
  setTenantName:    (n)     => set({ tenantName: n }),
  setTenantLogoUrl: (url)   => set({ tenantLogoUrl: url }),
}))
