import { Image } from 'expo-image';
import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type AuthLayoutProps = PropsWithChildren<{ title: string; subtitle: string }>;

/** Moldura das telas de login e primeiro acesso, com a logomarca da Casa. */
export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  const theme = useTheme();
  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.inner}>
            <Image
              source={require('@/assets/images/logo-csds.png')}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="Logomarca da Casa São Domingos Sávio"
            />
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.titles}>
                <AppText variant="title" accessibilityRole="header">
                  {title}
                </AppText>
                <AppText variant="caption">{subtitle}</AppText>
              </View>
              {children}
            </View>
            <AppText variant="caption" style={styles.footer}>
              Dados armazenados apenas neste dispositivo.
            </AppText>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  inner: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: 20 },
  logo: { width: '100%', height: 170 },
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: 20, gap: 16 },
  titles: { gap: 4 },
  footer: { textAlign: 'center' },
});
