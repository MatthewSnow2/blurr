import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Create a .env.local file in the root of your project and add these variables
// You can find these values in your Supabase project's API settings
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key are not defined. Please check your .env.local file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
