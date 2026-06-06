import { notFound } from 'next/navigation'
import { KbPage } from '@/components/kb/KbPage'
import { GlobalVariablesPage } from '@/components/vars/GlobalVariablesPage'
import { LLMPage } from '@/components/llm/LLMPage'
import { CredentialsPage } from '@/components/credentials/CredentialsPage'
import { ApiConfigsPage } from '@/components/api-configs/ApiConfigsPage'
import { PromptsPage } from '@/components/prompts/PromptsPage'
import { ResourcesPage } from '@/components/resources/ResourcesPage'
import { AgentsPage } from '@/components/agents/AgentsPage'
import { ConnectorsPage } from '@/components/connectors/ConnectorsPage'
import { ArtifactsPage } from '@/components/artifacts/ArtifactsPage'
import { ProfilePage } from '@/components/profile/ProfilePage'
import { SettingsPage } from '@/components/settings/SettingsPage'
import { ChatPage } from '@/components/chat/ChatPage'
import { ToolTestPage } from '@/components/main/MainArea'

const VALID_SECTIONS = new Set([
  'chat', 'knowledge-base', 'agents', 'credentials', 'tool-test',
  'llm', 'variables', 'api-configs', 'prompts', 'resources',
  'connectors', 'artifacts', 'profile', 'settings',
])

export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params

  if (!VALID_SECTIONS.has(section)) notFound()

  switch (section) {
    case 'chat':          return <ChatPage />
    case 'knowledge-base': return <KbPage />
    case 'llm':           return <LLMPage />
    case 'variables':     return <GlobalVariablesPage />
    case 'credentials':   return <CredentialsPage />
    case 'api-configs':   return <ApiConfigsPage />
    case 'prompts':       return <PromptsPage />
    case 'resources':     return <ResourcesPage />
    case 'agents':        return <AgentsPage />
    case 'connectors':    return <ConnectorsPage />
    case 'artifacts':     return <ArtifactsPage />
    case 'profile':       return <ProfilePage />
    case 'settings':      return <SettingsPage />
    case 'tool-test':     return <ToolTestPage />
    default:              return notFound()
  }
}
