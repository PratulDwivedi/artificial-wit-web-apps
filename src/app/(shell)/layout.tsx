import { Suspense } from 'react'
import { AppBootstrap } from '@/components/AppBootstrap'
import { DynamicSidebar } from '@/components/sidebar/DynamicSidebar'
import { NotificationHubProvider } from '@/context/NotificationHubContext'
import { HubAlertListener } from '@/components/hub/HubAlertListener'
import { HubChannelSync } from '@/components/hub/HubChannelSync'

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationHubProvider>
      <HubAlertListener />
      <HubChannelSync />
      <div className="flex h-full overflow-hidden">
        <AppBootstrap />
        <DynamicSidebar />
        <Suspense fallback={null}>
          {children}
        </Suspense>
      </div>
    </NotificationHubProvider>
  )
}
