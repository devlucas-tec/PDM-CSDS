import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Tone = 'primary' | 'accent' | 'terracotta' | 'danger' | 'neutral';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const theme = useTheme();
  const colors = {
    primary: [theme.primarySoft, theme.primary],
    accent: [theme.accentSoft, theme.text],
    terracotta: [theme.terracottaSoft, theme.terracotta],
    danger: [theme.dangerSoft, theme.danger],
    neutral: [theme.backgroundElement, theme.textSecondary],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: colors[0] }]}>
      <AppText variant="caption" style={[styles.text, { color: colors[1] }]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.pill, alignSelf: 'flex-start' },
  text: { fontWeight: '600', fontSize: 12, lineHeight: 16 },
});
