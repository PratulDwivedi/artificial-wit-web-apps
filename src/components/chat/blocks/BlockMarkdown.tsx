'use client'

import ReactMarkdown from 'react-markdown'
import type { MarkdownBlock } from './types'

export default function BlockMarkdown({ block }: { block: MarkdownBlock }) {
  return <MarkdownContent content={block.content} />
}

export function MarkdownContent({ content }: { content: string }) {
  if (!content?.trim()) return null
  return (
    <div className="markdown-body text-[13px] leading-relaxed" style={{ color: 'var(--c-t1)' }}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-[18px] font-bold mt-3 mb-1.5" style={{ color: 'var(--c-t1)' }}>{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-[15px] font-bold mt-2.5 mb-1" style={{ color: 'var(--c-t1)' }}>{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[13px] font-semibold mt-2 mb-1" style={{ color: 'var(--c-t1)' }}>{children}</h3>
          ),
          p: ({ children }) => (
            <p className="mb-1.5 last:mb-0">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold" style={{ color: 'var(--c-t1)' }}>{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic" style={{ color: 'var(--c-t2)' }}>{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-1.5 space-y-0.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-1.5 space-y-0.5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[13px]">{children}</li>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-')
            return isBlock ? (
              <pre className="rounded-lg px-4 py-3 my-2 overflow-x-auto text-[12px] font-mono"
                style={{ background: 'var(--c-hover)', border: '1px solid var(--c-border)', color: 'var(--c-t2)' }}>
                <code>{children}</code>
              </pre>
            ) : (
              <code className="px-1.5 py-0.5 rounded text-[12px] font-mono"
                style={{ background: 'var(--c-hover)', color: 'var(--c-primary)' }}>
                {children}
              </code>
            )
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 my-2 italic"
              style={{ borderColor: 'var(--c-primary)', color: 'var(--c-t3)' }}>
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-3" style={{ borderColor: 'var(--c-border)' }} />
          ),
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80 transition"
              style={{ color: 'var(--c-primary)' }}>
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-[12px] border-collapse"
                style={{ borderColor: 'var(--c-border)' }}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide border"
              style={{ borderColor: 'var(--c-border)', background: 'var(--c-topbar)', color: 'var(--c-t4)' }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-1.5 border" style={{ borderColor: 'var(--c-border)', color: 'var(--c-t2)' }}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
