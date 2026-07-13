import { Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { ProfilePage } from '@/components/profile/ProfilePage'
import { TenantPage } from '@/components/profile/TenantPage'
import { UserPage } from '@/components/profile/UserPage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { DynamicPage } from '@/components/dynamic/DynamicPage'
import { TemplatePage } from '@/components/template/TemplatePage'
import { CodeTemplateShell } from '@/components/code-template/CodeTemplateShell'
import { BillingPage } from '@/components/billing/BillingPage'
import { DealsKanbanPage } from '@/components/crm/DealsKanbanPage'
import { Account360Page } from '@/components/crm/Account360Page'
import { CrmDashboardPage } from '@/components/crm/CrmDashboardPage'

function resolveLocalPage(section: string): React.ReactNode | null {
  switch (section) {
    case 'profile':       return <ProfilePage />
    case 'tenant':        return <TenantPage />
    case 'user':          return <UserPage />
    case 'settings':      return <SettingsPage />
    case 'billing':       return <BillingPage />
    case 'template':      return <TemplatePage />
    case 'code_template': return <CodeTemplateShell />
    case 'deals':          return <DealsKanbanPage />
    // 'leads' and 'accounts' are DB-configured dynamic pages (panel mode) — fall through to DynamicPage
    case 'account_detail': return <Account360Page />
    case 'crm_dashboard': return <CrmDashboardPage />
    default:              return null
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
      <DynamicPage key={section} routeName={section} />
    </Suspense>
  )
}
