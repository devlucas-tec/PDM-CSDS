import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { AppText } from '@/components/ui/app-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChartItem } from '@/lib/stats';

/**
 * Gráficos simples feitos com View/SVG. Cada barra mostra o valor ao lado
 * (rótulo direto), então a informação nunca depende só da cor.
 */

function accessibleSummary(title: string, items: ChartItem[]) {
  return `${title}: ${items.map((item) => `${item.label}, ${item.value}`).join('; ')}`;
}

/** Barras horizontais — boas para categorias com nomes longos (bairros, escolas). */
export function HorizontalBarChart({ title, items, color }: { title: string; items: ChartItem[]; color?: string }) {
  const theme = useTheme();
  const max = Math.max(1, ...items.map((item) => item.value));
  const fill = color ?? theme.chart[0];

  if (items.every((item) => item.value === 0)) return <NoData />;

  return (
    <View style={styles.hList} accessible accessibilityLabel={accessibleSummary(title, items)}>
      {items.map((item) => (
        <View key={item.label} style={styles.hRow}>
          <AppText variant="caption" color="text" style={styles.hLabel} numberOfLines={2}>
            {item.label}
          </AppText>
          <View style={styles.hTrack}>
            {item.value > 0 && (
              <View style={[styles.hBar, { width: `${(item.value / max) * 100}%`, backgroundColor: fill }]} />
            )}
          </View>
          <AppText variant="label" style={styles.hValue}>
            {item.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** Colunas verticais — para faixas ordenadas (idade, tamanho da família). */
export function ColumnChart({ title, items, color }: { title: string; items: ChartItem[]; color?: string }) {
  const theme = useTheme();
  const max = Math.max(1, ...items.map((item) => item.value));
  const fill = color ?? theme.chart[0];

  if (items.every((item) => item.value === 0)) return <NoData />;

  return (
    <View accessible accessibilityLabel={accessibleSummary(title, items)}>
      <View style={[styles.columns, { borderBottomColor: theme.border }]}>
        {items.map((item) => (
          <View key={item.label} style={styles.column}>
            <AppText variant="label">{item.value}</AppText>
            <View style={[styles.columnBar, { height: `${Math.max((item.value / max) * 100, item.value ? 4 : 0)}%`, backgroundColor: fill }]} />
          </View>
        ))}
      </View>
      <View style={styles.columnLabels}>
        {items.map((item) => (
          <AppText key={item.label} variant="caption" style={styles.columnLabel}>
            {item.label}
          </AppText>
        ))}
      </View>
    </View>
  );
}

/** Rosca para poucas categorias (ex.: gênero), com legenda e percentuais. */
export function DonutChart({ title, items }: { title: string; items: ChartItem[] }) {
  const theme = useTheme();
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return <NoData />;

  const size = 132;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const gap = items.filter((i) => i.value > 0).length > 1 ? 0.04 : 0;
  // Ângulo inicial de cada fatia = soma das fatias anteriores, começando no topo.
  const sweeps = items.map((item) => (item.value / total) * Math.PI * 2);
  const offsets = sweeps.map((_, index) => -Math.PI / 2 + sweeps.slice(0, index).reduce((sum, s) => sum + s, 0));

  const arcs = items.map((item, index) => {
    const sweep = sweeps[index];
    const start = offsets[index] + gap / 2;
    const end = offsets[index] + sweep - gap / 2;
    if (item.value === 0) return null;
    if (sweep >= Math.PI * 2 - 0.001) {
      // Círculo completo: desenha em duas metades.
      const d = `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius}`;
      return <Path key={item.label} d={d} stroke={theme.chart[index % theme.chart.length]} strokeWidth={stroke} fill="none" />;
    }
    const x1 = center + radius * Math.cos(start);
    const y1 = center + radius * Math.sin(start);
    const x2 = center + radius * Math.cos(end);
    const y2 = center + radius * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    const d = `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
    return <Path key={item.label} d={d} stroke={theme.chart[index % theme.chart.length]} strokeWidth={stroke} fill="none" />;
  });

  return (
    <View style={styles.donutRow} accessible accessibilityLabel={accessibleSummary(title, items)}>
      <Svg width={size} height={size}>{arcs}</Svg>
      <View style={styles.legend}>
        {items.map((item, index) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: theme.chart[index % theme.chart.length] }]} />
            <View>
              <AppText variant="bodyStrong">{Math.round((item.value / total) * 100)}%</AppText>
              <AppText variant="caption">
                {item.label} ({item.value})
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

type Segment = { label: string; value: number; percent: number; color: string; icon: IconName };

/** Barra empilhada com legenda — usada na distribuição de vulnerabilidade. */
export function StackedBar({ title, segments }: { title: string; segments: Segment[] }) {
  const theme = useTheme();
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return <NoData />;

  return (
    <View style={styles.stack} accessible accessibilityLabel={`${title}: ${segments.map((s) => `${s.label} ${s.percent}%`).join(', ')}`}>
      <View style={styles.stackTrack}>
        {segments
          .filter((s) => s.value > 0)
          .map((s) => (
            <View key={s.label} style={[styles.stackSegment, { flex: s.value, backgroundColor: s.color }]} />
          ))}
      </View>
      <View style={styles.stackLegend}>
        {segments.map((s) => (
          <View key={s.label} style={[styles.stackItem, { backgroundColor: theme.backgroundElement }]}>
            <Icon name={s.icon} size={16} color={s.color} />
            <View>
              <AppText variant="heading">{s.percent}%</AppText>
              <AppText variant="caption">
                {s.label} · {s.value}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function NoData() {
  return <AppText variant="caption">Sem dados para os filtros selecionados.</AppText>;
}

const styles = StyleSheet.create({
  hList: { gap: 10 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hLabel: { width: 112 },
  hTrack: { flex: 1, height: 14, justifyContent: 'center' },
  hBar: { height: 14, borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  hValue: { width: 30, textAlign: 'right' },
  columns: {
    height: 140,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    borderBottomWidth: 1,
  },
  column: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 4, paddingHorizontal: 6 },
  columnBar: { width: '100%', maxWidth: 48, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  columnLabels: { flexDirection: 'row', gap: 2, marginTop: 6 },
  columnLabel: { flex: 1, textAlign: 'center' },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  legend: { flex: 1, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  stack: { gap: 14 },
  stackTrack: { flexDirection: 'row', height: 18, borderRadius: Radius.sm, overflow: 'hidden', gap: 2 },
  stackSegment: { height: '100%' },
  stackLegend: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stackItem: { flex: 1, minWidth: 92, flexDirection: 'row', gap: 8, padding: 10, borderRadius: Radius.md, alignItems: 'flex-start' },
});
