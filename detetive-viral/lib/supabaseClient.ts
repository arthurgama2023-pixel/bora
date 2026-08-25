import { createClient } from '@supabase/supabase-js';

// Fallback evita que o build do Next.js quebre quando as env vars não estão
// configuradas (ex: prerender de /_not-found não tem acesso a runtime env).
// Em produção real, configure NEXT_PUBLIC_SUPABASE_URL/ANON_KEY no Render.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
