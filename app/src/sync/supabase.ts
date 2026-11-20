import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

/** Public project settings: these are meant to ship inside the app (access is controlled by the database rules). */
export const SUPABASE_URL = 'https://ugkdzuanjmbqenbzrelg.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_4eAhBW66Iv3Mu0TT-gCUSQ_jhZrIQqF';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/** Where links in sign-up and password emails open: straight into the app. */
export const AUTH_REDIRECT = 'forewheels://auth-callback';
