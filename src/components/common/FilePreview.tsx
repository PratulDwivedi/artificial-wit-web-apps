'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, FileText } from 'lucide-react'

interface Props {
  url:      string
  filename: string
  onClose:  () => void
}

function ext(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? ''
}

function isImage(f: string) {
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext(f))
}

function isPdf(f: string) {
  return ext(f) === 'pdf'
}

export function FilePreview({ url, filename, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const shortName = filename.split('/').pop() ?? filename

  const body = isImage(filename) ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={shortName}
      className="max-w-full max-h-full object-contain rounded-xl"
      style={{ maxHeight: 'calc(85vh - 56px)' }}
    />
  ) : isPdf(filename) ? (
    <iframe
      src={url}
      title={shortName}
      className="w-full rounded-b-xl"
      style={{ height: 'calc(85vh - 56px)', border: 'none' }}
    />
  ) : (
    <div className="flex flex-col items-center justify-center gap-4 py-16 px-8">
      <FileText size={48} style={{ color: 'var(--c-t4)' }} />
      <p className="text-[14px] text-center" style={{ color: 'var(--c-t2)' }}>{shortName}</p>
      <a href={url} download={shortName} target="_blank" rel="noreferrer"
        className="flex items-center gap-2 px-5 py-2.5 btn-primary rounded-xl text-[13px] font-semibold">
        <Download size={14} /> Download
      </a>
    </div>
  )

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="relative flex flex-col rounded-2xl border shadow-2xl overflow-hidden"
        style={{
          background: 'var(--c-panel)',
          borderColor: 'var(--c-border)',
          maxWidth: isImage(filename) ? '90vw' : '80vw',
          width: isPdf(filename) ? '80vw' : 'auto',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b shrink-0"
          style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)' }}>
          <p className="text-[13px] font-medium truncate max-w-[60vw]" style={{ color: 'var(--c-t2)' }}>
            {shortName}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <a href={url} download={shortName} target="_blank" rel="noreferrer"
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t4)' }} title="Download">
              <Download size={14} />
            </a>
            <button onClick={onClose}
              className="p-1.5 rounded-lg transition hover:bg-[var(--c-hover)]"
              style={{ color: 'var(--c-t4)' }}>
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`flex items-center justify-center${isImage(filename) ? ' p-4' : ''}`}>
          {body}
        </div>
      </div>
    </div>,
    document.body
  )
}
