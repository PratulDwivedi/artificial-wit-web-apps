'use client'

import { useEffect } from 'react'
import { useHub } from '@/context/NotificationHubContext'
import type { EventHandler } from '@/lib/hub'

/**
 * Subscribe to a hub channel for the lifetime of the component.
 * Re-subscribes automatically after a reconnect (via isConnected dependency).
 *
 * @example
 * useHubChannel('orders', {
 *   order_created: (data) => queryClient.invalidateQueries({ queryKey: ['orders'] }),
 * })
 */
export function useHubChannel(
  channel: string,
  handlers: Record<string, EventHandler>,
) {
  const { subscribe, unsubscribe, on, isConnected } = useHub()

  // Re-subscribe to the channel on each reconnect
  useEffect(() => {
    if (!isConnected) return
    subscribe(channel)
    return () => unsubscribe(channel)
  }, [channel, isConnected, subscribe, unsubscribe])

  // Register event handlers once per channel (survive reconnects)
  useEffect(() => {
    const cleanups = Object.entries(handlers).map(([event, handler]) =>
      on(event, handler),
    )
    return () => cleanups.forEach(cleanup => cleanup())
  // handlers intentionally excluded — callers should stabilise with useCallback
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, on])
}
