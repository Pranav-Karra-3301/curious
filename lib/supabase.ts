import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client for server-side operations with elevated privileges
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

export interface Question {
  id: string
  question: string
  created_at: string
  used_at?: string
  is_current: boolean
}