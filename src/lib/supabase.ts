import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase environment variables missing! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
} else if (supabaseUrl.includes('vercel.app')) {
  console.error(
    `[Supabase Config Error] VITE_SUPABASE_URL is set to "${supabaseUrl}". It must be your Supabase project URL (https://<project-ref>.supabase.co), not your Vercel web address!`
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

