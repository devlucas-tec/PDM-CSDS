import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type MultiOption = { id: number; label: string; detail?: string };

type MultiSelectFieldProps = {
  label: string;
  options: MultiOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  emptyText?: string;
  searchable?: boolean;
  hint?: string;
};

/** Seleção de vários itens (professores, alunos) em uma lista com busca. */
export function MultiSelectField({ label, options, value, onChange, emptyText = 'Nenhum selecionado', searchable, hint }: MultiSelectFieldProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selected = new Set(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const toggle = (id: number) => {
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  const names = options.filter((o) => selected.has(o.id)).map((o) => o.label);

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${names.length} selecionados`}
        style={[styles.trigger, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">{names.length ? `${names.length} selecionado${names.length > 1 ? 's' : ''}` : emptyText}</AppText>
          {names.length > 0 && (
            <AppText variant="caption" numberOfLines={2}>
              {names.join(', ')}
            </AppText>
          )}
        </View>
        <Icon name="edit" size={18} color={theme.primary} />
      </Pressable>
      {hint && <AppText variant="caption">{hint}</AppText>}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fechar lista" />
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHeader}>
            <AppText variant="heading">{label}</AppText>
            <AppText variant="caption">{value.length} selecionados</AppText>
          </View>
          {searchable && (
            <View style={styles.search}>
              <TextField label="Buscar" icon="search" value={query} onChangeText={setQuery} placeholder="Digite um nome" />
            </View>
          )}
          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<AppText variant="caption" style={styles.empty}>Nada encontrado.</AppText>}
            renderItem={({ item }) => {
              const active = selected.has(item.id);
              return (
                <Pressable
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  accessibilityLabel={item.label}
                  style={styles.option}>
                  <View style={[styles.box, { borderColor: active ? theme.primary : theme.border, backgroundColor: active ? theme.primary : 'transparent' }]}>
                    {active && <Icon name="check" size={16} color={theme.onPrimary} />}
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="body">{item.label}</AppText>
                    {item.detail && <AppText variant="caption">{item.detail}</AppText>}
                  </View>
                </Pressable>
              );
            }}
          />
          <View style={styles.footer}>
            <Button title="Concluir" icon="check" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  flex: { flex: 1 },
  trigger: { minHeight: 56, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '85%', borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingTop: 8 },
  sheetHeader: { paddingHorizontal: 20, paddingVertical: 12, gap: 2 },
  search: { paddingHorizontal: 20, paddingBottom: 8 },
  option: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 8 },
  box: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', padding: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
});
