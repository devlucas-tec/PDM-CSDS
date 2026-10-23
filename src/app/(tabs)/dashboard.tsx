import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ColumnChart, DonutChart, HorizontalBarChart, StackedBar } from '@/components/charts';
import { DashboardStudentTable } from '@/components/dashboard-student-table';
import { StatTile } from '@/components/stat-tile';
import { TabHeader } from '@/components/tab-header';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField } from '@/components/ui/select-field';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth } from '@/constants/theme';
import { useToast } from '@/context/toast-context';
import { getAttendanceTotals } from '@/database/attendance-repository';
import { listAllStudents } from '@/database/student-repository';
import type { Aluno } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { availableYears, computeDashboard, filterStudents, type DashboardFilters } from '@/lib/stats';
import { exportDashboardPdf } from '@/services/report';

export default function DashboardScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const { showToast } = useToast();

  const [students, setStudents] = useState<Aluno[]>([]);
  const [attendance, setAttendance] = useState<Map<number, { total: number; presentes: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [ano, setAno] = useState('');
  const [serie, setSerie] = useState('');
  const [bairro, setBairro] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, totals] = await Promise.all([listAllStudents(db), getAttendanceTotals(db)]);
      setStudents(list);
      setAttendance(totals);
    } catch {
      showToast('Não foi possível carregar os dados.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, showToast]);

  // Atualiza os indicadores sempre que a aba é aberta (após cadastros e edições).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filters: DashboardFilters = useMemo(
    () => ({ ano: ano ? Number(ano) : null, serie: serie || null, bairro: bairro || null }),
    [ano, serie, bairro],
  );
  const filtered = useMemo(() => filterStudents(students, filters), [students, filters]);
  const data = useMemo(() => computeDashboard(filtered, filters.ano), [filtered, filters.ano]);

  // Frequência nas oficinas (todas as chamadas registradas dos alunos filtrados).
  const frequency = useMemo(() => {
    let total = 0;
    let presentes = 0;
    let baixa = 0;
    for (const s of filtered) {
      const row = attendance.get(s.id);
      if (!row || row.total === 0) continue;
      total += row.total;
      presentes += row.presentes;
      if (row.presentes / row.total < 0.75) baixa++;
    }
    return { media: total ? Math.round((presentes / total) * 100) : null, baixa };
  }, [filtered, attendance]);

  const yearOptions = useMemo(() => availableYears(students).map(String), [students]);
  const serieOptions = useMemo(() => [...new Set(students.map((s) => s.serie).filter((s): s is string => !!s))].sort(), [students]);
  const bairroOptions = useMemo(
    () => [...new Set(students.map((s) => s.bairro))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [students],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportDashboardPdf(data, filtered, filters);
    } catch {
      showToast('Não foi possível gerar o relatório.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const v = data.vulnerabilidade;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
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
      }>
      <TabHeader overline="Casa São Domingos Sávio" title="Análise social" subtitle="Indicadores consolidados dos alunos atendidos">
        <Card>
          <SelectField label="Ano" options={yearOptions} value={ano} onChange={setAno} placeholder="Todos os anos" chipLimit={0} />
          <View style={styles.filterRow}>
            <View style={styles.flex}>
              <SelectField label="Série" options={serieOptions} value={serie} onChange={setSerie} placeholder="Todas" chipLimit={0} />
            </View>
            <View style={styles.flex}>
              <SelectField label="Bairro" options={bairroOptions} value={bairro} onChange={setBairro} placeholder="Todos" chipLimit={0} />
            </View>
          </View>
          <Button
            title="Exportar relatório (PDF)"
            icon="pdf"
            onPress={handleExport}
            loading={exporting}
            disabled={loading || data.total === 0}
          />
        </Card>
      </TabHeader>

      <View style={styles.inner}>
        {loading ? (
          <LoadingState message="Calculando indicadores..." />
        ) : students.length === 0 ? (
          <EmptyState icon="dashboard" title="Ainda não há dados" message="Cadastre alunos para ver os indicadores da Casa." />
        ) : (
          <>
            <View style={styles.tiles}>
              <StatTile icon="alunos" value={String(data.total)} label="Alunos atendidos" />
              <StatTile icon="groups" value={String(data.bolsaFamilia.count)} label="Recebem Bolsa Família" detail={`${data.bolsaFamilia.percent}% do total`} />
              <StatTile icon="child" value={String(data.deficiencia)} label="Alunos com deficiência" />
              <StatTile icon="home" value={data.mediaPessoasCasa.toLocaleString('pt-BR')} label="Média de pessoas por casa" />
              <StatTile icon="location" value={String(data.transporte)} label="Necessitam transporte" />
              <StatTile
                icon="attendance"
                value={frequency.media === null ? "—" : `${frequency.media}%`}
                label="Frequência média"
                detail={frequency.baixa ? `${frequency.baixa} abaixo de 75%` : undefined}
              />
            </View>

            {data.total === 0 ? (
              <EmptyState icon="filter" title="Nenhum aluno nesses filtros" message="Altere ano, série ou bairro." />
            ) : (
              <>
                <Card title="Índice de vulnerabilidade social" subtitle={`Média da Casa: ${data.indiceMedio}% dos critérios`} icon="warning">
                  <StackedBar
                    title="Distribuição de vulnerabilidade"
                    segments={[
                      { label: 'Baixa', value: v.baixa.count, percent: v.baixa.percent, color: theme.success, icon: 'checkCircle' },
                      { label: 'Média', value: v.media.count, percent: v.media.percent, color: theme.accent, icon: 'info' },
                      { label: 'Alta', value: v.alta.count, percent: v.alta.percent, color: theme.danger, icon: 'warning' },
                    ]}
                  />
                  <AppText variant="caption">
                    1 ponto por critério: Bolsa Família, mais de 5 pessoas na casa, baixa escolaridade dos pais, moradia
                    precária e transporte escolar. 0–1 baixa · 2–3 média · 4–5 alta.
                  </AppText>
                </Card>

                <SectionTitle title="Perfil dos alunos" />
                <Card title="Distribuição por idade" subtitle="Alunos por faixa etária (anos)">
                  <ColumnChart title="Distribuição por idade" items={data.idade} />
                </Card>
                <Card title="Gênero dos alunos">
                  <DonutChart title="Gênero dos alunos" items={data.genero} />
                </Card>
                <Card title="Raça / cor" subtitle="Autodeclaração no cadastro">
                  <HorizontalBarChart title="Raça ou cor" items={data.corRaca} />
                </Card>

                <SectionTitle title="Perfil das famílias" />
                <Card title="Escolaridade dos pais" subtitle="Mães e pais somados">
                  <HorizontalBarChart title="Escolaridade dos pais" items={data.escolaridadePais} />
                </Card>
                <Card title="Profissões mais comuns" subtitle="Mães e pais, por frequência">
                  <HorizontalBarChart title="Profissões mais comuns" items={data.profissoes} />
                </Card>
                <Card title="Tamanho das famílias" subtitle="Pessoas morando na mesma casa">
                  <ColumnChart title="Tamanho das famílias" items={data.tamanhoFamilia} />
                </Card>

                <SectionTitle title="Origem dos alunos" />
                <Card title="Alunos por bairro">
                  <HorizontalBarChart title="Alunos por bairro" items={data.bairros} />
                </Card>
                <Card title="Escolas de origem">
                  <HorizontalBarChart title="Escolas de origem" items={data.escolas} />
                </Card>

                <SectionTitle title="Dados de saúde" />
                <Card title="Condições médicas" icon="health">
                  <HorizontalBarChart title="Condições médicas" items={data.condicoesMedicas} />
                </Card>
                <Card title="Restrições alimentares">
                  <HorizontalBarChart title="Restrições alimentares" items={data.restricoesAlimentares} />
                </Card>

                <SectionTitle title="Lista de alunos" />
                <Card>
                  <DashboardStudentTable students={filtered} />
                </Card>
              </>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <AppText variant="overline" color="primary" style={styles.section} accessibilityRole="header">
      {title}
    </AppText>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120 },
  inner: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: MaxContentWidth + 32, alignSelf: 'center' },
  flex: { flex: 1 },
  filterRow: { flexDirection: 'row', gap: 12 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  section: { marginTop: 10 },
});
