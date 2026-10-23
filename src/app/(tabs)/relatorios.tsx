import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ReportCard } from '@/components/report-card';
import { TabHeader } from '@/components/tab-header';
import { SelectField } from '@/components/ui/select-field';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth } from '@/constants/theme';
import { useToast } from '@/context/toast-context';
import { countNewReports, listReports } from '@/database/behavior-repository';
import type { RelatorioDetalhado, StatusRelatorio } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';

const FILTERS = [
  { label: 'Novos', value: 'novo' },
  { label: 'Lidos', value: 'lido' },
  { label: 'Contato feito', value: 'contato_realizado' },
];

/** Relatórios de comportamento enviados pelos professores. */
export default function ReportsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { showToast } = useToast();
  const [status, setStatus] = useState('');
  const [items, setItems] = useState<RelatorioDetalhado[]>([]);
  const [newCount, setNewCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [list, novos] = await Promise.all([
        listReports(db, { status: (status || null) as StatusRelatorio | null }),
        countNewReports(db),
      ]);
      setItems(list);
      setNewCount(novos);
    } catch {
      showToast('Não foi possível carregar os relatórios.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, status, showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const open = useCallback((id: number) => router.push({ pathname: '/relatorios/[id]', params: { id: String(id) } }), []);

  return (
    <FlatList
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      data={loading ? [] : items}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={
        <TabHeader
          overline="Coordenação"
          title="Relatórios"
          subtitle={newCount ? `${newCount} ${newCount === 1 ? 'relatório novo' : 'relatórios novos'} dos professores` : 'Comportamento dos alunos nas oficinas'}>
          <SelectField label="Mostrar" options={FILTERS} value={status} onChange={setStatus} />
        </TabHeader>
      }
      renderItem={({ item }) => (
        <View style={styles.item}>
          <ReportCard report={item} onPress={open} />
        </View>
      )}
      ListEmptyComponent={
        loading ? (
          <LoadingState />
        ) : (
          <EmptyState icon="report" title="Nenhum relatório" message={status ? 'Nada com esse filtro.' : 'Os relatórios escritos pelos professores na chamada aparecem aqui.'} />
        )
      }
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} colors={[theme.primary]} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 120 },
  item: { paddingHorizontal: 16, paddingVertical: 5, width: '100%', maxWidth: MaxContentWidth + 32, alignSelf: 'center' },
});
