import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { ProfilePage } from '@/components/profile/ProfilePage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { DynamicPage } from '@/components/dynamic/DynamicPage'

function resolveLocalPage(section: string): React.ReactNode | null {
  switch (section) {
    case 'profile':  return <ProfilePage />
    case 'settings': return <SettingsPage />
    default:         return null
  }
}

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: 'var(--c-base)' }}>
      <Loader2 size={20} className="animate-spin" style={{ color: 'var(--c-t4)' }} />
    </div>
  )
}

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  const local = resolveLocalPage(section)
  if (local) return local
  return (
    <Suspense fallback={<PageLoader />}>
      <DynamicPage routeName={section} />
    </Suspense>
  )
}
