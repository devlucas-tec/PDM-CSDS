import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/form-screen';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Radius } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { createReport, listReports } from '@/database/behavior-repository';
import { getClass } from '@/database/class-repository';
import { DomainError } from '@/database/errors';
import type { RelatorioDetalhado } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate } from '@/lib/calendar';
import { formatDateTime } from '@/lib/format';

/** Relatório textual (opcional) sobre o comportamento de um aluno na aula. */
export default function BehaviorReportScreen() {
  const { id, alunoId } = useLocalSearchParams<{ id: string; alunoId: string }>();
  const aulaId = Number(id);
  const studentId = Number(alunoId);
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [previous, setPrevious] = useState<RelatorioDetalhado[]>([]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const [aula, list] = await Promise.all([getClass(db, aulaId), listReports(db, { aulaId, alunoId: studentId })]);
      const student = await db.getFirstAsync<{ nome: string; nome_social: string | null }>('SELECT nome, nome_social FROM alunos WHERE id = ?', studentId);
      setTitle(student?.nome_social || student?.nome || 'Aluno');
      setSubtitle(aula ? `${aula.oficina_nome} · ${formatShortDate(aula.data)}` : '');
      setPrevious(list);
    })();
  }, [db, aulaId, studentId]);

  const save = async () => {
    setSaving(true);
    try {
      await createReport(db, { alunoId: studentId, aulaId, texto }, user);
      showToast('Relatório enviado para a coordenação.');
      router.back();
    } catch (e) {
      const message = e instanceof DomainError ? e.message : 'Não foi possível salvar o relatório.';
      setError(e instanceof DomainError && e.field === 'texto' ? message : undefined);
      showToast(message, 'error');
      setSaving(false);
    }
  };

  return (
    <FormScreen footer={<Button title="Enviar relatório" icon="check" onPress={save} loading={saving} />}>
      <Card title={title} subtitle={subtitle} icon="report">
        <TextField
          label="Como foi o comportamento do aluno?"
          required
          value={texto}
          onChangeText={(value) => {
            setTexto(value);
            if (error) setError(undefined);
          }}
          error={error}
          multiline
          placeholder="Participação, interação com os colegas, mudanças de humor, algo que preocupe ou um elogio..."
        />
      </Card>

      <View style={[styles.note, { backgroundColor: theme.accentSoft }]}>
        <Icon name="info" size={18} color={theme.text} />
        <AppText variant="caption" color="text" style={styles.flex}>
          O relatório vai para a coordenação, que pode entrar em contato com os responsáveis. Depois de enviado, o texto
          não pode ser alterado.
        </AppText>
      </View>

      {previous.length > 0 && (
        <Card title="Já enviados nesta aula" icon="history">
          {previous.map((report) => (
            <View key={report.id} style={[styles.previous, { backgroundColor: theme.backgroundElement }]}>
              <AppText variant="body">{report.texto}</AppText>
              <AppText variant="caption">
                {report.professor_nome ?? '—'} · {formatDateTime(report.created_at)}
              </AppText>
            </View>
          ))}
        </Card>
      )}
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: Radius.md, alignItems: 'flex-start' },
  previous: { padding: 12, borderRadius: Radius.md, gap: 4 },
});
