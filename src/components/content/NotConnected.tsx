'use client'

interface Props {
  onOpenSettings: () => void
}

export default function NotConnected({ onOpenSettings }: Props) {
  return (
    <div className="overlay">
      <div className="nc-logo">🤖</div>
      <div className="nc-title">Welcome to Artificial Wit</div>
      <div className="nc-sub">
        Connect your Artificial Wit server to start managing artifacts and monitoring usage. uploading artifacts to see insights, and more.
      </div>

      <div className="nc-steps">
        <div className="nc-step">
          <div className="nc-step-num">1</div>
          <div className="nc-step-body">
            <strong>Open Settings</strong>
            <span>Click the button below or use ⚙️ Settings in the sidebar.</span>
          </div>
        </div>
      </div>

      <button className="nc-btn" onClick={onOpenSettings}>
        ⚙️ Open Settings
      </button>
    </div>
  )
}
