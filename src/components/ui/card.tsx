import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CardProps = PropsWithChildren<{
  title?: string;
  subtitle?: string;
  icon?: IconName;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}>;

export function Card({ title, subtitle, icon, right, style, children }: CardProps) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>
      {(title || right) && (
        <View style={styles.header}>
          {icon && (
            <View style={[styles.iconBox, { backgroundColor: theme.primarySoft }]}>
              <Icon name={icon} size={18} color={theme.primary} />
            </View>
          )}
          <View style={styles.titles}>
            {title && (
              <AppText variant="heading" accessibilityRole="header">
                {title}
              </AppText>
            )}
            {subtitle && <AppText variant="caption">{subtitle}</AppText>}
          </View>
          {right}
        </View>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.lg, borderWidth: 1, padding: 16, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 2 },
});
