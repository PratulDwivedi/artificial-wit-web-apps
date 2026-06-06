'use client'
import { useAppStore } from '@/lib/store'
import type { ApiData, Endpoint, Collection } from '@/lib/types'
import { MethodBadge } from '@/components/ui/MethodBadge'
import { ChevronDown, ChevronRight, Shield, Cpu, Zap, FolderOpen, Folder, Plus, Search, Filter } from 'lucide-react'
import clsx from 'clsx'

const iconMap: Record<string, React.ReactNode> = {
  shield: <Shield size={11} />,
  cpu: <Cpu size={11} />,
  zap: <Zap size={11} />,
}

function EndpointRow({ ep }: { ep: Endpoint }) {
  const { selectedEndpoint, setSelectedEndpoint } = useAppStore()
  const isSelected = selectedEndpoint?.id === ep.id
  return (
    <button
      onClick={() => setSelectedEndpoint(ep)}
      className="w-full flex items-center gap-1.5 px-3 py-[3px] text-left rounded-sm group transition-colors"
      style={{ background: isSelected ? 'var(--c-active)' : undefined }}
      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--c-hover)' }}
      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '' }}
    >
      <MethodBadge method={ep.method} size="xs" />
      <span
        className="text-[11px] truncate"
        style={{ color: isSelected ? 'var(--c-t1)' : 'var(--c-t3)' }}
      >
        {ep.name}
      </span>
    </button>
  )
}

function CollectionTree({ collection }: { collection: Collection }) {
  const { expandedCollections, expandedGroups, toggleCollection, toggleGroup } = useAppStore()
  const isOpen = expandedCollections.has(collection.id)

  return (
    <div>
      <button
        onClick={() => toggleCollection(collection.id)}
        className="w-full flex items-center gap-1.5 px-2 py-[5px] rounded-sm text-left transition-colors hover:bg-[var(--c-hover)]"
      >
        {isOpen
          ? <ChevronDown size={10} className="shrink-0" style={{ color: 'var(--c-t4)' }} />
          : <ChevronRight size={10} className="shrink-0" style={{ color: 'var(--c-t4)' }} />}
        <span className="shrink-0" style={{ color: 'var(--c-t3)' }}>
          {iconMap[collection.icon] ?? <Folder size={11} />}
        </span>
        <span className="text-[11px] font-medium truncate" style={{ color: 'var(--c-t2)' }}>
          {collection.name}
        </span>
      </button>
      {isOpen && (
        <div className="ml-3">
          {collection.groups.map((group) => {
            const groupOpen = expandedGroups.has(group.id)
            return (
              <div key={group.id}>
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-1.5 px-2 py-[4px] rounded-sm text-left transition-colors hover:bg-[var(--c-hover)]"
                >
                  {groupOpen
                    ? <FolderOpen size={10} className="shrink-0" style={{ color: 'var(--c-t4)' }} />
                    : <Folder size={10} className="shrink-0" style={{ color: 'var(--c-t4)' }} />}
                  <span className="text-[11px] truncate" style={{ color: 'var(--c-t3)' }}>
                    {group.name}
                  </span>
                </button>
                {groupOpen && (
                  <div className="ml-2">
                    {group.endpoints.map((ep) => (
                      <EndpointRow key={ep.id} ep={ep} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar({ data }: { data: ApiData }) {
  return (
    <aside
      className="flex flex-col w-[220px] min-w-[220px] border-r h-full"
      style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--c-t2)' }}>
            APIs
          </span>
          <div className="flex items-center gap-1">
            <button
              className="p-0.5 rounded transition-colors hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t3)' }}
            >
              <Filter size={11} />
            </button>
            <button
              className="p-0.5 rounded transition-colors hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t3)' }}
            >
              <Plus size={11} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-t4)' }} />
          <input
            type="text"
            placeholder="Search..."
            className="w-full rounded text-[11px] pl-6 pr-2 py-1 focus:outline-none border"
            style={{
              background: 'var(--c-hover)',
              borderColor: 'var(--c-border-strong)',
              color: 'var(--c-t2)',
            }}
          />
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1 px-1">
        {data.collections.map((col) => (
          <CollectionTree key={col.id} collection={col} />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t px-3 py-2" style={{ borderColor: 'var(--c-border)' }}>
        <p className="text-[9px]" style={{ color: 'var(--c-t5)' }}>Artificial Wit API Doc</p>
      </div>
    </aside>
  )
}
