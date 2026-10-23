import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/form-screen';
import { Icon } from '@/components/ui/icon';
import { SelectField } from '@/components/ui/select-field';
import { TextField } from '@/components/ui/text-field';
import { TIPOS_HISTORICO } from '@/constants/options';
import { Radius } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { errorMessage } from '@/database/errors';
import { addHistory } from '@/database/history-repository';
import { getStudent } from '@/database/student-repository';
import { useTheme } from '@/hooks/use-theme';
import { brToIso, isoToBr, maskDate, todayIso } from '@/lib/format';
import { hasErrors, validateHistory, type FieldErrors, type HistoryFormValues } from '@/lib/validation';

export default function NewHistoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const studentId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();

  const [studentName, setStudentName] = useState('');
  const [values, setValues] = useState<HistoryFormValues>({ tipo: '', descricao: '', data_evento: isoToBr(todayIso()) });
  const [errors, setErrors] = useState<FieldErrors<keyof HistoryFormValues>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStudent(db, studentId).then((aluno) => setStudentName(aluno?.nome_social || aluno?.nome || ''));
  }, [db, studentId]);

  const set = (field: keyof HistoryFormValues) => (value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }));
  };

  const submit = async () => {
    const found = validateHistory(values);
    setErrors(found);
    if (hasErrors(found)) {
      showToast('Corrija os campos destacados.', 'error');
      return;
    }
    setSaving(true);
    try {
      await addHistory(
        db,
        studentId,
        { tipo: values.tipo, descricao: values.descricao, data_evento: brToIso(values.data_evento) ?? todayIso() },
        user.id,
      );
      showToast('Registro adicionado ao histórico.');
      router.back();
    } catch (error) {
      showToast(errorMessage(error, 'Não foi possível salvar o registro.'), 'error');
      setSaving(false);
    }
  };

  return (
    <FormScreen footer={<Button title="Salvar registro" icon="check" onPress={submit} loading={saving} />}>
      <Card title={studentName || 'Aluno'} subtitle="Novo registro na linha do tempo" icon="history">
        <SelectField label="Tipo de registro" required options={TIPOS_HISTORICO} value={values.tipo} onChange={set('tipo')} error={errors.tipo} chipLimit={0} />
        <TextField
          label="Data do evento"
          required
          value={values.data_evento}
          onChangeText={set('data_evento')}
          error={errors.data_evento}
          mask={maskDate}
          keyboardType="number-pad"
          placeholder="dd/mm/aaaa"
          maxLength={10}
        />
        <TextField
          label="Descrição"
          required
          value={values.descricao}
          onChangeText={set('descricao')}
          error={errors.descricao}
          multiline
          placeholder="Descreva o que aconteceu, a avaliação ou a observação."
        />
      </Card>
      <View style={[styles.note, { backgroundColor: theme.accentSoft }]}>
        <Icon name="lock" size={18} color={theme.text} />
        <AppText variant="caption" color="text" style={styles.flex}>
          Para garantir a rastreabilidade, registros de histórico não podem ser editados nem apagados depois de salvos.
          Seu nome ficará registrado como responsável.
        </AppText>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: Radius.md, alignItems: 'flex-start' },
});
