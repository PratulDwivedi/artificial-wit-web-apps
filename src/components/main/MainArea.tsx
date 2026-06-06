'use client'
import { useState, useRef, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { TopBar } from './TopBar'
import { RequestPanel } from './RequestPanel'
import { ResponsePanel } from './ResponsePanel'
import { McpPanel, McpCallBuilderArea } from './McpPanel'
import { MethodBadge } from '@/components/ui/MethodBadge'
import Image from 'next/image'
import clsx from 'clsx'
import { Tag, Link2 } from 'lucide-react'

// ── REST/MCP view toggle ──────────────────────────────────────────────────────
function ViewToggle() {
  const { viewMode, setViewMode, selectedEndpoint } = useAppStore()
  if (!selectedEndpoint) return null
  return (
    <div className="flex items-center gap-0.5 rounded p-0.5 border"
      style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
      <button onClick={() => setViewMode('rest')}
        className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
        style={{ background: viewMode === 'rest' ? 'var(--c-active)' : undefined, color: viewMode === 'rest' ? 'var(--c-t1)' : 'var(--c-t4)' }}>
        REST
      </button>
      <button onClick={() => setViewMode('mcp')}
        className="px-2.5 py-1 rounded text-[10px] font-medium transition-colors"
        style={viewMode === 'mcp'
          ? { background: 'var(--c-primary-light)', color: 'var(--c-primary)' }
          : { color: 'var(--c-t4)' }}>
        MCP
      </button>
    </div>
  )
}

// ── Endpoint detail header ────────────────────────────────────────────────────
function EndpointHeader() {
  const { selectedEndpoint } = useAppStore()
  if (!selectedEndpoint) return null
  return (
    <div className="px-4 py-2.5 border-b shrink-0"
      style={{ background: 'var(--c-topbar)', borderColor: 'var(--c-border)' }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {selectedEndpoint.description ? (
            <p className="text-[13px] truncate" style={{ color: 'var(--c-t2)' }}>
              {selectedEndpoint.description}
            </p>
          ) : (
            <h2 className="text-[13px] font-medium truncate" style={{ color: 'var(--c-t1)' }}>
              {selectedEndpoint.name}
            </h2>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0" />
      </div>
    </div>
  )
}

// ── API welcome (no endpoint selected) ───────────────────────────────────────
function ApiWelcome() {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
      <div className="w-24 h-24 rounded-2xl overflow-hidden shadow-lg">
        <Image src="/logo.png" alt="AW API Doc" width={96} height={96} className="w-full h-full object-cover" priority />
      </div>
      <div>
        <h3 className="text-[16px] font-semibold mb-1.5" style={{ color: 'var(--c-t1)' }}>
          Artificial Wit Assist
        </h3>
        <p className="text-[12px] max-w-sm" style={{ color: 'var(--c-t4)' }}>
          Select an endpoint from the sidebar to view docs, test REST calls, or invoke MCP tools
        </p>
      </div>
      <div className="flex gap-3 mt-1">
        {['REST APIs', 'MCP Tools', 'Resources'].map(f => (
          <div key={f} className="px-3 py-1.5 rounded text-[10px] border"
            style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border)', color: 'var(--c-t4)' }}>
            {f}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Resizable MCP split (request top / response bottom) ───────────────────────
function McpSplitLayout() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [topPx, setTopPx] = useState<number | null>(null)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const { top, height } = containerRef.current.getBoundingClientRect()
      setTopPx(Math.max(80, Math.min(height - 80, ev.clientY - top)))
    }
    const onUp = () => {
      dragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col flex-1 min-h-0 overflow-hidden select-none">
      <div className="flex flex-col overflow-hidden"
        style={{ flexBasis: topPx ?? '45%', flexGrow: 0, flexShrink: 0, minHeight: 80 }}>
        <McpCallBuilderArea />
      </div>

      <div
        onMouseDown={onMouseDown}
        className="group shrink-0 flex items-center justify-center cursor-row-resize transition-colors"
        style={{ height: 8, background: 'var(--c-border)' }}
        title="Drag to resize">
        <div className="flex gap-0.5 transition-opacity opacity-40 group-hover:opacity-100">
          {[0,1,2].map(i => <div key={i} className="w-5 h-0.5 rounded-full" style={{ background: 'var(--c-t3)' }} />)}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <ResponsePanel />
      </div>
    </div>
  )
}

// ── Tool Test page ────────────────────────────────────────────────────────────
export function ToolTestPage() {
  const { selectedEndpoint, viewMode } = useAppStore()

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden" style={{ background: 'var(--c-panel)' }}>
      {viewMode === 'rest' && <TopBar />}
      {viewMode === 'mcp' ? <McpSplitLayout /> : (
        !selectedEndpoint ? <ApiWelcome /> : (
          <>
            <EndpointHeader />
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto" style={{ maxHeight: '45%' }}>
                <RequestPanel />
              </div>
              <ResponsePanel />
            </div>
          </>
        )
      )}
    </div>
  )
}
