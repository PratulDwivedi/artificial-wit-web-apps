'use client'

import { useSearchParams } from 'next/navigation'
import { CodeTemplatePage } from './CodeTemplatePage'
import { CodeTemplateListPage } from './CodeTemplateListPage'

export function CodeTemplateShell() {
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  if (id) return <CodeTemplatePage />
  return <CodeTemplateListPage />
}
