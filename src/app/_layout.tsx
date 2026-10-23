import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { ThemePreferenceProvider } from '@/context/theme-preference-context';
import { ToastProvider } from '@/context/toast-context';
import { DATABASE_NAME, migrateDatabase } from '@/database/schema';
import { useIsDark } from '@/hooks/use-theme';
import { canManageUsers, isGestor } from '@/lib/permissions';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <ThemePreferenceProvider>
        <AuthProvider>
          <NavigationTheme>
            <ToastProvider>
              <RootNavigator />
            </ToastProvider>
          </NavigationTheme>
        </AuthProvider>
      </ThemePreferenceProvider>
    </SQLiteProvider>
  );
}

function NavigationTheme({ children }: { children: React.ReactNode }) {
  const dark = useIsDark();
  const palette = dark ? Colors.dark : Colors.light;
  const base = dark ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
    },
  };
  return (
    <ThemeProvider value={theme}>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {children}
    </ThemeProvider>
  );
}

function RootNavigator() {
  const { user, ready, hasUsers } = useAuth();
  const dark = useIsDark();
  const palette = dark ? Colors.dark : Colors.light;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const gestor = isGestor(user?.perfil);
  const admin = canManageUsers(user?.perfil);

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: palette.surface },
        headerTintColor: palette.primary,
        headerTitleStyle: { color: palette.text, fontWeight: '700' },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: palette.background },
      }}>
      {/* Sem sessão: login, ou cadastro do primeiro administrador se o banco estiver vazio. */}
      <Stack.Protected guard={!user}>
        <Stack.Protected guard={hasUsers}>
          <Stack.Screen name="login" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!hasUsers}>
          <Stack.Screen name="primeiro-acesso" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack.Protected>

      {/* Com sessão ativa: telas comuns a todos os perfis. */}
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="aulas/[id]/index" options={{ title: 'Aula' }} />
        <Stack.Screen name="aulas/[id]/chamada" options={{ title: 'Lista de presença' }} />
        <Stack.Screen name="aulas/[id]/relatorio" options={{ title: 'Relatório de comportamento', presentation: 'modal' }} />

        {/* Coordenação e administração. */}
        <Stack.Protected guard={gestor}>
          <Stack.Screen name="alunos/novo" options={{ title: 'Novo aluno' }} />
          <Stack.Screen name="alunos/[id]/index" options={{ title: 'Ficha do aluno' }} />
          <Stack.Screen name="alunos/[id]/editar" options={{ title: 'Editar aluno' }} />
          <Stack.Screen name="alunos/[id]/historico" options={{ title: 'Novo registro', presentation: 'modal' }} />
          <Stack.Screen name="aulas/[id]/editar" options={{ title: 'Remarcar ou cancelar' }} />
          <Stack.Screen name="calendario/planejar" options={{ title: 'Planejar calendário' }} />
          <Stack.Screen name="oficinas/index" options={{ title: 'Oficinas' }} />
          <Stack.Screen name="oficinas/nova" options={{ title: 'Nova oficina' }} />
          <Stack.Screen name="oficinas/[id]" options={{ title: 'Editar oficina' }} />
          <Stack.Screen name="relatorios/[id]" options={{ title: 'Relatório' }} />
        </Stack.Protected>

        <Stack.Protected guard={admin}>
          <Stack.Screen name="usuarios/novo" options={{ title: 'Novo usuário' }} />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}
