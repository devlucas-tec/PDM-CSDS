import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthGrid, MONTHS, parseIso, WEEKDAYS_SHORT } from '@/lib/calendar';

export type DayMarker = { total: number; canceladas: number };

type MonthCalendarProps = {
  year: number;
  month: number; // 0–11
  selected: string;
  today: string;
  markers: Map<string, DayMarker>;
  onSelect: (iso: string) => void;
  onChangeMonth: (year: number, month: number) => void;
};

/** Calendário mensal: cada dia mostra um ponto quando há aulas (vermelho se alguma foi cancelada). */
export function MonthCalendar({ year, month, selected, today, markers, onSelect, onChangeMonth }: MonthCalendarProps) {
  const theme = useTheme();
  const weeks = monthGrid(year, month);

  const shift = (delta: number) => {
    const date = new Date(year, month + delta, 1);
    onChangeMonth(date.getFullYear(), date.getMonth());
  };

  return (
    <View style={[styles.wrapper, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Pressable onPress={() => shift(-1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Mês anterior" style={styles.arrow}>
          <Icon name="chevronRight" size={22} color={theme.primary} style={styles.flip} />
        </Pressable>
        <AppText variant="heading" accessibilityRole="header">
          {MONTHS[month]} {year}
        </AppText>
        <Pressable onPress={() => shift(1)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Próximo mês" style={styles.arrow}>
          <Icon name="chevronRight" size={22} color={theme.primary} />
        </Pressable>
      </View>

      <View style={styles.row}>
        {WEEKDAYS_SHORT.map((day) => (
          <AppText key={day} variant="caption" style={styles.weekday}>
            {day}
          </AppText>
        ))}
      </View>

      {weeks.map((week, index) => (
        <View key={index} style={styles.row}>
          {week.map((iso, cell) => {
            if (!iso) return <View key={cell} style={styles.cell} />;
            const marker = markers.get(iso);
            const isSelected = iso === selected;
            const isToday = iso === today;
            const day = parseIso(iso).getDate();
            return (
              <Pressable
                key={iso}
                onPress={() => onSelect(iso)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`Dia ${day}${marker ? `, ${marker.total} ${marker.total === 1 ? 'aula' : 'aulas'}` : ', sem aulas'}`}
                style={styles.cell}>
                <View
                  style={[
                    styles.day,
                    isToday && { borderColor: theme.accent, borderWidth: 2 },
                    isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
                  ]}>
                  <AppText variant="label" style={{ color: isSelected ? theme.onPrimary : theme.text }}>
                    {day}
                  </AppText>
                </View>
                <View style={styles.dots}>
                  {marker && marker.total > marker.canceladas && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                  {marker && marker.canceladas > 0 && <View style={[styles.dot, { backgroundColor: theme.danger }]} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderWidth: 1, borderRadius: Radius.lg, padding: 12, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  arrow: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  flip: { transform: [{ scaleX: -1 }] },
  row: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2, minHeight: 46 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  dots: { flexDirection: 'row', gap: 3, height: 6, marginTop: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
