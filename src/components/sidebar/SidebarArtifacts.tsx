'use client'

import { RefreshCw, Settings2 } from 'lucide-react'
import ConnBadge, { type McpStatus } from './ConnBadge'

export interface Artifact {
  id:      string
  title:   string
  icon:    string
  section: string
  url:     string
}

interface Props {
  mcpStatus:          McpStatus
  artifacts:          Artifact[]
  currentArtifact:    string
  onArtifactClick:    (artifact: Artifact) => void
  onRefresh:          () => void
  refreshing:         boolean
  onManageArtifacts:  () => void
  userFullName?:      string | null
  userEmail?:         string
  onOpenSettings?:    () => void
}

export default function SidebarArtifacts({
  mcpStatus,
  artifacts,
  currentArtifact,
  onArtifactClick,
  onRefresh,
  refreshing,
  onManageArtifacts,
}: Props) {
  const sections: Record<string, Artifact[]> = {}
  for (const a of artifacts) {
    const sec = a.section || 'Dashboards'
    if (!sections[sec]) sections[sec] = []
    sections[sec].push(a)
  }

  return (
    <aside
      className="w-[240px] min-w-[240px] border-r flex flex-col h-full"
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
    >
      {/* Header */}
      <div className="px-3 py-3 border-b shrink-0" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[12px] font-semibold" style={{ color: 'var(--c-t1)' }}>
            Artifacts
          </span>
          <div className="flex items-center gap-2">
            <ConnBadge status={mcpStatus} />
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-1 rounded-md transition"
              style={{ color: 'var(--c-t4)' }}
              onMouseEnter={e => { if (!refreshing) e.currentTarget.style.background = 'var(--c-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.background = '' }}
              title={refreshing ? 'Refreshing…' : 'Refresh'}
            >
              <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <button
          onClick={onManageArtifacts}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[12px] font-medium text-white btn-primary transition-colors"
        >
          <Settings2 size={13} />
          Manage Artifacts
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-1 px-1">

        {/* Artifact sections */}
        {artifacts.length > 0 && (
          <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--c-t5)' }}>
            Dashboards
          </p>
        )}

        {Object.entries(sections).map(([section, items], sIdx) => (
          <div key={section}>
            {sIdx > 0 && (
              <p className="px-2 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--c-t5)' }}>
                {section}
              </p>
            )}
            {items.map(a => (
              <button
                key={a.id}
                onClick={() => onArtifactClick(a)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[12px] transition mb-0.5"
                style={{
                  background: currentArtifact === a.id ? 'var(--c-active)' : 'transparent',
                  color: currentArtifact === a.id ? 'var(--c-t1)' : 'var(--c-t3)',
                  fontWeight: currentArtifact === a.id ? 600 : undefined,
                }}
                onMouseEnter={e => { if (currentArtifact !== a.id) e.currentTarget.style.background = 'var(--c-hover)' }}
                onMouseLeave={e => { if (currentArtifact !== a.id) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{a.icon}</span>
                <span className="truncate text-left">{a.title}</span>
              </button>
            ))}
          </div>
        ))}

        {/* Skeleton while connecting */}
        {artifacts.length === 0 && mcpStatus === 'connecting' && (
          <div className="flex flex-col gap-1 px-1 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-8 rounded-lg animate-pulse"
                style={{ background: 'var(--c-hover)' }} />
            ))}
          </div>
        )}
      </nav>
    </aside>
  )
}
