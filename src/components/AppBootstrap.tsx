'use client'
import { useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { HttpHelper } from '@/lib/http'

export function AppBootstrap({ userEmail }: { userEmail: string | null }) {
  const { setUserEmail } = useAppStore()

  useEffect(() => {
    setUserEmail(userEmail)
  }, [])

  return null
}
