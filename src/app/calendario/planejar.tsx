import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { FormScreen } from '@/components/ui/form-screen';
import { SelectField } from '@/components/ui/select-field';
import { EmptyState } from '@/components/ui/states';
import { TextField } from '@/components/ui/text-field';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { planClasses } from '@/database/class-repository';
import { errorMessage } from '@/database/errors';
import type { OficinaResumo } from '@/database/types';
import { listWorkshops } from '@/database/workshop-repository';
import { generateDates, isValidTime, maskTime, weekday, WEEKDAYS_SHORT } from '@/lib/calendar';
import { brToIso, isoToBr, maskDate, todayIso } from '@/lib/format';
import type { FieldErrors } from '@/lib/validation';

type Field = 'oficina' | 'inicio' | 'fim' | 'dias' | 'horaInicio' | 'horaFim';

const MODES = [
  { label: 'Aulas semanais', value: 'semanal' },
  { label: 'Aula avulsa', value: 'avulsa' },
];

/** Monta o calendário anual de uma oficina (aulas semanais) ou cria uma aula avulsa. */
export default function PlanCalendarScreen() {
  const params = useLocalSearchParams<{ oficinaId?: string }>();
  const db = useSQLiteContext();
  const user = useCurrentUser();
  const { showToast } = useToast();
  const today = todayIso();

  const [workshops, setWorkshops] = useState<OficinaResumo[] | null>(null);
  const [oficinaId, setOficinaId] = useState(params.oficinaId ?? '');
  const [mode, setMode] = useState('semanal');
  const [inicio, setInicio] = useState(isoToBr(today));
  const [fim, setFim] = useState(isoToBr(`${today.slice(0, 4)}-12-11`));
  const [dias, setDias] = useState<number[]>([]);
  const [horaInicio, setHoraInicio] = useState('14:00');
  const [horaFim, setHoraFim] = useState('15:00');
  const [errors, setErrors] = useState<FieldErrors<Field>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    listWorkshops(db).then(setWorkshops);
  }, [db]);

  const startIso = brToIso(inicio);
  const endIso = mode === 'avulsa' ? startIso : brToIso(fim);
  const weekdays = useMemo(() => (mode === 'avulsa' && startIso ? [weekday(startIso)] : dias), [mode, startIso, dias]);
  const preview = startIso && endIso ? generateDates(startIso, endIso, weekdays).length : 0;

  const toggleDay = (day: number) => setDias((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort()));

  const save = async () => {
    const found: FieldErrors<Field> = {};
    if (!oficinaId) found.oficina = 'Escolha a oficina.';
    if (!startIso) found.inicio = 'Data inválida.';
    if (mode === 'semanal') {
      if (!endIso) found.fim = 'Data inválida.';
      else if (startIso && endIso < startIso) found.fim = 'Deve ser depois do início.';
      if (dias.length === 0) found.dias = 'Escolha pelo menos um dia da semana.';
    }
    if (!isValidTime(horaInicio)) found.horaInicio = 'Use HH:MM.';
    if (!isValidTime(horaFim)) found.horaFim = 'Use HH:MM.';
    else if (isValidTime(horaInicio) && horaFim <= horaInicio) found.horaFim = 'Deve ser depois do início.';
    setErrors(found);
    if (Object.keys(found).length) {
      showToast('Corrija os campos destacados.', 'error');
      return;
    }

    setSaving(true);
    try {
      const created = await planClasses(
        db,
        { oficinaId: Number(oficinaId), inicio: startIso!, fim: endIso!, diasSemana: weekdays, horaInicio, horaFim },
        user,
      );
      showToast(created === 0 ? 'Essas datas já estavam no calendário.' : `${created} ${created === 1 ? 'aula criada' : 'aulas criadas'} no calendário.`, created === 0 ? 'info' : 'success');
      router.back();
    } catch (error) {
      showToast(errorMessage(error, 'Não foi possível montar o calendário.'), 'error');
      setSaving(false);
    }
  };

  if (workshops && workshops.length === 0) {
    return (
      <EmptyState
        icon="workshop"
        title="Cadastre uma oficina primeiro"
        message="O calendário é montado por oficina."
        actionLabel="Nova oficina"
        onAction={() => router.replace('/oficinas/nova')}
      />
    );
  }

  return (
    <FormScreen footer={<Button title={preview ? `Criar ${preview} ${preview === 1 ? 'aula' : 'aulas'}` : 'Criar aulas'} icon="plan" onPress={save} loading={saving} />}>
      <Card title="Oficina" icon="workshop">
        <SelectField
          label="Oficina"
          required
          options={(workshops ?? []).map((w) => ({ label: w.nome, value: String(w.id) }))}
          value={oficinaId}
          onChange={setOficinaId}
          error={errors.oficina}
          chipLimit={0}
        />
        <SelectField label="Tipo" required options={MODES} value={mode} onChange={setMode} />
      </Card>

      <Card title="Quando" icon="calendar">
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label={mode === 'avulsa' ? 'Data' : 'De'} required value={inicio} onChangeText={setInicio} mask={maskDate} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} error={errors.inicio} />
          </View>
          {mode === 'semanal' && (
            <View style={styles.flex}>
              <TextField label="Até" required value={fim} onChangeText={setFim} mask={maskDate} keyboardType="number-pad" placeholder="dd/mm/aaaa" maxLength={10} error={errors.fim} />
            </View>
          )}
        </View>

        {mode === 'semanal' && (
          <View style={styles.days}>
            <AppText variant="label">
              Dias da semana <AppText variant="label" color="terracotta">*</AppText>
            </AppText>
            <View style={styles.chips}>
              {WEEKDAYS_SHORT.map((label, index) => (
                <Chip key={label} label={label} selected={dias.includes(index)} onPress={() => toggleDay(index)} />
              ))}
            </View>
            {errors.dias && <AppText variant="caption" color="danger">{errors.dias}</AppText>}
          </View>
        )}

        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField label="Início" required value={horaInicio} onChangeText={setHoraInicio} mask={maskTime} keyboardType="number-pad" maxLength={5} error={errors.horaInicio} />
          </View>
          <View style={styles.flex}>
            <TextField label="Término" required value={horaFim} onChangeText={setHoraFim} mask={maskTime} keyboardType="number-pad" maxLength={5} error={errors.horaFim} />
          </View>
        </View>

        <AppText variant="caption">
          {preview > 0
            ? `Serão criadas até ${preview} aulas. Datas que já têm aula desta oficina são puladas.`
            : 'Escolha o período e os dias para ver quantas aulas serão criadas.'}
        </AppText>
      </Card>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 12 },
  days: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
