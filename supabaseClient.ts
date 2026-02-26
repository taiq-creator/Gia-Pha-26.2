import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://byulldrwnnxuoeihlsdr.supabase.co'
const supabaseKey = 'sb_publishable_tQTQGJ7OM5AUk2wXvSYRqA_gfJ8GXeJ'

export const supabase = createClient(supabaseUrl, supabaseKey)