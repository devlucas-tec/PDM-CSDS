import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import type { RegistroHistorico } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { isoToBr } from '@/lib/format';

/** Linha do tempo do aluno (já vem ordenada do mais recente para o mais antigo). */
export function HistoryTimeline({ items }: { items: RegistroHistorico[] }) {
  const theme = useTheme();

  if (items.length === 0) {
    return <AppText variant="caption">Nenhum registro de histórico ainda.</AppText>;
  }

  return (
    <View>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <View key={item.id} style={styles.item}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: index === 0 ? theme.accent : theme.primary, borderColor: theme.surface }]} />
              {!last && <View style={[styles.line, { backgroundColor: theme.border }]} />}
            </View>
            <View style={[styles.content, !last && styles.spaced]}>
              <AppText variant="overline" color="primary">
                {isoToBr(item.data_evento)}
              </AppText>
              <AppText variant="bodyStrong">{item.tipo}</AppText>
              <AppText variant="body">{item.descricao}</AppText>
              <AppText variant="caption">Registrado por {item.usuario_nome ?? 'usuário removido'}</AppText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', gap: 12 },
  rail: { width: 16, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginTop: 2 },
  line: { flex: 1, width: 2, marginVertical: 2 },
  content: { flex: 1, gap: 2 },
  spaced: { paddingBottom: 18 },
});
