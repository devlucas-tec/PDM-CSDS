import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import type { AulaDetalhada } from '@/database/types';
import { useTheme } from '@/hooks/use-theme';
import { formatShortDate } from '@/lib/calendar';

type ClassCardProps = {
  aula: AulaDetalhada;
  onPress: (id: number) => void;
  showDate?: boolean;
  today: string;
};

/** Cartão de uma aula do calendário, com horário, status e andamento da chamada. */
export const ClassCard = memo(function ClassCard({ aula, onPress, showDate, today }: ClassCardProps) {
  const theme = useTheme();
  const cancelled = aula.status === 'cancelada';
  const pendingAttendance = !cancelled && aula.data <= today && aula.total_registrados === 0 && aula.total_matriculados > 0;

  return (
    <Pressable
      onPress={() => onPress(aula.id)}
      accessibilityRole="button"
      accessibilityLabel={`${aula.oficina_nome}, ${aula.hora_inicio} às ${aula.hora_fim}${cancelled ? ', cancelada' : ''}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.stripe, { backgroundColor: cancelled ? theme.danger : aula.status === 'remarcada' ? theme.accent : theme.primary }]} />
      <View style={styles.time}>
        <AppText variant="bodyStrong" style={cancelled && styles.strike}>
          {aula.hora_inicio}
        </AppText>
        <AppText variant="caption">{aula.hora_fim}</AppText>
      </View>
      <View style={styles.info}>
        {showDate && (
          <AppText variant="overline" color="primary">
            {formatShortDate(aula.data)}
          </AppText>
        )}
        <AppText variant="bodyStrong" numberOfLines={1} style={cancelled && styles.strike}>
          {aula.oficina_nome}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {[aula.oficina_local, aula.professores].filter(Boolean).join(' · ') || 'Sem professor vinculado'}
        </AppText>
        <View style={styles.badges}>
          {cancelled && <Badge label="Cancelada" tone="danger" />}
          {aula.status === 'remarcada' && <Badge label="Remarcada" tone="accent" />}
          {aula.total_registrados > 0 && (
            <Badge label={`Chamada: ${aula.total_presentes}/${aula.total_registrados}`} tone="primary" />
          )}
          {pendingAttendance && <Badge label="Chamada pendente" tone="terracotta" />}
        </View>
      </View>
      <Icon name="chevronRight" size={20} color={theme.textSecondary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingRight: 12,
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  stripe: { width: 5, alignSelf: 'stretch' },
  time: { width: 50, alignItems: 'center' },
  info: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  strike: { textDecorationLine: 'line-through' },
});
