import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useTheme } from '@/hooks/use-theme';

/** Par rótulo/valor somente leitura, usado na ficha do aluno. */
export function InfoRow({ label, value }: { label: string; value: string | number | null | undefined }) {
  const theme = useTheme();
  const empty = value === null || value === undefined || value === '';
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]} accessible accessibilityLabel={`${label}: ${empty ? 'não informado' : value}`}>
      <AppText variant="caption" style={styles.label}>
        {label}
      </AppText>
      <AppText variant="body" style={styles.value} color={empty ? 'textSecondary' : 'text'}>
        {empty ? '—' : String(value)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
  value: { flex: 1.4, textAlign: 'right' },
});
