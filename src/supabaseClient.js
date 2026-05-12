import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase ENV fehlt. Bitte .env.local nach .env.example anlegen.')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
