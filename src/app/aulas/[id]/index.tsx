import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { InfoRow } from '@/components/info-row';
import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth, Radius } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { attendanceBlockReason, getAttendanceList } from '@/database/attendance-repository';
import { listReports } from '@/database/behavior-repository';
import { canAccessClass, deleteClass, getClass } from '@/database/class-repository';
import { errorMessage } from '@/database/errors';
import type { AulaDetalhada, ChamadaItem, RelatorioDetalhado } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate } from '@/lib/calendar';
import { confirmAsync } from '@/lib/confirm';
import { isoToBr } from '@/lib/format';
import { isGestor } from '@/lib/permissions';

export default function ClassDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const aulaId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();
  const gestor = isGestor(user.perfil);

  const [aula, setAula] = useState<AulaDetalhada | null>(null);
  const [attendance, setAttendance] = useState<ChamadaItem[]>([]);
  const [reports, setReports] = useState<RelatorioDetalhado[]>([]);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found'>('loading');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const found = await getClass(db, aulaId);
        if (!found || !(await canAccessClass(db, user, aulaId))) {
          if (active) setStatus('not-found');
          return;
        }
        const [list, reportList, reason] = await Promise.all([
          getAttendanceList(db, aulaId),
          listReports(db, { aulaId, professorId: gestor ? null : user.id }),
          attendanceBlockReason(db, aulaId, user),
        ]);
        if (!active) return;
        setAula(found);
        setAttendance(list);
        setReports(reportList);
        setBlocked(reason);
        setStatus('ready');
      })().catch(() => active && setStatus('not-found'));
      return () => {
        active = false;
      };
    }, [db, aulaId, user, gestor]),
  );

  const handleDelete = async () => {
    const confirmed = await confirmAsync({
      title: 'Excluir aula?',
      message: 'A aula será removida do calendário. Para avisar sobre uma falta do professor, prefira "Remarcar ou cancelar", que guarda a justificativa.',
      confirmLabel: 'Excluir',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await deleteClass(db, aulaId, user);
      showToast('Aula excluída do calendário.');
      router.back();
    } catch (error) {
      showToast(errorMessage(error, 'Não foi possível excluir a aula.'), 'error');
    }
  };

  if (status === 'loading') return <LoadingState message="Carregando aula..." />;
  if (status === 'not-found' || !aula) {
    return <EmptyState icon="warning" title="Aula não encontrada" message="Ela pode ter sido excluída ou não pertence às suas oficinas." />;
  }

  const registered = attendance.some((item) => item.presente !== null);
  const presentes = attendance.filter((item) => item.presente === 1).length;

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content}>
      <View style={styles.inner}>
        <View style={[styles.hero, { backgroundColor: aula.status === 'cancelada' ? theme.dangerSoft : theme.primary }]}>
          <AppText variant="overline" style={{ color: aula.status === 'cancelada' ? theme.danger : theme.onPrimary }}>
            {formatLongDate(aula.data)}
          </AppText>
          <AppText variant="title" style={{ color: aula.status === 'cancelada' ? theme.text : theme.onPrimary }}>
            {aula.oficina_nome}
          </AppText>
          <AppText variant="body" style={{ color: aula.status === 'cancelada' ? theme.text : theme.onPrimary }}>
            {aula.hora_inicio} às {aula.hora_fim}
            {aula.oficina_local ? ` · ${aula.oficina_local}` : ''}
          </AppText>
        </View>

        {aula.status !== 'agendada' && (
          <View style={[styles.notice, { backgroundColor: aula.status === 'cancelada' ? theme.dangerSoft : theme.accentSoft }]}>
            <Icon name={aula.status === 'cancelada' ? 'cancel' : 'reschedule'} size={22} color={aula.status === 'cancelada' ? theme.danger : theme.text} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{aula.status === 'cancelada' ? 'Aula cancelada' : 'Aula remarcada'}</AppText>
              {aula.data_original && aula.data_original !== aula.data && (
                <AppText variant="caption" color="text">Data original: {isoToBr(aula.data_original)}</AppText>
              )}
              {aula.justificativa && <AppText variant="body">Justificativa: {aula.justificativa}</AppText>}
            </View>
          </View>
        )}

        <Card title="Informações" icon="workshop">
          <View>
            <InfoRow label="Professor(es)" value={aula.professores} />
            <InfoRow label="Alunos matriculados" value={aula.total_matriculados} />
            <InfoRow label="Chamada" value={registered ? `${presentes} presentes de ${attendance.length}` : 'Não registrada'} />
          </View>
        </Card>

        <Card
          title="Lista de presença"
          subtitle={registered ? `${presentes} presentes · ${attendance.length - presentes} faltas` : 'Ainda não registrada'}
          icon="attendance">
          {blocked ? (
            <AppText variant="caption">{blocked}</AppText>
          ) : (
            <Button
              title={registered ? 'Editar chamada' : 'Fazer chamada'}
              icon="attendance"
              onPress={() => router.push({ pathname: '/aulas/[id]/chamada', params: { id: String(aulaId) } })}
            />
          )}
          {registered && (
            <View>
              {attendance.map((item) => (
                <View key={item.aluno_id} style={[styles.attendanceRow, { borderBottomColor: theme.border }]}>
                  <AppText variant="body" style={styles.flex} numberOfLines={1}>
                    {item.nome_social || item.nome}
                  </AppText>
                  {item.presente === 1 ? <Badge label="Presente" tone="primary" /> : item.presente === 0 ? <Badge label="Faltou" tone="danger" /> : <Badge label="—" />}
                </View>
              ))}
            </View>
          )}
        </Card>

        <Card title="Relatórios de comportamento" subtitle={`${reports.length} nesta aula`} icon="report">
          {reports.length === 0 && <AppText variant="caption">Nenhum relatório registrado nesta aula.</AppText>}
          {reports.map((report) => (
            <Pressable
              key={report.id}
              disabled={!gestor}
              onPress={() => router.push({ pathname: '/relatorios/[id]', params: { id: String(report.id) } })}
              accessibilityRole={gestor ? 'button' : undefined}
              style={[styles.report, { backgroundColor: theme.backgroundElement }]}>
              <AppText variant="bodyStrong">{report.aluno_nome}</AppText>
              <AppText variant="body" numberOfLines={gestor ? 2 : undefined}>
                {report.texto}
              </AppText>
              <AppText variant="caption">Por {report.professor_nome ?? '—'}</AppText>
            </Pressable>
          ))}
        </Card>

        {gestor && (
          <View style={styles.actions}>
            <Button
              title="Remarcar ou cancelar"
              icon="reschedule"
              variant="secondary"
              onPress={() => router.push({ pathname: '/aulas/[id]/editar', params: { id: String(aulaId) } })}
            />
            {!registered && <Button title="Excluir aula" icon="delete" variant="danger" onPress={handleDelete} />}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: 16 },
  hero: { padding: 18, borderRadius: Radius.lg, gap: 4 },
  notice: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: Radius.md, alignItems: 'flex-start' },
  attendanceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  report: { padding: 12, borderRadius: Radius.md, gap: 4 },
  actions: { gap: 10 },
});
