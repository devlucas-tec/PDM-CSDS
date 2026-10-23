import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { FormScreen } from '@/components/ui/form-screen';
import { Icon } from '@/components/ui/icon';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { YesNoField } from '@/components/ui/yes-no-field';
import { Radius } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { getClass, updateClass } from '@/database/class-repository';
import { DomainError } from '@/database/errors';
import type { AulaDetalhada } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate, isValidTime, maskTime } from '@/lib/calendar';
import { brToIso, isoToBr, maskDate } from '@/lib/format';
import type { FieldErrors } from '@/lib/validation';

type Field = 'data' | 'horaInicio' | 'horaFim' | 'justificativa';

/** A coordenação remarca ou cancela uma aula, sempre com justificativa. */
export default function EditClassScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const aulaId = Number(id);
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();

  const [aula, setAula] = useState<AulaDetalhada | null | undefined>(undefined);
  const [data, setData] = useState('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [cancelada, setCancelada] = useState(false);
  const [justificativa, setJustificativa] = useState('');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getClass(db, aulaId).then((found) => {
      setAula(found);
      if (!found) return;
      setData(isoToBr(found.data));
      setHoraInicio(found.hora_inicio);
      setHoraFim(found.hora_fim);
      setCancelada(found.status === 'cancelada');
      setJustificativa(found.justificativa ?? '');
    });
  }, [db, aulaId]);

  if (aula === undefined) return <LoadingState />;
  if (aula === null) return <EmptyState icon="warning" title="Aula não encontrada" />;

  const save = async () => {
    const found: FieldErrors<Field> = {};
    const iso = brToIso(data);
    if (!iso) found.data = 'Data inválida. Use dd/mm/aaaa.';
    if (!isValidTime(horaInicio)) found.horaInicio = 'Use o formato HH:MM.';
    if (!isValidTime(horaFim)) found.horaFim = 'Use o formato HH:MM.';
    else if (isValidTime(horaInicio) && horaFim <= horaInicio) found.horaFim = 'Deve ser depois do início.';
    const changed = iso !== aula.data || horaInicio !== aula.hora_inicio || horaFim !== aula.hora_fim || cancelada;
    if (changed && justificativa.trim().length < 5) found.justificativa = 'Explique o motivo (ex.: professor avisou que não poderá comparecer).';
    setErrors(found);
    if (Object.keys(found).length) {
      showToast('Corrija os campos destacados.', 'error');
      return;
    }

    setSaving(true);
    try {
      const status = await updateClass(db, aulaId, { data: iso!, horaInicio, horaFim, cancelada, justificativa }, user);
      showToast(status === 'cancelada' ? 'Aula cancelada.' : status === 'remarcada' ? 'Aula remarcada.' : 'Aula atualizada.');
      router.back();
    } catch (error) {
      if (error instanceof DomainError) {
        if (error.field) setErrors({ [error.field]: error.message });
        showToast(error.message, 'error');
      } else {
        showToast('Não foi possível salvar a aula.', 'error');
      }
      setSaving(false);
    }
  };

  return (
    <FormScreen footer={<Button title="Salvar mudança" icon="check" onPress={save} loading={saving} />}>
      <Card title={aula.oficina_nome} subtitle={`Hoje marcada para ${formatLongDate(aula.data)}, ${aula.hora_inicio}–${aula.hora_fim}`} icon="reschedule">
        <TextField label="Nova data" required value={data} onChangeText={setData} mask={maskDate} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} error={errors.data} />
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Início" required value={horaInicio} onChangeText={setHoraInicio} mask={maskTime} keyboardType="number-pad" placeholder="14:00" maxLength={5} error={errors.horaInicio} />
          </View>
          <View style={styles.flex}>
            <TextField label="Término" required value={horaFim} onChangeText={setHoraFim} mask={maskTime} keyboardType="number-pad" placeholder="15:00" maxLength={5} error={errors.horaFim} />
          </View>
        </View>
        <YesNoField label="Cancelar esta aula?" value={cancelada} onChange={setCancelada} />
        <TextField
          label="Justificativa"
          required
          value={justificativa}
          onChangeText={setJustificativa}
          error={errors.justificativa}
          multiline
          placeholder="Ex.: o professor avisou que estará em consulta médica."
        />
      </Card>
      <View style={[styles.note, { backgroundColor: theme.accentSoft }]}>
        <Icon name="info" size={18} color={theme.text} />
        <AppText variant="caption" color="text" style={styles.flex}>
          O professor verá a nova data e a justificativa na agenda dele. A data original fica registrada.
        </AppText>
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: Radius.md, alignItems: 'flex-start' },
});
