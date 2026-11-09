import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cnjdlsubebzjttetpaxy.supabase.co';
const supabaseKey = 'sb_publishable_sGs7aYSSWdV9uA7xi_4Iww_LD2IoSs9';

export const supabase = createClient(supabaseUrl, supabaseKey);