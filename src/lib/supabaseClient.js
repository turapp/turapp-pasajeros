import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/^["']|["']$/g, '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').replace(/^["']|["']$/g, '').trim();

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
