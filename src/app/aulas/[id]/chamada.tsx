import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/form-screen';
import { Icon } from '@/components/ui/icon';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { Radius } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { attendanceBlockReason, getAttendanceList, saveAttendance } from '@/database/attendance-repository';
import { getClass } from '@/database/class-repository';
import { errorMessage } from '@/database/errors';
import type { AulaDetalhada, ChamadaItem } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate } from '@/lib/calendar';
import { calculateAge } from '@/lib/format';

type Marks = Record<number, boolean | undefined>;

/** Lista de presença: o professor marca quem veio e quem faltou. */
export default function AttendanceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const aulaId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();

  const [aula, setAula] = useState<AulaDetalhada | null>(null);
  const [items, setItems] = useState<ChamadaItem[]>([]);
  const [marks, setMarks] = useState<Marks>({});
  const [blocked, setBlocked] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Recarrega ao voltar da tela de relatório (para atualizar a contagem),
  // sem perder as marcações que ainda não foram salvas.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [found, list, reason] = await Promise.all([getClass(db, aulaId), getAttendanceList(db, aulaId), attendanceBlockReason(db, aulaId, user)]);
        if (!active) return;
        setAula(found);
        setItems(list);
        setBlocked(reason);
        setMarks((current) => {
          const next = { ...current };
          for (const item of list) if (next[item.aluno_id] === undefined && item.presente !== null) next[item.aluno_id] = item.presente === 1;
          return next;
        });
        setLoading(false);
      })().catch(() => active && setLoading(false));
      return () => {
        active = false;
      };
    }, [db, aulaId, user]),
  );

  const setMark = (alunoId: number, presente: boolean) => setMarks((current) => ({ ...current, [alunoId]: presente }));
  const markAll = () => setMarks(Object.fromEntries(items.map((item) => [item.aluno_id, true])));

  const marked = items.filter((item) => marks[item.aluno_id] !== undefined).length;
  const presentes = items.filter((item) => marks[item.aluno_id] === true).length;
  const missing = items.length - marked;

  const save = async () => {
    if (missing > 0) {
      showToast(`Marque presença ou falta para todos (${missing} sem marcação).`, 'error');
      return;
    }
    setSaving(true);
    try {
      await saveAttendance(db, aulaId, items.map((item) => ({ alunoId: item.aluno_id, presente: marks[item.aluno_id] === true })), user);
      showToast(`Chamada salva: ${presentes} presentes de ${items.length}.`);
      router.back();
    } catch (error) {
      showToast(errorMessage(error, 'Não foi possível salvar a chamada.'), 'error');
      setSaving(false);
    }
  };

  if (loading) return <LoadingState message="Carregando lista..." />;
  if (blocked || !aula) return <EmptyState icon="warning" title="Chamada indisponível" message={blocked ?? 'Aula não encontrada.'} />;
  if (items.length === 0) {
    return <EmptyState icon="alunos" title="Nenhum aluno matriculado" message="A coordenação precisa matricular alunos nesta oficina." />;
  }

  return (
    <FormScreen
      footer={
        <View style={styles.footer}>
          <AppText variant="caption" style={styles.summary}>
            {presentes} presentes · {marked - presentes} faltas{missing > 0 ? ` · ${missing} sem marcação` : ''}
          </AppText>
          <Button title="Salvar chamada" icon="check" onPress={save} loading={saving} />
        </View>
      }>
      <Card title={aula.oficina_nome} subtitle={`${formatLongDate(aula.data)} · ${aula.hora_inicio}–${aula.hora_fim}`} icon="attendance"
        right={<Button title="Todos presentes" variant="ghost" compact onPress={markAll} />}>
        <View style={styles.list}>
          {items.map((item) => {
            const mark = marks[item.aluno_id];
            const name = item.nome_social || item.nome;
            return (
              <View key={item.aluno_id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {name}
                  </AppText>
                  <AppText variant="caption">{calculateAge(item.data_nascimento)} anos</AppText>
                  <Pressable
                    onPress={() => router.push({ pathname: '/aulas/[id]/relatorio', params: { id: String(aulaId), alunoId: String(item.aluno_id) } })}
                    accessibilityRole="button"
                    accessibilityLabel={`Escrever relatório de comportamento de ${name}`}
                    hitSlop={6}
                    style={styles.reportLink}>
                    <Icon name="report" size={14} color={theme.primary} />
                    <AppText variant="label" color="primary">
                      {item.relatorios > 0 ? `Relatório (${item.relatorios})` : 'Escrever relatório'}
                    </AppText>
                  </Pressable>
                </View>
                <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]} accessibilityRole="radiogroup" accessibilityLabel={`Presença de ${name}`}>
                  <Toggle label="Presente" icon="check" active={mark === true} activeColor={theme.success} onPress={() => setMark(item.aluno_id, true)} />
                  <Toggle label="Faltou" icon="close" active={mark === false} activeColor={theme.danger} onPress={() => setMark(item.aluno_id, false)} />
                </View>
              </View>
            );
          })}
        </View>
      </Card>
    </FormScreen>
  );
}

function Toggle({ label, icon, active, activeColor, onPress }: { label: string; icon: 'check' | 'close'; active: boolean; activeColor: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      accessibilityLabel={label}
      style={[styles.toggle, active && { backgroundColor: activeColor }]}>
      <Icon name={icon} size={16} color={active ? theme.surface : theme.textSecondary} />
      <AppText variant="label" style={{ color: active ? theme.surface : theme.textSecondary }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  reportLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, alignSelf: 'flex-start' },
  segment: { borderRadius: Radius.md, padding: 3, gap: 3 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, minHeight: 36, borderRadius: Radius.sm },
  footer: { gap: 8 },
  summary: { textAlign: 'center' },
});
