/**
 * Supabase client singleton.
 *
 * 1. Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values
 *    (Dashboard → Settings → API).
 * 2. We use AsyncStorage as the auth persistence layer so sessions survive
 *    app restarts automatically.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zforpxbowpiotzmoqeif.supabase.co';        // e.g. https://xyzcompany.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpmb3JweGJvd3Bpb3R6bW9xZWlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEwNzQ4OTUsImV4cCI6MjA4NjY1MDg5NX0.aTbcLBiYQzj_ddm5deTcMP9COZkIlCVQci744_azzFs'; // e.g. eyJhbGciOiJIUz...

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // not applicable in React Native
  },
});
