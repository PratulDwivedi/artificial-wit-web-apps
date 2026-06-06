'use client'

interface Props {
  onRefresh: () => void
}

export default function EmptyState({ onRefresh }: Props) {
  return (
    <div className="overlay">
      <div className="nc-logo">📭</div>
      <div className="nc-title">No Artifacts Found</div>
      <div className="nc-sub">
        Your server is connected but no artifacts have been configured yet.
        Ask your admin to add artifacts via the server admin panel, then refresh.
      </div>
      <button className="nc-btn" onClick={onRefresh}>
        ↻ Refresh
      </button>
    </div>
  )
}
