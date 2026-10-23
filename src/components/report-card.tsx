import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Radius } from '@/constants/theme';
import type { RelatorioDetalhado, StatusRelatorio } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate } from '@/lib/calendar';

export const REPORT_STATUS: Record<StatusRelatorio, { label: string; tone: 'terracotta' | 'neutral' | 'primary' }> = {
  novo: { label: 'Novo', tone: 'terracotta' },
  lido: { label: 'Lido', tone: 'neutral' },
  contato_realizado: { label: 'Contato realizado', tone: 'primary' },
};

type ReportCardProps = {
  report: RelatorioDetalhado;
  onPress?: (id: number) => void;
  /** Na ficha do aluno o nome dele é redundante. */
  hideStudent?: boolean;
};

export const ReportCard = memo(function ReportCard({ report, onPress, hideStudent }: ReportCardProps) {
  const theme = useTheme();
  const status = REPORT_STATUS[report.status];
  const isNew = report.status === 'novo';
  return (
    <Pressable
      disabled={!onPress}
      onPress={() => onPress?.(report.id)}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`Relatório${hideStudent ? '' : ` de ${report.aluno_nome}`}, ${status.label}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: isNew ? theme.terracotta : theme.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={styles.header}>
        <View style={styles.flex}>
          {!hideStudent && <AppText variant="bodyStrong">{report.aluno_nome}</AppText>}
          <AppText variant="caption">
            {[report.oficina_nome, report.aula_data && formatShortDate(report.aula_data), report.professor_nome].filter(Boolean).join(' · ')}
          </AppText>
        </View>
        <Badge label={status.label} tone={status.tone} />
      </View>
      <AppText variant="body" numberOfLines={onPress ? 3 : undefined}>
        {report.texto}
      </AppText>
      {report.observacao_coordenacao && (
        <View style={[styles.note, { backgroundColor: theme.primarySoft }]}>
          <AppText variant="caption" color="text">
            Coordenação: {report.observacao_coordenacao}
          </AppText>
        </View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { padding: 14, borderRadius: Radius.md, borderWidth: 1, gap: 8 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  flex: { flex: 1, gap: 2 },
  note: { padding: 10, borderRadius: Radius.sm },
});
