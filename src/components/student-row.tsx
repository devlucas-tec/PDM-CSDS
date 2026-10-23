import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import type { AlunoResumo } from '@/database/student-repository';
import { useTheme } from '@/hooks/use-theme';
import { calculateAge, initials } from '@/lib/format';

type StudentRowProps = {
  aluno: AlunoResumo;
  onView: (id: number) => void;
  onEdit: (id: number) => void;
};

/** Linha da listagem: toque abre a ficha; o botão de lápis abre a edição. */
export const StudentRow = memo(function StudentRow({ aluno, onView, onEdit }: StudentRowProps) {
  const theme = useTheme();
  const age = calculateAge(aluno.data_nascimento);
  const displayName = aluno.nome_social || aluno.nome;

  return (
    <Pressable
      onPress={() => onView(aluno.id)}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${age} anos, ${aluno.serie ?? 'série não informada'}, bairro ${aluno.bairro}`}
      accessibilityHint="Abre a ficha do aluno"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 },
      ]}>
      <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
        <AppText variant="bodyStrong" color="primary">
          {initials(displayName)}
        </AppText>
      </View>

      <View style={styles.info}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {displayName}
        </AppText>
        <AppText variant="caption" numberOfLines={1}>
          {age} anos · {aluno.serie ?? 'Série não informada'} · {aluno.bairro}
        </AppText>
        {(aluno.bolsa_familia === 1 || aluno.possui_deficiencia === 1) && (
          <View style={styles.badges}>
            {aluno.bolsa_familia === 1 && <Badge label="Bolsa Família" tone="accent" />}
            {aluno.possui_deficiencia === 1 && <Badge label="Deficiência" tone="terracotta" />}
          </View>
        )}
      </View>

      <Pressable
        onPress={() => onEdit(aluno.id)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Editar ${displayName}`}
        style={({ pressed }) => [styles.editButton, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}>
        <Icon name="edit" size={18} color={theme.primary} />
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, gap: 2 },
  badges: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
  editButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
