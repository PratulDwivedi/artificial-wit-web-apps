'use client'
import type { HttpMethod } from '@/lib/types'
import clsx from 'clsx'

const colors: Record<string, string> = {
  GET: 'text-emerald-400',
  POST: 'text-amber-400',
  PUT: 'text-blue-400',
  PATCH: 'text-purple-400',
  DELETE: 'text-red-400',
  MCP: 'text-cyan-400',
}

export function MethodBadge({ method, size = 'sm' }: { method: string; size?: 'xs' | 'sm' }) {
  return (
    <span className={clsx('font-bold font-mono', colors[method] ?? 'text-gray-400', size === 'xs' ? 'text-[9px]' : 'text-[10px]')}>
      {method}
    </span>
  )
}
