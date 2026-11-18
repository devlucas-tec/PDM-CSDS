import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useSync } from '@/context/sync-context';
import { useTheme } from '@/hooks/use-theme';

/**
 * Indicador compacto do estado da sincronização, exibido no topo das abas.
 * Toque para abrir a tela com a fila de alterações.
 */
export function SyncStatus() {
  const theme = useTheme();
  const { online, syncing, pendentes, erros } = useSync();

  let icon: IconName = 'cloud';
  let label = 'Sincronizado';
  let color: string = theme.success;
  let background: string = theme.successSoft;
  if (erros > 0) {
    icon = 'warning';
    label = `${erros} com erro`;
    color = theme.danger;
    background = theme.dangerSoft;
  } else if (!online) {
    icon = 'cloudOff';
    label = pendentes > 0 ? `Offline · ${pendentes}` : 'Offline';
    color = theme.terracotta;
    background = theme.terracottaSoft;
  } else if (syncing || pendentes > 0) {
    icon = 'sync';
    label = pendentes > 0 ? `Enviando ${pendentes}` : 'Sincronizando';
    color = theme.primary;
    background = theme.primarySoft;
  }

  return (
    <Pressable
      onPress={() => router.push('/sincronizacao')}
      accessibilityRole="button"
      accessibilityLabel={`Sincronização: ${label}`}
      accessibilityHint="Abre a fila de alterações"
      hitSlop={8}
      style={({ pressed }) => [styles.pill, { backgroundColor: background, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={icon} size={14} color={color} />
      <AppText variant="caption" style={[styles.text, { color }]}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  text: { fontWeight: '600', fontSize: 12, lineHeight: 16 },
});
