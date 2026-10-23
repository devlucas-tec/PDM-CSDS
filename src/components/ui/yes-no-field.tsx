import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type YesNoFieldProps = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
};

/** Campo booleano: só aceita "Sim" ou "Não" (regra da minuta). */
export function YesNoField({ label, value, onChange }: YesNoFieldProps) {
  const theme = useTheme();
  const options = [
    { label: 'Sim', value: true },
    { label: 'Não', value: false },
  ];

  return (
    <View style={styles.row}>
      <AppText variant="bodyStrong" style={styles.label}>
        {label}
      </AppText>
      <View
        style={[styles.segment, { backgroundColor: theme.backgroundElement }]}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <Pressable
              key={option.label}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`${label}: ${option.label}`}
              style={[styles.option, active && { backgroundColor: option.value ? theme.primary : theme.surface }]}>
              <AppText
                variant="label"
                style={{ color: active ? (option.value ? theme.onPrimary : theme.text) : theme.textSecondary }}>
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  label: { flex: 1 },
  segment: { flexDirection: 'row', borderRadius: Radius.sm + 2, padding: 3 },
  option: { minWidth: 56, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
});
