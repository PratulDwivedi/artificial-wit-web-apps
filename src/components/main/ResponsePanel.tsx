'use client'
import { useAppStore } from '@/lib/store'
import clsx from 'clsx'
import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

const respTabs = ['Response', 'Headers'] as const
type RespTab = typeof respTabs[number]

export function ResponsePanel() {
  const { responseData, responseStatus, responseTime, responseHeaders, isLoading, selectedEndpoint } = useAppStore()
  const [tab, setTab] = useState<RespTab>('Response')
  const [copied, setCopied] = useState(false)

  const copy = () => {
    if (responseData) {
      navigator.clipboard.writeText(responseData)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0" style={{ background: 'var(--c-panel)' }}>
      <div
        className="flex items-center justify-between px-2 border-b"
        style={{ background: 'var(--c-panel)', borderColor: 'var(--c-border)' }}
      >
        <div className="flex items-center">
          {respTabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={clsx('px-3 py-1.5 text-[11px] border-b-2 transition-colors',
                tab === t ? 'border-blue-500 text-blue-500' : 'border-transparent hover:text-[var(--c-t2)]'
              )}
              style={tab !== t ? { color: 'var(--c-t4)' } : undefined}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 pr-2">
          {responseStatus != null && (
            <span className={clsx('text-[10px] font-mono font-bold', responseStatus < 300 ? 'text-emerald-500' : 'text-red-500')}>
              {responseStatus}
            </span>
          )}
          {responseTime != null && (
            <span className="text-[10px]" style={{ color: 'var(--c-t4)' }}>{responseTime}ms</span>
          )}
          {responseData && (
            <button
              onClick={copy}
              className="transition-colors"
              style={{ color: 'var(--c-t4)' }}
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="text-[11px] animate-pulse" style={{ color: 'var(--c-t4)' }}>Sending request...</div>
          </div>
        )}

        {!isLoading && responseData == null && !selectedEndpoint && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
            <div className="text-[11px]" style={{ color: 'var(--c-t4)' }}>Select an endpoint from the sidebar to get started</div>
          </div>
        )}

        {!isLoading && responseData == null && selectedEndpoint && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-8">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
              style={{ background: 'var(--c-hover)' }}
            >
              <span className="text-lg">↗</span>
            </div>
            <div className="text-[12px]" style={{ color: 'var(--c-t3)' }}>Click Send to execute the request</div>
            <div className="text-[11px]" style={{ color: 'var(--c-t4)' }}>{selectedEndpoint.method} {selectedEndpoint.path}</div>
          </div>
        )}

        {!isLoading && responseData != null && tab === 'Response' && (
          <pre className="p-3 text-[11px] font-mono whitespace-pre-wrap leading-relaxed overflow-x-auto" style={{ color: 'var(--c-t2)' }}>
            {(() => {
              try { return JSON.stringify(JSON.parse(responseData), null, 2) }
              catch { return responseData }
            })()}
          </pre>
        )}

        {tab === 'Headers' && responseData != null && (
          responseHeaders && Object.keys(responseHeaders).length > 0 ? (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b sticky top-0"
                  style={{ borderColor: 'var(--c-border)', background: 'var(--c-panel)' }}>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]"
                    style={{ color: 'var(--c-t5)' }}>Name</th>
                  <th className="px-4 py-2 text-left font-semibold uppercase tracking-wider text-[10px]"
                    style={{ color: 'var(--c-t5)' }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(responseHeaders).map(([k, v]) => (
                  <tr key={k} className="border-b hover:bg-[var(--c-hover)]"
                    style={{ borderColor: 'var(--c-border)' }}>
                    <td className="px-4 py-2 font-mono" style={{ color: 'var(--c-primary)' }}>{k}</td>
                    <td className="px-4 py-2 font-mono break-all" style={{ color: 'var(--c-t2)' }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-3" style={{ color: 'var(--c-t4)' }}>No headers returned.</div>
          )
        )}

      </div>
    </div>
  )
}
