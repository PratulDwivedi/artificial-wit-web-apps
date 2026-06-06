import type { ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** View title shown in the header bar */
  title?: string
  /** Optional subtitle / description below the title */
  subtitle?: string
  /** Slot for header-right actions (buttons, badges, etc.) */
  actions?: ReactNode
  /** Skip the default body padding — useful when the view manages its own layout */
  noPadding?: boolean
  children: ReactNode
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewContainer
//
// Opt-in wrapper for views under app/views/.
// Import and use this in any view that needs the standard header + body shell.
// Views with their own full-screen UI (e.g. visualize) skip it entirely.
//
// Usage:
//   import ViewContainer from '@/components/views/ViewContainer'
//
//   export default function MyView() {
//     return (
//       <ViewContainer title="My View" subtitle="Showing results">
//         <p>content here</p>
//       </ViewContainer>
//     )
//   }
// ─────────────────────────────────────────────────────────────────────────────

export default function ViewContainer({
  title,
  subtitle,
  actions,
  noPadding = false,
  children,
}: Props) {
  return (
    <div className="vc-root">

      {/* Header — only rendered when title or actions are provided */}
      {(title || actions) && (
        <div className="vc-header">
          <div className="vc-header-left">
            {title    && <h1 className="vc-title">{title}</h1>}
            {subtitle && <p  className="vc-subtitle">{subtitle}</p>}
          </div>
          {actions && (
            <div className="vc-header-actions">{actions}</div>
          )}
        </div>
      )}

      {/* Body */}
      <div className={noPadding ? 'vc-body vc-body-bare' : 'vc-body'}>
        {children}
      </div>

    </div>
  )
}
