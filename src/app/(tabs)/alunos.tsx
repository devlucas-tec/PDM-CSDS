import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { StudentRow } from '@/components/student-row';
import { TabHeader } from '@/components/tab-header';
import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { SelectField } from '@/components/ui/select-field';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth, Radius } from '@/constants/theme';
import { useToast } from '@/context/toast-context';
import {
  listDistinctValues,
  listStudents,
  type AlunoResumo,
  type StudentFilters,
  type StudentSort,
} from '@/database/student-repository';
import { useTheme } from '@/hooks/use-theme';

const SORT_OPTIONS: { label: string; value: StudentSort }[] = [
  { label: 'Nome (A–Z)', value: 'nome' },
  { label: 'Mais recentes', value: 'recentes' },
  { label: 'Mais novos', value: 'idade' },
];

const BOLSA_OPTIONS = [
  { label: 'Recebe', value: '1' },
  { label: 'Não recebe', value: '0' },
];

export default function StudentsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { showToast } = useToast();

  const [students, setStudents] = useState<AlunoResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [serie, setSerie] = useState('');
  const [bairro, setBairro] = useState('');
  const [bolsa, setBolsa] = useState('');
  const [sort, setSort] = useState<StudentSort>('nome');
  const [series, setSeries] = useState<string[]>([]);
  const [bairros, setBairros] = useState<string[]>([]);

  // Espera o usuário parar de digitar antes de consultar o banco.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const load = useCallback(async () => {
    const filters: StudentFilters = {
      search: debouncedSearch,
      serie: serie || null,
      bairro: bairro || null,
      bolsaFamilia: bolsa === '' ? null : (Number(bolsa) as 0 | 1),
      sort,
    };
    try {
      const [rows, seriesList, bairrosList] = await Promise.all([
        listStudents(db, filters),
        listDistinctValues(db, 'serie'),
        listDistinctValues(db, 'bairro'),
      ]);
      setStudents(rows);
      setSeries(seriesList);
      setBairros(bairrosList);
    } catch {
      showToast('Não foi possível carregar os alunos.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, debouncedSearch, serie, bairro, bolsa, sort, showToast]);

  // Recarrega sempre que a tela volta a ficar visível (ex.: depois de cadastrar ou editar).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const activeFilters = [serie, bairro, bolsa].filter(Boolean).length;
  const hasQuery = activeFilters > 0 || debouncedSearch.trim().length > 0;

  const clearFilters = () => {
    setSerie('');
    setBairro('');
    setBolsa('');
  };

  const openStudent = useCallback((id: number) => {
    router.push({ pathname: '/alunos/[id]', params: { id: String(id) } });
  }, []);
  const editStudent = useCallback((id: number) => {
    router.push({ pathname: '/alunos/[id]/editar', params: { id: String(id) } });
  }, []);

  const header = (
    <TabHeader
      overline="Casa São Domingos Sávio"
      title="Alunos"
      subtitle={loading ? 'Carregando...' : `${students.length} ${students.length === 1 ? 'aluno encontrado' : 'alunos encontrados'}`}
      right={
        <Pressable
          onPress={() => router.push('/alunos/novo')}
          accessibilityRole="button"
          accessibilityLabel="Cadastrar novo aluno"
          style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="add" size={26} color={theme.onPrimary} />
        </Pressable>
      }>
      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <TextField
            label="Buscar por nome"
            icon="search"
            value={search}
            onChangeText={setSearch}
            placeholder="Digite o nome do aluno"
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
        <Pressable
          onPress={() => setShowFilters((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={`Filtros e ordenação${activeFilters ? `, ${activeFilters} ativos` : ''}`}
          accessibilityState={{ expanded: showFilters }}
          style={[
            styles.filterButton,
            {
              backgroundColor: showFilters || activeFilters ? theme.primarySoft : theme.surface,
              borderColor: showFilters || activeFilters ? theme.primary : theme.border,
            },
          ]}>
          <Icon name="filter" size={22} color={theme.primary} />
          {activeFilters > 0 && (
            <View style={[styles.counter, { backgroundColor: theme.accent }]}>
              <AppText variant="caption" style={styles.counterText}>
                {activeFilters}
              </AppText>
            </View>
          )}
        </Pressable>
      </View>

      {showFilters && (
        <View style={[styles.filters, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <SelectField label="Ordenar por" options={SORT_OPTIONS} value={sort} onChange={(v) => setSort(v as StudentSort)} required />
          <SelectField label="Série" options={series} value={serie} onChange={setSerie} placeholder="Todas as séries" chipLimit={0} />
          <SelectField label="Bairro" options={bairros} value={bairro} onChange={setBairro} placeholder="Todos os bairros" chipLimit={0} />
          <SelectField label="Bolsa Família" options={BOLSA_OPTIONS} value={bolsa} onChange={setBolsa} />
          {activeFilters > 0 && (
            <Pressable onPress={clearFilters} accessibilityRole="button" style={styles.clear}>
              <Icon name="close" size={16} color={theme.terracotta} />
              <AppText variant="label" color="terracotta">
                Limpar filtros
              </AppText>
            </Pressable>
          )}
        </View>
      )}
    </TabHeader>
  );

  return (
    <View style={[styles.flex, { backgroundColor: theme.background }]}>
      <FlatList
        data={students}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <StudentRow aluno={item} onView={openStudent} onEdit={editStudent} />
          </View>
        )}
        ListEmptyComponent={
          loading ? (
            <LoadingState message="Carregando alunos..." />
          ) : hasQuery ? (
            <EmptyState icon="search" title="Nenhum aluno encontrado" message="Tente outro nome ou ajuste os filtros." />
          ) : (
            <EmptyState
              icon="alunos"
              title="Nenhum aluno cadastrado"
              message="Comece cadastrando o primeiro aluno da Casa."
              actionLabel="Cadastrar aluno"
              onAction={() => router.push('/alunos/novo')}
            />
          )
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { paddingBottom: 120 },
  item: { paddingHorizontal: 16, paddingVertical: 5, width: '100%', maxWidth: MaxContentWidth + 32, alignSelf: 'center' },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterText: { fontWeight: '700', color: '#2A3020', fontSize: 11, lineHeight: 14 },
  filters: { borderWidth: 1, borderRadius: Radius.lg, padding: 14, gap: 14 },
  clear: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 },
});
