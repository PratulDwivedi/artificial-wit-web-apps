/**
 * Protected app layout — minimal server component.
 * Auth is enforced by middleware.ts (checks session on every request).
 * Profile fetching and MCP connectivity happen client-side via API routes
 * so that no server-only modules (next/headers) bleed into the client bundle.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
