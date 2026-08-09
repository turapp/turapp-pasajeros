import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-project.supabase.co').replace(/^["']|["']$/g, '').trim();
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzM3NDcsImV4cCI6MjEwMTUwOTc0N30.placeholder').replace(/^["']|["']$/g, '').trim();

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
