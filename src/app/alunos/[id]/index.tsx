import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { HistoryTimeline } from '@/components/history-timeline';
import { InfoRow } from '@/components/info-row';
import { ReportCard } from '@/components/report-card';
import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth, Radius } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { errorMessage } from '@/database/errors';
import { listHistory } from '@/database/history-repository';
import { deleteStudent, getStudent } from '@/database/student-repository';
import type { AlunoDetalhado, FrequenciaOficina, Oficina, RegistroHistorico, RelatorioDetalhado } from '@/database/types';
import { getRecentAttendance, getStudentAttendance, type AttendanceEntry } from '@/database/attendance-repository';
import { listReports } from '@/database/behavior-repository';
import { listStudentWorkshops } from '@/database/workshop-repository';
import { useTheme } from '@/hooks/use-theme';
import { calculateAge, formatDateTime, initials, isoToBr, percent, simNao } from '@/lib/format';
import { confirmAsync } from '@/lib/confirm';
import { VULNERABILITY_LABEL, vulnerabilityCriteria, vulnerabilityLevel } from '@/lib/vulnerability';

export default function StudentDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();

  const [aluno, setAluno] = useState<AlunoDetalhado | null>(null);
  const [history, setHistory] = useState<RegistroHistorico[]>([]);
  const [workshops, setWorkshops] = useState<Oficina[]>([]);
  const [frequency, setFrequency] = useState<FrequenciaOficina[]>([]);
  const [recent, setRecent] = useState<AttendanceEntry[]>([]);
  const [reports, setReports] = useState<RelatorioDetalhado[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found'>('loading');
  const [deleting, setDeleting] = useState(false);

  // Recarrega ao voltar da edição ou de um novo registro de histórico.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        getStudent(db, studentId),
        listHistory(db, studentId),
        listStudentWorkshops(db, studentId),
        getStudentAttendance(db, studentId),
        getRecentAttendance(db, studentId),
        listReports(db, { alunoId: studentId }),
      ])
        .then(([found, entries, ws, freq, rec, reps]) => {
          if (!active) return;
          setAluno(found);
          setHistory(entries);
          setWorkshops(ws);
          setFrequency(freq);
          setRecent(rec);
          setReports(reps);
          setStatus(found ? 'ready' : 'not-found');
        })
        .catch(() => active && setStatus('not-found'));
      return () => {
        active = false;
      };
    }, [db, studentId]),
  );

  const editHref = { pathname: '/alunos/[id]/editar', params: { id: String(studentId) } } as const;

  const handleDelete = async () => {
    if (!aluno) return;
    const confirmed = await confirmAsync({
      title: 'Excluir aluno?',
      message: `A ficha de ${aluno.nome} e todo o seu histórico serão removidos deste dispositivo. Esta ação não pode ser desfeita.`,
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await deleteStudent(db, studentId, user.id);
      showToast('Aluno excluído.');
      router.back();
    } catch (error) {
      showToast(errorMessage(error, 'Não foi possível excluir o aluno.'), 'error');
      setDeleting(false);
    }
  };

  if (status === 'loading') return <LoadingState message="Carregando ficha..." />;
  if (status === 'not-found' || !aluno) {
    return <EmptyState icon="warning" title="Aluno não encontrado" message="Ele pode ter sido excluído." />;
  }

  const criteria = vulnerabilityCriteria(aluno);
  const score = criteria.filter((c) => c.met).length;
  const level = vulnerabilityLevel(score);
  const levelColor = { baixa: theme.success, media: theme.accent, alta: theme.danger }[level];
  const displayName = aluno.nome_social || aluno.nome;
  const totalAulas = frequency.reduce((sum, f) => sum + f.total, 0);
  const totalPresentes = frequency.reduce((sum, f) => sum + f.presentes, 0);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push(editHref)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Editar aluno">
              <Icon name="edit" color={theme.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
        <View style={styles.inner}>
          {/* Identificação */}
          <View style={[styles.hero, { backgroundColor: theme.primary }]}>
            <View style={[styles.avatar, { backgroundColor: theme.accent }]}>
              <AppText variant="title" style={{ color: '#2A3020' }}>
                {initials(displayName)}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="title" style={{ color: theme.onPrimary }}>
                {displayName}
              </AppText>
              {aluno.nome_social && (
                <AppText variant="caption" style={{ color: theme.onPrimary, opacity: 0.85 }}>
                  Nome civil: {aluno.nome}
                </AppText>
              )}
              <AppText variant="body" style={{ color: theme.onPrimary, opacity: 0.9 }}>
                {calculateAge(aluno.data_nascimento)} anos · {aluno.serie ?? 'Série não informada'}
              </AppText>
            </View>
          </View>

          <View style={styles.badges}>
            {aluno.bolsa_familia === 1 && <Badge label="Bolsa Família" tone="accent" />}
            {aluno.possui_deficiencia === 1 && <Badge label="Possui deficiência" tone="terracotta" />}
            {aluno.transporte_escolar === 1 && <Badge label="Transporte escolar" tone="primary" />}
          </View>

          <View style={styles.actions}>
            <Button title="Editar" icon="edit" variant="secondary" onPress={() => router.push(editHref)} style={styles.flex} />
            <Button
              title="Registrar histórico"
              icon="history"
              onPress={() => router.push({ pathname: '/alunos/[id]/historico', params: { id: String(studentId) } })}
              style={styles.flex}
            />
          </View>

          {/* Índice de vulnerabilidade social */}
          <Card title="Vulnerabilidade social" subtitle={`${score} de 5 critérios`} icon="warning"
            right={<Badge label={VULNERABILITY_LABEL[level]} tone={level === 'alta' ? 'danger' : level === 'media' ? 'accent' : 'primary'} />}>
            <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.fill, { width: `${(score / 5) * 100}%`, backgroundColor: levelColor }]} />
            </View>
            {criteria.map((criterion) => (
              <View key={criterion.key} style={styles.criterion}>
                <Icon
                  name={criterion.met ? 'checkCircle' : 'close'}
                  size={18}
                  color={criterion.met ? levelColor : theme.textSecondary}
                />
                <AppText variant="body" color={criterion.met ? 'text' : 'textSecondary'}>
                  {criterion.label}
                </AppText>
              </View>
            ))}
          </Card>

          <Card title="Dados pessoais" icon="child">
            <View>
              <InfoRow label="Nome" value={aluno.nome} />
              <InfoRow label="Nome social" value={aluno.nome_social} />
              <InfoRow label="Data de nascimento" value={isoToBr(aluno.data_nascimento)} />
              <InfoRow label="Sexo" value={aluno.sexo === 'M' ? 'Masculino' : aluno.sexo === 'F' ? 'Feminino' : null} />
              <InfoRow label="Cor ou raça" value={aluno.cor_raca} />
              <InfoRow label="CPF" value={aluno.cpf} />
              <InfoRow label="RG" value={aluno.rg} />
              <InfoRow label="Nacionalidade" value={aluno.nacionalidade} />
              <InfoRow label="País de origem" value={aluno.pais_origem} />
              <InfoRow label="Naturalidade" value={[aluno.municipio_nascimento, aluno.uf_nascimento].filter(Boolean).join(' / ')} />
              <InfoRow label="Bolsa Família" value={simNao(aluno.bolsa_familia)} />
              <InfoRow label="Possui deficiência" value={simNao(aluno.possui_deficiencia)} />
              {aluno.possui_deficiencia === 1 && <InfoRow label="Descrição" value={aluno.descricao_deficiencia} />}
            </View>
          </Card>

          <Card title="Informações familiares" icon="family">
            <View>
              <InfoRow label="Mãe" value={aluno.nome_mae} />
              <InfoRow label="Escolaridade da mãe" value={aluno.escolaridade_mae} />
              <InfoRow label="Profissão da mãe" value={aluno.profissao_mae} />
              <InfoRow label="Pai" value={aluno.nome_pai} />
              <InfoRow label="Escolaridade do pai" value={aluno.escolaridade_pai} />
              <InfoRow label="Profissão do pai" value={aluno.profissao_pai} />
              <InfoRow label="Responsável" value={aluno.responsavel} />
              <InfoRow label="Parentesco" value={aluno.parentesco_responsavel} />
              <InfoRow label="Pessoas na casa" value={aluno.total_pessoas_casa} />
              <InfoRow label="Tipo de moradia" value={aluno.tipo_moradia} />
            </View>
          </Card>

          <Card title="Endereço" icon="location">
            <View>
              <InfoRow label="Rua" value={aluno.rua} />
              <InfoRow label="Bairro" value={aluno.bairro} />
              <InfoRow label="Cidade" value={[aluno.cidade, aluno.uf].filter(Boolean).join(' / ')} />
              <InfoRow label="CEP" value={aluno.cep} />
              <InfoRow label="Celular" value={aluno.telefone} />
            </View>
          </Card>

          <Card title="Informações educacionais" icon="school">
            <View>
              <InfoRow label="Escola de origem" value={aluno.escola_origem} />
              <InfoRow label="Cidade da escola" value={aluno.cidade_escola} />
              <InfoRow label="Série" value={aluno.serie} />
              <InfoRow label="Ano de conclusão" value={aluno.ano_conclusao} />
              <InfoRow label="Transporte escolar" value={simNao(aluno.transporte_escolar)} />
              <InfoRow label="Autorizados a buscar" value={aluno.pessoas_autorizadas} />
              <InfoRow label="Irmãos ou gêmeos" value={aluno.irmaos_gemeos} />
            </View>
          </Card>

          <Card title="Histórico médico" icon="health">
            <View>
              <InfoRow label="Convênio médico" value={aluno.convenio_medico} />
              <InfoRow label="Hipertensão" value={simNao(aluno.hipertensao)} />
              <InfoRow label="Diabetes" value={simNao(aluno.diabetes)} />
              <InfoRow label="Asma" value={simNao(aluno.asma)} />
              <InfoRow label="Tratamento em andamento" value={aluno.tratamento_medico} />
              <InfoRow label="Restrição de medicamentos" value={aluno.restricao_medicamentos} />
              <InfoRow label="Medicamentos controlados" value={aluno.medicamentos_controlados} />
              <InfoRow label="Restrição alimentar" value={aluno.restricao_alimentar} />
            </View>
          </Card>

          <Card
            title="Frequência"
            subtitle={totalAulas ? `${totalPresentes} presenças em ${totalAulas} aulas (${percent(totalPresentes, totalAulas)}%)` : 'Nenhuma chamada registrada'}
            icon="attendance">
            {workshops.length > 0 ? (
              <View style={styles.badges}>
                {workshops.map((w) => (
                  <Badge key={w.id} label={w.nome} tone="primary" />
                ))}
              </View>
            ) : (
              <AppText variant="caption">Não está matriculado em nenhuma oficina. Matricule pela tela de Oficinas.</AppText>
            )}
            {frequency.map((f) => {
              const value = percent(f.presentes, f.total);
              const color = value >= 75 ? theme.success : value >= 50 ? theme.accent : theme.danger;
              return (
                <View key={f.oficina_id} style={styles.freqRow}>
                  <View style={styles.freqLabel}>
                    <AppText variant="body">{f.oficina_nome}</AppText>
                    <AppText variant="label">{value}%</AppText>
                  </View>
                  <View style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
                    <View style={[styles.fill, { width: `${value}%`, backgroundColor: color }]} />
                  </View>
                  <AppText variant="caption">
                    {f.presentes} de {f.total} aulas{value < 75 ? ' · frequência baixa' : ''}
                  </AppText>
                </View>
              );
            })}
            {recent.length > 0 && (
              <View>
                <AppText variant="overline" style={styles.recentTitle}>Últimas chamadas</AppText>
                {recent.map((r) => (
                  <View key={r.aula_id} style={[styles.recentRow, { borderBottomColor: theme.border }]}>
                    <AppText variant="body" style={styles.flex}>
                      {isoToBr(r.data)} · {r.oficina_nome}
                    </AppText>
                    {r.presente === 1 ? <Badge label="Presente" tone="primary" /> : <Badge label="Faltou" tone="danger" />}
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card title="Comportamento" subtitle={`${reports.length} ${reports.length === 1 ? 'relatório' : 'relatórios'} dos professores`} icon="report">
            {reports.length === 0 && <AppText variant="caption">Nenhum relatório de comportamento.</AppText>}
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                hideStudent
                onPress={(id) => router.push({ pathname: '/relatorios/[id]', params: { id: String(id) } })}
              />
            ))}
          </Card>

          <Card
            title="Histórico do aluno"
            subtitle={`${history.length} ${history.length === 1 ? 'registro' : 'registros'} · do mais recente ao mais antigo`}
            icon="history">
            <HistoryTimeline items={history} />
          </Card>

          <View style={[styles.audit, { borderColor: theme.border }]}>
            <AppText variant="caption">
              Cadastrado em {formatDateTime(aluno.created_at)} por {aluno.created_by_nome ?? '—'}
            </AppText>
            <AppText variant="caption">
              Última atualização em {formatDateTime(aluno.updated_at)} por {aluno.updated_by_nome ?? '—'}
            </AppText>
          </View>

          <Button title="Excluir aluno" icon="delete" variant="danger" onPress={handleDelete} loading={deleting} />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: 16 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: Radius.lg },
  avatar: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actions: { flexDirection: 'row', gap: 10 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  criterion: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freqRow: { gap: 4 },
  freqLabel: { flexDirection: 'row', justifyContent: 'space-between' },
  recentTitle: { marginTop: 4, marginBottom: 2 },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  audit: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 4 },
});
