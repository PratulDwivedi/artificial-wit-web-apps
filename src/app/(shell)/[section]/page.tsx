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

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  return resolveLocalPage(section) ?? <DynamicPage routeName={section} />
}
