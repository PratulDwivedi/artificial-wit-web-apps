'use client'

import { useRef, useEffect } from 'react'

interface Props {
  html: string
  className?: string
  style?: React.CSSProperties
}

export function HtmlParser({ html, className = '', style }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const autoSize = () => {
      try {
        const body = iframe.contentDocument?.body
        if (body) iframe.style.height = `${body.scrollHeight + 8}px`
      } catch { /* cross-origin fallback */ }
    }

    iframe.addEventListener('load', autoSize)
    // Fallback for content that loads sub-resources after the load event
    const t = setTimeout(autoSize, 300)
    return () => { iframe.removeEventListener('load', autoSize); clearTimeout(t) }
  }, [html])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      title="HTML content"
      className={className}
      style={{ width: '100%', minHeight: '60px', border: 'none', display: 'block', ...style }}
      sandbox="allow-same-origin allow-scripts allow-forms"
    />
  )
}
