'use client'

/**
 * Shell — main client-side app container.
 *
 * Fully self-contained: fetches its own profile and artifact data via API routes
 * (no server-only imports). This ensures next/headers never bleeds into the
 * client bundle.
 *
 * Data flow:
 *   mount → GET /api/profile  → has credentials?
 *     yes → GET /api/mcp/discover → connected?
 *       yes → GET /api/artifacts → build nav → load first artifact
 *       no  → show not-connected overlay
 *     no → show not-connected overlay (prompt settings)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { HttpHelper } from '@/lib/http'
import SidebarArtifacts, { type Artifact } from '@/components/sidebar/SidebarArtifacts'
import NotConnected from '@/components/content/NotConnected'
import EmptyState from '@/components/content/EmptyState'
import Loader from '@/components/content/Loader'
import ArtifactModal from '@/components/artifacts/ArtifactModal'
import { PromptsPage } from '@/components/prompts/PromptsPage'
import type { McpStatus } from '@/components/sidebar/ConnBadge'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Overlay = 'loader' | 'not-connected' | 'empty' | 'none'

interface UserInfo {
  fullName: string | null
  email:    string
}

// ─────────────────────────────────────────────────────────────────────────────
// Shell
// ─────────────────────────────────────────────────────────────────────────────

export default function Shell() {
  const router = useRouter()

  // ── State ─────────────────────────────────────────────────────────────────
  const [mcpStatus,        setMcpStatus]        = useState<McpStatus>('disconnected')
  const [artifacts,        setArtifacts]        = useState<Artifact[]>([])
  const [currentArtifact,  setCurrentArtifact]  = useState<string>('')
  const [currentTitle,     setCurrentTitle]     = useState<string>('Artificial Wit')
  const [overlay,          setOverlay]          = useState<Overlay>('loader')
  const [refreshing,       setRefreshing]       = useState(false)
  const [user,             setUser]             = useState<UserInfo>({ fullName: null, email: '' })
  const [settingsOpen,     setSettingsOpen]     = useState(false) // kept for NotConnected prop
  const [artifactModal,    setArtifactModal]    = useState(false)
  const [activeSection,    setActiveSection]    = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('s') : null
  )

  const iframeRef       = useRef<HTMLIFrameElement>(null)

  function navigateSection(section: string | null) {
    setActiveSection(section)
    const url = section ? `/?s=${section}` : '/'
    window.history.pushState({}, '', url)
  }
  const refreshCooldown = useRef(false)
  const lastAutoRefresh = useRef(0)

  // ── Artifact fetching ─────────────────────────────────────────────────────
  const loadArtifacts = useCallback(async (): Promise<Artifact[]> => {
    try {
      const res  = await fetch('/api/artifacts')
      const data = await res.json()

      if (data.success && Array.isArray(data.artifacts) && data.artifacts.length > 0) {
        setArtifacts(data.artifacts)
        return data.artifacts
      }
    } catch {
      // network error — treat as empty
    }

    setArtifacts([])
    setCurrentArtifact('')
    setCurrentTitle('Artificial Wit')
    if (iframeRef.current) iframeRef.current.src = 'about:blank'
    setOverlay('empty')
    return []
  }, [])

  // ── Navigate to artifact ──────────────────────────────────────────────────
  const navigateTo = useCallback((artifact: Artifact) => {
    setCurrentArtifact(artifact.id)
    setCurrentTitle(artifact.title)
    setOverlay('loader')
    // Proxy the artifact HTML through our API route so the server can inject
    // x-api-key — browsers cannot add custom headers to iframe navigation.
    const proxyUrl = `/api/artifacts/html?url=${encodeURIComponent(artifact.url)}`
    if (iframeRef.current) iframeRef.current.src = proxyUrl
  }, [])

  // ── Refresh ───────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    if (refreshCooldown.current || mcpStatus !== 'connected') return
    refreshCooldown.current = true
    setRefreshing(true)

    const prevId = currentArtifact
    const list   = await loadArtifacts()

    if (list.length > 0) {
      const stillExists = list.find(a => a.id === prevId)
      if (stillExists) {
        setCurrentArtifact(prevId)  // restore active highlight
      } else {
        navigateTo(list[0])         // prev artifact gone — go to first
      }
    }

    setTimeout(() => {
      setRefreshing(false)
      refreshCooldown.current = false
    }, 600)
  }, [mcpStatus, currentArtifact, loadArtifacts, navigateTo])

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      // 1. Fetch profile + API key status in parallel
      try {
        const [profileResult, keyResult] = await Promise.all([
          HttpHelper.rpc<{ user_name: string; email: string }[]>('fn_get_profile'),
          HttpHelper.rpc<{ x_api_key: string | null }[]>('fn_get_api_key'),
        ])

        if (!profileResult.data?.is_success) {
          router.push('/login')
          return
        }

        const profile = profileResult.data.data?.[0]
        setUser({ fullName: profile?.user_name ?? null, email: profile?.email ?? '' })

        const hasApiKey = !!(keyResult.data?.is_success && keyResult.data.data?.[0]?.x_api_key)
        if (!hasApiKey) {
          setMcpStatus('disconnected')
          setOverlay('not-connected')
          return
        }
      } catch {
        setMcpStatus('error')
        setOverlay('not-connected')
        return
      }

      // 2. Probe MCP server connectivity
      setMcpStatus('connecting')
      setOverlay('loader')

      try {
        const discoverRes  = await fetch('/api/mcp/discover')
        const discoverData = await discoverRes.json()

        if (!discoverData.success) {
          setMcpStatus('error')
          setOverlay('not-connected')
          return
        }
      } catch {
        setMcpStatus('error')
        setOverlay('not-connected')
        return
      }

      // 3. Connected — load artifact manifest and open first artifact
      setMcpStatus('connected')
      const list = await loadArtifacts()
      if (list.length > 0) navigateTo(list[0])
    }

    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auto-refresh on window focus (30s cooldown) ───────────────────────────
  useEffect(() => {
    function onFocus() {
      const now = Date.now()
      if (now - lastAutoRefresh.current > 30_000 && mcpStatus === 'connected') {
        lastAutoRefresh.current = now
        handleRefresh()
      }
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [mcpStatus, handleRefresh])

  // ── postMessage bridge — window.cowork shim for iframe artifacts ─────────
  // The injected cowork shim sends {type:'mcp:call', tool, args, requestId}
  // via postMessage. We proxy the call server-side (API key stays on server)
  // and post the result back to the iframe.
  useEffect(() => {
    async function handleMessage(event: MessageEvent) {
      if (event.data?.type !== 'mcp:call') return

      // Only accept messages from our own origin (the proxied iframe is same-origin)
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

  // ── Iframe load events ────────────────────────────────────────────────────
  function onIframeLoad() {
    // Only hide loader if we actually loaded a proxied artifact (not about:blank)
    const src = iframeRef.current?.src ?? ''
    if (src && src !== 'about:blank' && !src.endsWith('about:blank')) {
      setOverlay('none')
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="shell">
      <ArtifactModal open={artifactModal} onClose={() => setArtifactModal(false)} onSaved={handleRefresh} />

      <SidebarArtifacts
        mcpStatus={mcpStatus}
        artifacts={artifacts}
        currentArtifact={currentArtifact}
        onArtifactClick={navigateTo}
        onRefresh={handleRefresh}
        refreshing={refreshing}
        onManageArtifacts={() => setArtifactModal(true)}
      />

      <div className="content">
        {/* Topbar */}
        <div className="topbar">
          <span className="topbar-title">
            {activeSection === 'prompts' ? 'Prompts' : currentTitle}
          </span>
        </div>

        {/* Section pages */}
        {activeSection === 'prompts' && <PromptsPage />}

        {/* Artifact area — hidden when a section page is active */}
        {!activeSection && (
          <>
            {overlay === 'loader'        && <Loader message={mcpStatus === 'connecting' ? 'Connecting to server…' : 'Loading…'} />}
            {overlay === 'not-connected' && <NotConnected onOpenSettings={() => setSettingsOpen(true)} />}
            {overlay === 'empty'         && <EmptyState onRefresh={handleRefresh} />}
            <iframe
              ref={iframeRef}
              className="artifact-frame"
              style={{ display: overlay === 'none' ? 'block' : 'none' }}
              sandbox="allow-scripts allow-forms allow-same-origin"
              onLoad={onIframeLoad}
              title={currentTitle}
            />
          </>
        )}
      </div>
    </div>
  )
}
