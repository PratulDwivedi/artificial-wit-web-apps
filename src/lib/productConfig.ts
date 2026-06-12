import {
  CalendarDays, Users, Mic2, Building2, BarChart3,
  Brain, Sparkles, Workflow,
  ShieldCheck, Settings2, KeyRound,
  Boxes, Ticket, Wrench,
  type LucideIcon,
} from 'lucide-react'

export interface ProductFeature {
  icon: LucideIcon
  title: string
  description: string
}

export interface ProductConfig {
  appName: string
  appTagline: string
  headline: string
  subheadline: string
  logo: string
  features: ProductFeature[]
}

const CONFIGS: Record<string, ProductConfig> = {

  seminar: {
    appName:     'Seminar Management',
    appTagline:  'One workspace for events, delegates, speakers, sponsors and reporting.',
    headline:    'Everything your seminar needs',
    subheadline: 'Plan events, track delegates and drive revenue — all in one place.',
    logo:        '/logo.png',
    features: [
      { icon: CalendarDays, title: 'Events',               description: 'Plan, schedule and manage every seminar end-to-end.' },
      { icon: Users,        title: 'Delegates',             description: 'Track registrations, categories and attendance.' },
      { icon: Mic2,         title: 'Speakers & Sessions',   description: 'Curate themes, abstracts and the daily agenda.' },
      { icon: Building2,    title: 'Sponsors & Exhibitors', description: 'Manage partner companies and booth allocations.' },
      { icon: BarChart3,    title: 'Reports',               description: 'Insights on attendance, engagement and revenue.' },
    ],
  },

  apps: {
    appName:     'Artificial Wit Apps',
    appTagline:  'Your Intelligent Enterprise Assistant',
    headline:    'Everything your business needs',
    subheadline: 'A workspace for AI-powered features, knowledge and operations.',
    logo:        '/logo.png',
    features: [
      { icon: Boxes,  title: 'Asset Management',  description: 'Track and manage IT assets across your organisation.' },
      { icon: Ticket, title: 'Ticket Management', description: 'Resolve issues faster with a unified helpdesk.' },
      { icon: Wrench, title: 'Operations',        description: 'Streamline workflows and day-to-day processes.' },
    ],
  },

  admin: {
    appName:     'Artificial Wit Admin',
    appTagline:  'Platform Administration',
    headline:    'Manage your platform',
    subheadline: 'Configure tenants, users, permissions and system settings in one place.',
    logo:        '/logo.png',
    features: [
      { icon: Users,      title: 'User Management', description: 'Manage users, roles and access across the platform.' },
      { icon: ShieldCheck,title: 'Permissions',     description: 'Fine-grained access control for every resource.' },
      { icon: Settings2,  title: 'Configuration',   description: 'Configure platform settings, themes and integrations.' },
      { icon: KeyRound,   title: 'Security',        description: 'Audit logs, session management and auth policies.' },
    ],
  },

  ai: {
    appName:     'Artificial Wit AI',
    appTagline:  'Intelligence for the enterprise',
    headline:    'AI-powered enterprise intelligence',
    subheadline: 'Harness AI to automate workflows, generate insights and assist your team.',
    logo:        '/logo.png',
    features: [
      { icon: Brain,     title: 'Chat',           description: 'Conversational AI assistant for everyday workflows.' },
      { icon: Boxes,     title: 'Knowledge Base', description: "Centralize and search your organization's knowledge." },
      { icon: Workflow,  title: 'Connectors',     description: 'Integrate with the tools and data sources you rely on.' },
      { icon: Settings2, title: 'Configuration',  description: 'LLMs, agents, API credentials, variables and more.' },
      { icon: Sparkles,  title: 'Live Artifacts', description: 'Claude AI live artifacts.' },
    ],
  },

}

const FALLBACK: ProductConfig = CONFIGS.apps

export function getProductConfig(): ProductConfig {
  const product = process.env.NEXT_PUBLIC_PRODUCT_NAME
  return (product && CONFIGS[product]) ? CONFIGS[product] : FALLBACK
}
