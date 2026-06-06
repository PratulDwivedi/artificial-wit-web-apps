'use client'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { Eye, Pencil } from 'lucide-react'

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h1: ({ children }) => <h1 className="text-[16px] font-bold mb-2 mt-3" style={{ color: 'var(--c-t1)' }}>{children}</h1>,
  h2: ({ children }) => <h2 className="text-[14px] font-bold mb-1.5 mt-3" style={{ color: 'var(--c-t1)' }}>{children}</h2>,
  h3: ({ children }) => <h3 className="text-[13px] font-semibold mb-1 mt-2" style={{ color: 'var(--c-t1)' }}>{children}</h3>,
  p:  ({ children }) => <p  className="text-[13px] leading-relaxed mb-2" style={{ color: 'var(--c-t2)' }}>{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 mb-2 space-y-0.5" style={{ color: 'var(--c-t2)' }}>{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 mb-2 space-y-0.5" style={{ color: 'var(--c-t2)' }}>{children}</ol>,
  li: ({ children }) => <li className="text-[13px] leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold" style={{ color: 'var(--c-t1)' }}>{children}</strong>,
  em: ({ children }) => <em className="italic" style={{ color: 'var(--c-t3)' }}>{children}</em>,
  code: ({ children, className }) => {
    const isBlock = className?.includes('language-')
    return isBlock
      ? <code className="block rounded-lg px-3 py-2 text-[12px] font-mono mb-2 overflow-x-auto"
          style={{ background: 'var(--c-panel)', color: 'var(--c-t2)', border: '1px solid var(--c-border)' }}>{children}</code>
      : <code className="rounded px-1.5 py-0.5 text-[12px] font-mono"
          style={{ background: 'var(--c-panel)', color: 'var(--c-primary)', border: '1px solid var(--c-border)' }}>{children}</code>
  },
  pre: ({ children }) => <pre className="mb-2">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 pl-3 my-2 italic"
      style={{ borderColor: 'var(--c-primary)', color: 'var(--c-t3)' }}>
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3" style={{ borderColor: 'var(--c-border)' }} />,
}

interface MarkdownEditorProps {
  value: string
  onChange: (v: string) => void
  label?: string
  placeholder?: string
  rows?: number
  minHeight?: string
}

export default function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder = 'Write markdown here…',
  rows = 10,
  minHeight = '200px',
}: MarkdownEditorProps) {
  const [preview, setPreview] = useState(false)

  const inputStyle = {
    background:  'var(--c-hover)',
    borderColor: 'var(--c-border-strong)',
    color:       'var(--c-t1)',
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Label row + toggle */}
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: 'var(--c-t4)' }}>
            {label}
          </label>
        )}
        <div className="flex items-center gap-0.5 rounded-lg border p-0.5 ml-auto"
          style={{ background: 'var(--c-hover)', borderColor: 'var(--c-border-strong)' }}>
          {([{ id: 'write', Icon: Pencil }, { id: 'preview', Icon: Eye }] as const).map(({ id, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setPreview(id === 'preview')}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition capitalize"
              style={{
                background: (id === 'preview') === preview ? 'var(--c-active)' : 'transparent',
                color:      (id === 'preview') === preview ? 'var(--c-t1)'     : 'var(--c-t4)',
              }}>
              <Icon size={11} />
              {id}
            </button>
          ))}
        </div>
      </div>

      {/* Write */}
      {!preview && (
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          rows={rows}
          placeholder={placeholder}
          className="w-full rounded-xl px-3 py-2.5 text-[13px] border focus:outline-none transition resize-y"
          style={{ ...inputStyle, minHeight }}
        />
      )}

      {/* Preview */}
      {preview && (
        <div className="w-full rounded-xl px-4 py-3 border overflow-y-auto"
          style={{ ...inputStyle, minHeight }}>
          {value ? (
            <ReactMarkdown components={MD_COMPONENTS}>{value}</ReactMarkdown>
          ) : (
            <span className="text-[13px] italic" style={{ color: 'var(--c-t5)' }}>Nothing to preview.</span>
          )}
        </div>
      )}
    </div>
  )
}
