'use client'

interface Props {
  message?: string
}

export default function Loader({ message = 'Loading…' }: Props) {
  return (
    <div className="overlay">
      <div className="loader-spinner" />
      <p className="overlay-loader-text">{message}</p>
    </div>
  )
}
