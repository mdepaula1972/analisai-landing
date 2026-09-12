import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Polyfill para evitar erro "native WebSocket not found" no Node.js 20
if (typeof global !== 'undefined' && !(global as any).WebSocket) {
  (global as any).WebSocket = class DummyWebSocket {};
}

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignorado em Server Components read-only
          }
        },
      },
    }
  );
}

// Cliente com service role para operações admin (API routes)
export function createServiceRoleClient() {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://vccpvhxcqshxiysawxtp.supabase.co';
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjY3B2aHhjcXNoeGl5c2F3eHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MjgxOTMsImV4cCI6MjA5NDUwNDE5M30.Ynqtf82s-XvDUi59-z1Z7osquZezdil812cAcoaZCAk';

  return createClient(
    url,
    key,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
