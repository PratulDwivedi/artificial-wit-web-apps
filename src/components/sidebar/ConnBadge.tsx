'use client'

export type McpStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

const LABELS: Record<McpStatus, string> = {
  disconnected: 'Disconnected',
  connecting:   'Connecting…',
  connected:    'Connected',
  error:        'Connection error',
}

const DOT_COLOR: Record<McpStatus, string> = {
  disconnected: '#9ca3af',
  connecting:   '#f59e0b',
  connected:    '#22c55e',
  error:        '#ef4444',
}

interface Props {
  status: McpStatus
}

export default function ConnBadge({ status }: Props) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--c-t4)' }}>
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ background: DOT_COLOR[status] ?? '#9ca3af' }}
      />
      <span>{LABELS[status] ?? status}</span>
    </div>
  )
}
