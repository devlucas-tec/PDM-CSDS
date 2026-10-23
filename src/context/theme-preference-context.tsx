import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';

import { getPreference, setPreference } from '@/database/preferences-repository';

export type ThemePreference = 'system' | 'light' | 'dark';

const PREFERENCE_KEY = 'tema';

type ThemePreferenceValue = {
  preference: ThemePreference;
  setThemePreference: (value: ThemePreference) => Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

function apply(preference: ThemePreference) {
  Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
}

/** Tema claro/escuro escolhido pelo usuário, salvo no SQLite para sobreviver ao fechamento do app. */
export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    getPreference(db, PREFERENCE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        setPreferenceState(saved);
        apply(saved);
      }
    });
  }, [db]);

  const setThemePreference = useCallback(
    async (value: ThemePreference) => {
      setPreferenceState(value);
      apply(value);
      await setPreference(db, PREFERENCE_KEY, value);
    },
    [db],
  );

  const value = useMemo(() => ({ preference, setThemePreference }), [preference, setThemePreference]);
  return <ThemePreferenceContext value={value}>{children}</ThemePreferenceContext>;
}

export function useThemePreference() {
  const context = use(ThemePreferenceContext);
  if (!context) throw new Error('useThemePreference deve ser usado dentro de <ThemePreferenceProvider>.');
  return context;
}
