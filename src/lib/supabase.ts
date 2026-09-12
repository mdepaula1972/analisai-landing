import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vccpvhxcqshxiysawxtp.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZjY3B2aHhjcXNoeGl5c2F3eHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5MjgxOTMsImV4cCI6MjA5NDUwNDE5M30.Ynqtf82s-XvDUi59-z1Z7osquZezdil812cAcoaZCAk';

export function createClient() {
  return createBrowserClient(url, key);
}

// Singleton para uso em client components
export const supabase = createClient();
