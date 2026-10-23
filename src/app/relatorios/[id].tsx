import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { InfoRow } from '@/components/info-row';
import { ReportCard } from '@/components/report-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { MaxContentWidth } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { getReport, markReportRead, registerGuardianContact } from '@/database/behavior-repository';
import { DomainError } from '@/database/errors';
import { getStudent } from '@/database/student-repository';
import type { AlunoDetalhado, RelatorioDetalhado } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { onlyDigits } from '@/lib/format';

/** Coordenação lê o relatório do professor e, se precisar, contata os responsáveis. */
export default function ReportDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();

  const [report, setReport] = useState<RelatorioDetalhado | null | undefined>(undefined);
  const [aluno, setAluno] = useState<AlunoDetalhado | null>(null);
  const [observacao, setObservacao] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  // Abrir o relatório marca como lido.
  const fetchData = useCallback(async () => {
    await markReportRead(db, reportId, user);
    const found = await getReport(db, reportId);
    const student = found ? await getStudent(db, found.aluno_id) : null;
    return { found, student };
  }, [db, reportId, user]);

  const apply = ({ found, student }: { found: RelatorioDetalhado | null; student: AlunoDetalhado | null }) => {
    setReport(found);
    setAluno(student);
  };

  useEffect(() => {
    fetchData()
      .then(apply)
      .catch(() => setReport(null));
  }, [fetchData]);

  if (report === undefined) return <LoadingState />;
  if (report === null) return <EmptyState icon="warning" title="Relatório não encontrado" />;

  const phone = onlyDigits(aluno?.telefone ?? '');
  const guardian = aluno?.responsavel || aluno?.nome_mae;

  const open = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      showToast('Não foi possível abrir o aplicativo neste aparelho.', 'error');
    }
  };

  const registerContact = async () => {
    setSaving(true);
    try {
      await registerGuardianContact(db, reportId, observacao, user);
      showToast('Contato registrado no histórico do aluno.');
      setObservacao('');
      apply(await fetchData());
    } catch (e) {
      const message = e instanceof DomainError ? e.message : 'Não foi possível registrar o contato.';
      setError(message);
      showToast(message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.inner}>
        <ReportCard report={report} />

        <Card title="Responsáveis" subtitle={report.aluno_nome} icon="family">
          <View>
            <InfoRow label="Responsável" value={guardian ? `${guardian}${aluno?.parentesco_responsavel ? ` (${aluno.parentesco_responsavel})` : ''}` : null} />
            <InfoRow label="Mãe" value={aluno?.nome_mae} />
            <InfoRow label="Pai" value={aluno?.nome_pai} />
            <InfoRow label="Celular" value={aluno?.telefone} />
          </View>
          {phone.length >= 10 ? (
            <View style={styles.row}>
              <Button title="Ligar" icon="phone" variant="secondary" style={styles.flex} onPress={() => open(`tel:${phone}`)} />
              <Button title="WhatsApp" icon="chat" variant="secondary" style={styles.flex} onPress={() => open(`https://wa.me/55${phone}`)} />
            </View>
          ) : (
            <AppText variant="caption">Sem celular cadastrado. Atualize a ficha do aluno.</AppText>
          )}
          <Button
            title="Abrir ficha do aluno"
            icon="view"
            variant="ghost"
            onPress={() => router.push({ pathname: '/alunos/[id]', params: { id: String(report.aluno_id) } })}
          />
        </Card>

        {report.status !== 'contato_realizado' && (
          <Card title="Registrar contato" subtitle="Fica no histórico da criança" icon="history">
            <TextField
              label="O que foi conversado?"
              required
              value={observacao}
              onChangeText={(value) => {
                setObservacao(value);
                setError(undefined);
              }}
              error={error}
              multiline
              placeholder="Ex.: liguei para a mãe, que explicou a situação; vamos acompanhar."
            />
            <Button title="Salvar contato" icon="check" onPress={registerContact} loading={saving} />
          </Card>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  inner: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', gap: 16 },
  row: { flexDirection: 'row', gap: 10 },
});
