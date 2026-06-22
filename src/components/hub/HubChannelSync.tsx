'use client'

import { useEffect, useRef } from 'react'
import { useHub } from '@/context/NotificationHubContext'
import { HttpHelper } from '@/lib/http'

interface PageItem {
  route_name: string
  children?: PageItem[]
}

function collectRoutes(items: PageItem[]): string[] {
  const out: string[] = []
  function walk(nodes: PageItem[]) {
    for (const n of nodes) {
      if (n.route_name) out.push(n.route_name)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(items)
  return out
}

export function HubChannelSync() {
  const { subscribe, unsubscribe, isConnected } = useHub()
  const subscribedRef = useRef<string[]>([])

  useEffect(() => {
    if (!isConnected) return

    HttpHelper.rpc<{ is_success: boolean; data: PageItem[] }>('fn_get_user_pages', {
      p_platform_id:  21,
      p_product_name: process.env.NEXT_PUBLIC_PRODUCT_NAME,
    }).then(({ data }) => {
      const env = data as unknown as { is_success: boolean; data: PageItem[] }
      if (!env?.is_success) return
      const routes = collectRoutes(env.data ?? [])
      subscribedRef.current = routes
      routes.forEach(r => subscribe(r))
    })

    return () => {
      subscribedRef.current.forEach(r => unsubscribe(r))
      subscribedRef.current = []
    }
  }, [isConnected, subscribe, unsubscribe])

  return null
}
