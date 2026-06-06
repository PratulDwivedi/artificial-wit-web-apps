'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Loader2, LayoutDashboard } from 'lucide-react'
import SidebarArtifacts, { type Artifact } from '@/components/sidebar/SidebarArtifacts'
import ArtifactModal from './ArtifactModal'
import type { McpStatus } from '@/components/sidebar/ConnBadge'

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyPane({ onManage }: { onManage: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center px-8">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--c-hover)' }}>
        <LayoutDashboard size={28} style={{ color: 'var(--c-t5)' }} />
      </div>
      <div>
        <p className="text-[15px] font-semibold" style={{ color: 'var(--c-t1)' }}>No artifacts yet</p>
        <p className="text-[12px] mt-1 max-w-xs" style={{ color: 'var(--c-t4)' }}>
          Upload HTML dashboards and connect them to your MCP server to view them here.
        </p>
      </div>
      <button onClick={onManage}
        className="px-4 py-2 btn-primary text-[12px] font-medium rounded-xl transition">
        Manage Artifacts
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export function ArtifactsPage() {
  const [mcpStatus,       setMcpStatus]       = useState<McpStatus>('connecting')
  const [artifacts,       setArtifacts]       = useState<Artifact[]>([])
  const [currentArtifact, setCurrentArtifact] = useState<string>('')
  const [currentTitle,    setCurrentTitle]    = useState<string>('')
  const [iframeLoading,   setIframeLoading]   = useState(false)
  const [refreshing,      setRefreshing]      = useState(false)
  const [manageOpen,      setManageOpen]      = useState(false)

  const iframeRef       = useRef<HTMLIFrameElement>(null)
  const refreshCooldown = useRef(false)

  // ── Load artifacts ─────────────────────────────────────────────────────────

  const loadArtifacts = useCallback(async (): Promise<Artifact[]> => {
    try {
      const res  = await fetch('/api/artifacts')
      const data = await res.json()
      if (data.success && Array.isArray(data.artifacts) && data.artifacts.length > 0) {
        setArtifacts(data.artifacts)
        setMcpStatus('connected')
        return data.artifacts
      }
    } catch { /* ignore */ }
    setArtifacts([])
    setMcpStatus('disconnected')
    return []
  }, [])

  // ── Navigate to artifact ───────────────────────────────────────────────────

  const navigateTo = useCallback((artifact: Artifact) => {
    setCurrentArtifact(artifact.id)
    setCurrentTitle(artifact.title)
    setIframeLoading(true)
    const proxyUrl = `/api/artifacts/html?url=${encodeURIComponent(artifact.url)}`
    if (iframeRef.current) iframeRef.current.src = proxyUrl
  }, [])

  // ── Refresh ────────────────────────────────────────────────────────────────

  const handleRefresh = useCallback(async () => {
    if (refreshCooldown.current) return
    refreshCooldown.current = true
    setRefreshing(true)
    const prevId = currentArtifact
    const list   = await loadArtifacts()
    if (list.length > 0) {
      const still = list.find(a => a.id === prevId)
      if (still) setCurrentArtifact(prevId)
      else navigateTo(list[0])
    }
    setTimeout(() => { setRefreshing(false); refreshCooldown.current = false }, 600)
  }, [currentArtifact, loadArtifacts, navigateTo])

  // ── Init ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadArtifacts().then(list => {
      if (list.length > 0) navigateTo(list[0])
    })
  }, [loadArtifacts, navigateTo])

  // ── postMessage bridge for iframe MCP calls ────────────────────────────────

  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'mcp:call') return
      if (event.origin !== window.location.origin) return
      const { tool, args, requestId } = event.data
      try {
        const res    = await fetch('/api/mcp/call', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ tool, args }),
        })
        const result = await res.json()
        ;(event.source as Window)?.postMessage(
          { type: 'mcp:result', requestId, result },
          window.location.origin
        )
      } catch (err) {
        ;(event.source as Window)?.postMessage(
          { type: 'mcp:result', requestId, result: { is_success: false, error: String(err) } },
          window.location.origin
        )
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0 h-full overflow-hidden">

      {/* Left artifact sidebar */}
      <SidebarArtifacts
        mcpStatus={mcpStatus}
        artifacts={artifacts}
        currentArtifact={currentArtifact}
        onArtifactClick={navigateTo}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onManageArtifacts={() => setManageOpen(true)}
      />

      {/* Right content */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden"
        style={{ background: 'var(--c-panel)' }}>

        {/* Content area */}
        <div className="flex-1 min-h-0 relative overflow-hidden">

          {/* Loading spinner */}
          {iframeLoading && currentArtifact && (
            <div className="absolute inset-0 flex items-center justify-center z-10"
              style={{ background: 'var(--c-panel)' }}>
              <Loader2 size={22} className="animate-spin" style={{ color: 'var(--c-t5)' }} />
            </div>
          )}

          {/* Empty state */}
          {!currentArtifact && (
            <EmptyPane onManage={() => setManageOpen(true)} />
          )}

          {/* Artifact iframe */}
          {currentArtifact && (
            <iframe
              ref={iframeRef}
              className="w-full h-full border-0"
              style={{ display: iframeLoading ? 'none' : 'block' }}
              sandbox="allow-scripts allow-forms allow-same-origin"
              onLoad={() => setIframeLoading(false)}
              title={currentTitle}
            />
          )}
        </div>
      </div>

      {/* Manage artifacts modal */}
      <ArtifactModal
        open={manageOpen}
        onClose={() => setManageOpen(false)}
        onSaved={handleRefresh}
      />
    </div>
  )
}
