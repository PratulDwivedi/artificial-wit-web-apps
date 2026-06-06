'use client'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function useEditParam() {
  const router   = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const editId = searchParams.get('id') // null | 'new' | '3' | '12'

  const openEdit = (id: number | 'new') => {
    router.push(`${pathname}?id=${id}`)
  }

  const closeEdit = () => {
    router.replace(pathname)
  }

  return { editId, openEdit, closeEdit }
}
