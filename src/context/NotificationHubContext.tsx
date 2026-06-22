'use client'

import {
  createContext, useCallback, useContext,
  useEffect, useRef, useState,
  type ReactNode,
} from 'react'
import type { EventHandler } from '@/lib/hub'
import { HttpHelper } from '@/lib/http'

interface HubContextValue {
  isConnected: boolean
  connectionId: string | null
  subscribe:   (channel: string) => void
  unsubscribe: (channel: string) => void
  on:          (event: string, handler: EventHandler) => () => void
}

const HubContext = createContext<HubContextValue | null>(null)

export function NotificationHubProvider({ children }: { children: ReactNode }) {
  const wsRef           = useRef<WebSocket | null>(null)
  const handlersRef     = useRef<Map<string, Set<EventHandler>>>(new Map())
  const reconnectTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pingTimer       = useRef<ReturnType<typeof setInterval> | null>(null)
  const retryCount      = useRef(0)
  const mountedRef      = useRef(true)

  const [isConnected, setIsConnected] = useState(false)
  const [connectionId, setConnectionId] = useState<string | null>(null)

  const connect = useCallback(() => {
    if (!mountedRef.current) return
    const token = HttpHelper.getToken()
    if (!token) return

    const base = process.env.NEXT_PUBLIC_AW_API_BASE_URL!.replace(/^http/, 'ws')
    const ws   = new WebSocket(`${base}/hub/ws?token=${token}`)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) { ws.close(); return }
      retryCount.current = 0
      setIsConnected(true)
      pingTimer.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 'ping' }))
        }
      }, 30_000)
    }

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data as string)
      if (msg.type === 'connected') {
        setConnectionId(msg.connection_id)
      } else if (msg.type === 'notification') {
        handlersRef.current.get(msg.event)?.forEach(h => h(msg.data))
        handlersRef.current.get('*')?.forEach(h => h(msg))
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      setConnectionId(null)
      clearInterval(pingTimer.current!)
      if (!mountedRef.current) return
      // Exponential backoff: 1s → 2s → 4s → … → 30s max
      const delay = Math.min(1_000 * 2 ** retryCount.current, 30_000)
      retryCount.current += 1
      reconnectTimer.current = setTimeout(connect, delay)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    mountedRef.current = true
    connect()
    return () => {
      mountedRef.current = false
      clearTimeout(reconnectTimer.current!)
      clearInterval(pingTimer.current!)
      wsRef.current?.close()
    }
  }, [connect])

  const subscribe = useCallback((channel: string) => {
    wsRef.current?.send(JSON.stringify({ action: 'subscribe', channel }))
  }, [])

  const unsubscribe = useCallback((channel: string) => {
    wsRef.current?.send(JSON.stringify({ action: 'unsubscribe', channel }))
  }, [])

  const on = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set())
    }
    handlersRef.current.get(event)!.add(handler)
    return () => handlersRef.current.get(event)?.delete(handler)
  }, [])

  return (
    <HubContext.Provider value={{ isConnected, connectionId, subscribe, unsubscribe, on }}>
      {children}
    </HubContext.Provider>
  )
}

export function useHub(): HubContextValue {
  const ctx = useContext(HubContext)
  if (!ctx) throw new Error('useHub must be used inside NotificationHubProvider')
  return ctx
}
