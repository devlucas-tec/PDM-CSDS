import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TabHeaderProps = {
  overline?: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children?: ReactNode;
};

/** Cabeçalho das telas de aba (as abas nativas não têm barra de título). */
export function TabHeader({ overline, title, subtitle, right, children }: TabHeaderProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrapper, { paddingTop: insets.top + 12, backgroundColor: theme.background }]}>
      <View style={styles.inner}>
        <View style={styles.row}>
          <View style={styles.titles}>
            {overline && <AppText variant="overline" color="primary">{overline}</AppText>}
            <AppText variant="display" accessibilityRole="header">
              {title}
            </AppText>
            {subtitle && <AppText variant="caption">{subtitle}</AppText>}
          </View>
          {right}
        </View>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingBottom: 12 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  titles: { flex: 1, gap: 2 },
});
