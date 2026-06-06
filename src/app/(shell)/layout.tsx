import { Suspense } from 'react'
import { AppBootstrap } from '@/components/AppBootstrap'
import { AppSidebar } from '@/components/sidebar/AppSidebar'
import { ApiPanel } from '@/components/sidebar/ApiPanel'

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <AppBootstrap userEmail={null} />
      <AppSidebar />
      <ApiPanel />
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </div>
  )
}
