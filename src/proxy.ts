import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  try {
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vccpvhxcqshxiysawxtp.supabase.co';
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjY3B2aHhjcXNoeGl5c2F3eHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MjgxOTMsImV4cCI6MjA5NDUwNDE5M30.Ynqtf82s-XvDUi59-z1Z7osquZezdil812cAcoaZCAk';

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Atualiza a sessão Supabase se houver cookies de autenticação
    await supabase.auth.getUser();
  } catch {
    // Falha silenciosa para não bloquear requisições
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
