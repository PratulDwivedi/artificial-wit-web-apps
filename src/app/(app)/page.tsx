'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { HttpHelper } from '@/lib/http'
import { resolveStartupRoute } from '@/lib/store'
import type { ProfileData } from '@/lib/store'

interface Envelope {
  is_success: boolean
  data: ProfileData[]
}

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    HttpHelper.rpc('fn_get_profile')
      .then(({ data }) => {
        const env   = data as unknown as Envelope
        const route = resolveStartupRoute(env?.data?.[0]?.data?.route_name_web)
        router.replace(route ? `/${route}` : '/dashboard')
      })
      .catch(() => {
        router.replace('/dashboard')
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="h-full flex items-center justify-center" style={{ background: 'var(--c-base)' }}>
      <Loader2 size={22} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  )
}
