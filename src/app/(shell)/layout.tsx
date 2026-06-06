import { Suspense } from 'react'
import { AppBootstrap } from '@/components/AppBootstrap'
import { DynamicSidebar } from '@/components/sidebar/DynamicSidebar'

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      <AppBootstrap userEmail={null} />
      <DynamicSidebar />
      <Suspense fallback={null}>
        {children}
      </Suspense>
    </div>
  )
}
