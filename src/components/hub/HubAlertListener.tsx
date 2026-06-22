'use client'

import { useEffect } from 'react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useHub } from '@/context/NotificationHubContext'
import type { HubNotification } from '@/lib/hub'

function formatEvent(event: string): string {
  return event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

// data can be an object or an array — normalise to the first object
function firstObject(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null
  if (Array.isArray(data)) {
    const first = data[0]
    return first && typeof first === 'object' && !Array.isArray(first)
      ? (first as Record<string, unknown>)
      : null
  }
  return data as Record<string, unknown>
}

function extractMessage(data: unknown): string | undefined {
  const d = firstObject(data)
  if (!d) return undefined
  const text = d.name ?? d.message ?? d.msg
  return typeof text === 'string' ? text : undefined
}

function buildUrl(event: string, data: unknown): string {
  const d = firstObject(data)
  const id = d?.id
  return id != null ? `/${event}?id=${id}` : `/${event}`
}

export function HubAlertListener() {
  const { on } = useHub()
  const router  = useRouter()

  useEffect(() => {
    const off = on('*', (raw) => {
      const msg         = raw as unknown as HubNotification
      const title       = formatEvent(msg.event)
      const description = extractMessage(msg.data)

      if (msg.channel || msg.user_id) {
        // event = route name → navigate to /{event} or /{event}?id={id}
        const url = buildUrl(msg.event, msg.data)
        toast(title, {
          description,
          action: { label: 'View', onClick: () => router.push(url) },
        })
      } else {
        // broadcast — tenant-wide alert, no navigation
        toast.warning(title, { description })
      }
    })
    return off
  }, [on, router])

  return null
}
