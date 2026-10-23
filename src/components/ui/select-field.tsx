import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Chip } from '@/components/ui/chip';
import { Icon } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Option = { label: string; value: string };

type SelectFieldProps = {
  label: string;
  value: string;
  options: readonly (string | Option)[];
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  /** Até este número de opções são exibidas como chips; acima disso, abre uma lista. */
  chipLimit?: number;
  /** Permite desmarcar a opção selecionada (campo opcional). */
  clearable?: boolean;
};

const toOption = (option: string | Option): Option => (typeof option === 'string' ? { label: option, value: option } : option);

export function SelectField({
  label,
  value,
  options,
  onChange,
  error,
  required,
  placeholder = 'Selecionar',
  chipLimit = 6,
  clearable = !required,
}: SelectFieldProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const items = options.map(toOption);
  const selected = items.find((item) => item.value === value);

  const select = (next: string) => {
    onChange(clearable && next === value ? '' : next);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">
        {label}
        {required && <AppText variant="label" color="terracotta"> *</AppText>}
      </AppText>

      {items.length <= chipLimit ? (
        <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel={label}>
          {items.map((item) => (
            <Chip key={item.value} label={item.label} selected={item.value === value} onPress={() => select(item.value)} />
          ))}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${selected?.label ?? 'nenhum selecionado'}`}
          onPress={() => setOpen(true)}
          style={[
            styles.trigger,
            { backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.border, borderWidth: error ? 1.5 : 1 },
          ]}>
          <AppText style={styles.triggerText} color={selected ? 'text' : 'textSecondary'} numberOfLines={1}>
            {selected?.label ?? placeholder}
          </AppText>
          <Icon name="chevronDown" size={20} color={theme.textSecondary} />
        </Pressable>
      )}

      {error && (
        <View style={styles.messageRow}>
          <Icon name="error" size={14} color={theme.danger} />
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
        </View>
      )}

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel="Fechar lista" />
        <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.sheetHeader}>
            <AppText variant="heading">{label}</AppText>
            <Pressable onPress={() => setOpen(false)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar">
              <Icon name="close" color={theme.textSecondary} />
            </Pressable>
          </View>
          <FlatList
            data={items}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => {
              const active = item.value === value;
              return (
                <Pressable
                  onPress={() => select(item.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={[styles.option, active && { backgroundColor: theme.primarySoft }]}>
                  <AppText style={styles.triggerText} color={active ? 'primary' : 'text'}>
                    {item.label}
                  </AppText>
                  {active && <Icon name="check" size={20} color={theme.primary} />}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trigger: {
    minHeight: 50,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  triggerText: { flex: 1 },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '70%', borderTopLeftRadius: Radius.lg, borderTopRightRadius: Radius.lg, paddingTop: 8 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  option: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 8,
  },
});
