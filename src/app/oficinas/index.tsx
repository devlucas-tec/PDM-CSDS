import { router, Stack, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { EmptyState, LoadingState } from '@/components/ui/states';
import { MaxContentWidth, Radius } from '@/constants/theme';
import type { OficinaResumo } from '@/database/types';
import { listWorkshops } from '@/database/workshop-repository';
import { useTheme } from '@/hooks/use-theme';

export default function WorkshopsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const [items, setItems] = useState<OficinaResumo[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      listWorkshops(db).then(setItems);
    }, [db]),
  );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.push('/oficinas/nova')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Nova oficina">
              <Icon name="add" color={theme.primary} />
            </Pressable>
          ),
        }}
      />
      {!items ? (
        <LoadingState />
      ) : (
        <FlatList
          style={{ backgroundColor: theme.background }}
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <EmptyState icon="workshop" title="Nenhuma oficina" message="Cadastre as oficinas da Casa." actionLabel="Nova oficina" onAction={() => router.push('/oficinas/nova')} />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push({ pathname: '/oficinas/[id]', params: { id: String(item.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`${item.nome}, ${item.total_alunos} alunos`}
              style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}>
              <View style={[styles.icon, { backgroundColor: theme.primarySoft }]}>
                <Icon name="workshop" size={20} color={theme.primary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{item.nome}</AppText>
                <AppText variant="caption" numberOfLines={1}>
                  {item.professores ?? 'Sem professor vinculado'}
                  {item.local ? ` · ${item.local}` : ''}
                </AppText>
                <View style={styles.badges}>
                  <Badge label={`${item.total_alunos} alunos`} tone="primary" />
                  <Badge label={`${item.total_aulas} aulas no calendário`} />
                </View>
              </View>
              <Icon name="chevronRight" size={20} color={theme.textSecondary} />
            </Pressable>
          )}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { padding: 16, gap: 10, paddingBottom: 48, width: '100%', maxWidth: MaxContentWidth + 32, alignSelf: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: Radius.md, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
