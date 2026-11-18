import 'expo-sqlite/localStorage/install';

import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

/**
 * Cliente do backend (Supabase). A URL e a publishable key vêm do .env.local
 * (veja .env.example). A sessão do usuário fica salva no aparelho com o
 * localStorage do expo-sqlite, então o login continua valendo offline.
 */
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const isSupabaseConfigured = supabaseUrl.length > 0 && supabasePublishableKey.length > 0;

export const supabase = createClient(supabaseUrl || 'http://localhost', supabasePublishableKey || 'nao-configurado', {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Renova o token só com o app em primeiro plano (recomendação do Supabase para mobile).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
