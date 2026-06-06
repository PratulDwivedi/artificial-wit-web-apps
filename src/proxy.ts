import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const token = request.cookies.get('aw_token')?.value

  const isLoginPage = request.nextUrl.pathname.startsWith('/login')

  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return NextResponse.next({ request })
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logo|.*\\.png$).*)'],
}
