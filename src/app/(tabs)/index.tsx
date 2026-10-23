import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { ClassCard } from '@/components/class-card';
import { MonthCalendar, type DayMarker } from '@/components/month-calendar';
import { TabHeader } from '@/components/tab-header';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField } from '@/components/ui/select-field';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth } from '@/constants/theme';
import { useCurrentUser } from '@/context/auth-context';
import { useToast } from '@/context/toast-context';
import { listClasses } from '@/database/class-repository';
import type { AulaDetalhada, OficinaResumo } from '@/database/types';
import { listTeacherWorkshops, listWorkshops } from '@/database/workshop-repository';
import { useTheme } from '@/hooks/use-theme';
import { addDays, formatLongDate, monthRange, parseIso } from '@/lib/calendar';
import { todayIso } from '@/lib/format';
import { isGestor } from '@/lib/permissions';

/**
 * Agenda: a coordenação vê e edita o calendário de todas as oficinas; o
 * professor vê apenas os dias das oficinas em que está vinculado.
 */
export default function AgendaScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { showToast } = useToast();
  const gestor = isGestor(user.perfil);
  const today = todayIso();

  const [year, setYear] = useState(() => parseIso(today).getFullYear());
  const [month, setMonth] = useState(() => parseIso(today).getMonth());
  const [selected, setSelected] = useState(today);
  const [oficinaId, setOficinaId] = useState('');
  const [workshops, setWorkshops] = useState<OficinaResumo[]>([]);
  const [classes, setClasses] = useState<AulaDetalhada[]>([]);
  const [upcoming, setUpcoming] = useState<AulaDetalhada[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const range = monthRange(year, month);
      const professorId = gestor ? null : user.id;
      const [list, ws, next] = await Promise.all([
        listClasses(db, { ...range, oficinaId: oficinaId ? Number(oficinaId) : null, professorId }),
        gestor ? listWorkshops(db) : listTeacherWorkshops(db, user.id),
        listClasses(db, { from: today, to: addDays(today, 14), oficinaId: oficinaId ? Number(oficinaId) : null, professorId }),
      ]);
      setClasses(list);
      setWorkshops(ws);
      setUpcoming(next.filter((a) => a.status !== 'cancelada').slice(0, 3));
    } catch {
      showToast('Não foi possível carregar a agenda.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, year, month, oficinaId, gestor, user.id, today, showToast]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const markers = useMemo(() => {
    const map = new Map<string, DayMarker>();
    for (const aula of classes) {
      const marker = map.get(aula.data) ?? { total: 0, canceladas: 0 };
      marker.total++;
      if (aula.status === 'cancelada') marker.canceladas++;
      map.set(aula.data, marker);
    }
    return map;
  }, [classes]);

  const dayClasses = classes.filter((a) => a.data === selected);
  const pending = classes.filter((a) => a.status !== 'cancelada' && a.data <= today && a.total_registrados === 0 && a.total_matriculados > 0);
  const openClass = useCallback((id: number) => router.push({ pathname: '/aulas/[id]', params: { id: String(id) } }), []);

  const goToday = () => {
    const date = parseIso(today);
    setYear(date.getFullYear());
    setMonth(date.getMonth());
    setSelected(today);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={theme.primary} colors={[theme.primary]} />}>
      <TabHeader
        overline={gestor ? 'Coordenação' : `Professor · ${user.nome}`}
        title={gestor ? 'Agenda' : 'Minhas aulas'}
        subtitle={gestor ? 'Calendário anual das oficinas' : 'Dias e horários das suas oficinas'}
        right={gestor ? <Button title="Planejar" icon="plan" compact onPress={() => router.push('/calendario/planejar')} /> : undefined}>
        {gestor && (
          <View style={styles.filterRow}>
            <View style={styles.flex}>
              <SelectField
                label="Oficina"
                options={workshops.map((w) => ({ label: w.nome, value: String(w.id) }))}
                value={oficinaId}
                onChange={setOficinaId}
                placeholder="Todas as oficinas"
                chipLimit={0}
              />
            </View>
            <Button title="Oficinas" icon="workshop" variant="secondary" compact onPress={() => router.push('/oficinas')} style={styles.workshopsButton} />
          </View>
        )}
      </TabHeader>

      <View style={styles.inner}>
        {loading ? (
          <LoadingState message="Carregando agenda..." />
        ) : !gestor && workshops.length === 0 ? (
          <EmptyState
            icon="workshop"
            title="Nenhuma oficina vinculada"
            message="Você ainda não está vinculado a nenhuma oficina. Fale com a coordenação."
          />
        ) : (
          <>
            {pending.length > 0 && (
              <Card title="Chamadas pendentes" subtitle={`${pending.length} ${pending.length === 1 ? 'aula' : 'aulas'} deste mês sem chamada`} icon="attendance">
                <View style={styles.list}>
                  {pending.slice(-3).reverse().map((aula) => (
                    <ClassCard key={aula.id} aula={aula} onPress={openClass} showDate today={today} />
                  ))}
                </View>
              </Card>
            )}

            {!gestor && upcoming.length > 0 && (
              <Card title="Próximas aulas" subtitle="Nos próximos 14 dias" icon="clock">
                <View style={styles.list}>
                  {upcoming.map((aula) => (
                    <ClassCard key={aula.id} aula={aula} onPress={openClass} showDate today={today} />
                  ))}
                </View>
              </Card>
            )}

            <MonthCalendar
              year={year}
              month={month}
              selected={selected}
              today={today}
              markers={markers}
              onSelect={setSelected}
              onChangeMonth={(y, m) => {
                setYear(y);
                setMonth(m);
              }}
            />

            <View style={styles.dayHeader}>
              <AppText variant="heading" style={styles.flex}>
                {formatLongDate(selected)}
              </AppText>
              {selected !== today && <Button title="Hoje" variant="ghost" compact onPress={goToday} />}
            </View>

            {dayClasses.length === 0 ? (
              <AppText variant="caption">Nenhuma aula neste dia.</AppText>
            ) : (
              <View style={styles.list}>
                {dayClasses.map((aula) => (
                  <ClassCard key={aula.id} aula={aula} onPress={openClass} today={today} />
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120 },
  inner: { paddingHorizontal: 16, gap: 14, width: '100%', maxWidth: MaxContentWidth + 32, alignSelf: 'center' },
  flex: { flex: 1 },
  filterRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  workshopsButton: { minHeight: 50 },
  list: { gap: 8 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
});
