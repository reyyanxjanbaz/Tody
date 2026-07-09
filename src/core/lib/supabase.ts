/**
 * Supabase client singleton.
 *
 * Credentials are loaded from ./env (git-ignored).
 * Copy src/lib/env.example.ts → src/lib/env.ts and fill in your values
 * from Supabase Dashboard → Settings → API.
 */
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './env';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // not applicable in React Native
  },
});
