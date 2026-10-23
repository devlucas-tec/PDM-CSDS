import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StatTileProps = {
  icon: IconName;
  value: string;
  label: string;
  detail?: string;
};

/** Indicador principal do dashboard (número grande + rótulo). */
export function StatTile({ icon, value, label, detail }: StatTileProps) {
  const theme = useTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `, ${detail}` : ''}`}>
      <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
        <Icon name={icon} size={18} color={theme.primary} />
      </View>
      <AppText variant="display" style={styles.value}>
        {value}
      </AppText>
      <AppText variant="label">{label}</AppText>
      {detail && <AppText variant="caption">{detail}</AppText>}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { flexGrow: 1, flexBasis: '45%', minWidth: 140, borderRadius: Radius.lg, borderWidth: 1, padding: 14, gap: 2 },
  icon: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  value: { fontVariant: ['tabular-nums'] },
});
