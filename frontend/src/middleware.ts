
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { buildLoginPath } from '@/lib/auth/navigation'

const PROTECTED_PATH_PREFIXES = ['/contribute', '/memory', '/chat']

function requiresAuth(request: NextRequest): boolean {
    const { pathname, searchParams } = request.nextUrl

    if (PROTECTED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return true
    }

    return pathname === '/' && searchParams.get('mode') === 'communicate'
}

export async function middleware(request: NextRequest) {
    let response = NextResponse.next({
        request: {
            headers: request.headers,
        },
    })

    // Create Supabase Client
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return request.cookies.getAll()
                },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        request.cookies.set(name, value)
                    })
                    response = NextResponse.next({
                        request,
                    })
                    cookiesToSet.forEach(({ name, value, options }) => {
                        response.cookies.set(name, value, options)
                    })
                },
            },
        }
    )

    // Refresh Session if expired
    const { data: { user } } = await supabase.auth.getUser()

    if (requiresAuth(request) && !user) {
        const loginUrl = request.nextUrl.clone()
        const nextValue = `${request.nextUrl.pathname}${request.nextUrl.search}`
        const loginPath = buildLoginPath(nextValue)
        loginUrl.pathname = '/login'
        loginUrl.search = loginPath.includes('?') ? loginPath.slice(loginPath.indexOf('?')) : ''
        return NextResponse.redirect(loginUrl)
    }

    return response
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
    ],
}
