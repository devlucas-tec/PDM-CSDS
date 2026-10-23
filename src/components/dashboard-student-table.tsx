import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import type { Aluno } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { calculateAge, simNao } from '@/lib/format';

type Column = 'nome' | 'idade' | 'serie' | 'bairro' | 'bolsa' | 'deficiencia';

const COLUMNS: { key: Column; label: string; width: number }[] = [
  { key: 'nome', label: 'Nome', width: 170 },
  { key: 'idade', label: 'Idade', width: 64 },
  { key: 'serie', label: 'Série', width: 104 },
  { key: 'bairro', label: 'Bairro', width: 120 },
  { key: 'bolsa', label: 'Bolsa Fam.', width: 88 },
  { key: 'deficiencia', label: 'Deficiência', width: 96 },
];

const PAGE_SIZE = 10;

/** Tabela do dashboard: busca por nome, ordenação por coluna e paginação. */
export function DashboardStudentTable({ students }: { students: Aluno[] }) {
  const theme = useTheme();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ column: Column; asc: boolean }>({ column: 'nome', asc: true });
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const mapped = students
      .filter((s) => !query || s.nome.toLowerCase().includes(query) || (s.nome_social ?? '').toLowerCase().includes(query))
      .map((s) => ({
        id: s.id,
        nome: s.nome_social || s.nome,
        idade: calculateAge(s.data_nascimento),
        serie: s.serie ?? '—',
        bairro: s.bairro,
        bolsa: simNao(s.bolsa_familia),
        deficiencia: simNao(s.possui_deficiencia),
      }));
    const direction = sort.asc ? 1 : -1;
    return mapped.sort((a, b) => {
      const x = a[sort.column];
      const y = b[sort.column];
      const result = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR');
      return result * direction;
    });
  }, [students, search, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = rows.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  const toggleSort = (column: Column) => {
    setSort((current) => ({ column, asc: current.column === column ? !current.asc : true }));
    setPage(0);
  };

  return (
    <View style={styles.wrapper}>
      <TextField
        label="Buscar na lista"
        icon="search"
        value={search}
        onChangeText={(value) => {
          setSearch(value);
          setPage(0);
        }}
        placeholder="Nome do aluno"
      />

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
            {COLUMNS.map((column) => {
              const active = sort.column === column.key;
              return (
                <Pressable
                  key={column.key}
                  onPress={() => toggleSort(column.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`Ordenar por ${column.label}${active ? (sort.asc ? ', crescente' : ', decrescente') : ''}`}
                  style={[styles.cell, styles.headerCell, { width: column.width }]}>
                  <AppText variant="label" color={active ? 'primary' : 'text'}>
                    {column.label}
                  </AppText>
                  {active && <AppText variant="label" color="primary">{sort.asc ? '↑' : '↓'}</AppText>}
                </Pressable>
              );
            })}
          </View>
          {visible.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => router.push({ pathname: '/alunos/[id]', params: { id: String(row.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`${row.nome}, ${row.idade} anos. Abrir ficha`}
              style={({ pressed }) => [styles.row, { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
              {COLUMNS.map((column) => (
                <View key={column.key} style={[styles.cell, { width: column.width }]}>
                  <AppText variant={column.key === 'nome' ? 'bodyStrong' : 'body'} numberOfLines={1} style={styles.cellText}>
                    {row[column.key]}
                  </AppText>
                </View>
              ))}
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {rows.length === 0 && <AppText variant="caption">Nenhum aluno encontrado.</AppText>}

      <View style={styles.pagination}>
        <Button title="Anterior" variant="secondary" compact disabled={currentPage === 0} onPress={() => setPage(currentPage - 1)} />
        <View style={styles.pageInfo}>
          <Icon name="alunos" size={16} color={theme.textSecondary} />
          <AppText variant="caption">
            Página {currentPage + 1} de {pages} · {rows.length} alunos
          </AppText>
        </View>
        <Button title="Próxima" variant="secondary" compact disabled={currentPage >= pages - 1} onPress={() => setPage(currentPage + 1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 12 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'transparent' },
  cell: { paddingHorizontal: 8, paddingVertical: 10, justifyContent: 'center' },
  headerCell: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 44 },
  cellText: { fontSize: 14 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pageInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
