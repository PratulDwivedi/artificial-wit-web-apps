'use client'
import { useEffect } from 'react'
import { useAppStore, type ProfileData } from '@/lib/store'
import { HttpHelper } from '@/lib/http'

interface Envelope {
  is_success: boolean
  data: ProfileData[]
}

export function AppBootstrap() {
  const { setProfile } = useAppStore()

  useEffect(() => {
    HttpHelper.rpc('fn_get_profile').then(({ data }) => {
      const env = data as unknown as Envelope
      const profile = env?.data?.[0]
      if (profile) setProfile(profile)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
