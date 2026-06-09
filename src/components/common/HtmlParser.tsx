'use client'

interface Props {
  html: string
  className?: string
  style?: React.CSSProperties
}

export function HtmlParser({ html, className = '', style }: Props) {
  return (
    <div
      className={`prose prose-sm max-w-none text-[13px] ${className}`}
      style={style}
      dangerouslySetInnerHTML={{ __html: html }} // eslint-disable-line react/no-danger
    />
  )
}
