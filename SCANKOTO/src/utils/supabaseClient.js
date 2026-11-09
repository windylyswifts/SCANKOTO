import { createClient } from '@supabase/supabase-js';

// Clean code: Tries environment variables first, falls back to known working keys to prevent fatal crashes
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://cnjdlsubebzjttetpaxy.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sGs7aYSSWdV9uA7xi_4Iww_LD2IoSs9';

export const supabase = createClient(supabaseUrl, supabaseKey);