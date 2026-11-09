import { useSQLiteContext } from 'expo-sqlite';
import { createContext, use, useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { Appearance } from 'react-native';

import { getPreference, setPreference } from '@/database/preferences-repository';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ThemePreference = 'system' | 'light' | 'dark';

const PREFERENCE_KEY = 'tema';

type ThemePreferenceValue = {
  preference: ThemePreference;
  /** Tema efetivo: a escolha do usuário ou, em "Sistema", o tema do aparelho. */
  colorScheme: 'light' | 'dark';
  setThemePreference: (value: ThemePreference) => Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreferenceValue | null>(null);

/**
 * No Android/iOS, repassa a escolha ao sistema para que componentes nativos
 * (abas, alertas, teclado) também troquem de tema. Na web o `Appearance` não
 * tem `setColorScheme`, então só o tema calculado no contexto é usado.
 */
function applyNative(preference: ThemePreference) {
  if (typeof Appearance.setColorScheme !== 'function') return;
  try {
    Appearance.setColorScheme(preference === 'system' ? 'unspecified' : preference);
  } catch {
    // Sem override nativo, o app continua usando o tema calculado no contexto.
  }
}

/** Tema claro/escuro escolhido pelo usuário, salvo no SQLite para sobreviver ao fechamento do app. */
export function ThemePreferenceProvider({ children }: PropsWithChildren) {
  const db = useSQLiteContext();
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');

  useEffect(() => {
    let active = true;
    getPreference(db, PREFERENCE_KEY)
      .then((saved) => {
        if (!active) return;
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setPreferenceState(saved);
          applyNative(saved);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [db]);

  const setThemePreference = useCallback(
    async (value: ThemePreference) => {
      setPreferenceState(value);
      applyNative(value);
      await setPreference(db, PREFERENCE_KEY, value);
    },
    [db],
  );

  // Com override nativo ativo, o useColorScheme já devolve a escolha; na web,
  // é a preferência salva que decide.
  const colorScheme: 'light' | 'dark' =
    preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const value = useMemo(
    () => ({ preference, colorScheme, setThemePreference }),
    [preference, colorScheme, setThemePreference],
  );
  return <ThemePreferenceContext value={value}>{children}</ThemePreferenceContext>;
}

export function useThemePreference() {
  const context = use(ThemePreferenceContext);
  if (!context) throw new Error('useThemePreference deve ser usado dentro de <ThemePreferenceProvider>.');
  return context;
}
