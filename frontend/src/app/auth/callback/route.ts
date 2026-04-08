
import { createClient } from '@/lib/supabase/server'
import { normalizeNextPath, resolveExternalOrigin } from '@/lib/auth/navigation'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const origin = resolveExternalOrigin(request.url, request.headers)
    const code = searchParams.get('code')
    const next = normalizeNextPath(searchParams.get('next'))

    if (code) {
        const supabase = createClient()
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
            return NextResponse.redirect(`${origin}${next}`)
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/login?error=Could not authenticate user`)
}
