import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputInstance, type TextInputProps } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = Omit<TextInputProps, 'onChangeText' | 'value'> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  required?: boolean;
  hint?: string;
  icon?: IconName;
  /** Máscara aplicada a cada digitação (ex.: data, CPF, CEP). */
  mask?: (value: string) => string;
};

export const TextField = forwardRef<TextInputInstance, TextFieldProps>(function TextField(
  { label, value, onChangeText, error, required, hint, icon, mask, multiline, style, onFocus, onBlur, ...rest },
  ref,
) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? theme.danger : focused ? theme.primary : theme.border;

  return (
    <View style={styles.wrapper}>
      <AppText variant="label">
        {label}
        {required && <AppText variant="label" color="terracotta"> *</AppText>}
      </AppText>
      <View
        style={[
          styles.inputRow,
          multiline && styles.multilineRow,
          { borderColor, backgroundColor: theme.surface, borderWidth: focused || error ? 1.5 : 1 },
        ]}>
        {icon && <Icon name={icon} size={18} color={theme.textSecondary} />}
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(text) => onChangeText(mask ? mask(text) : text)}
          placeholderTextColor={theme.textSecondary}
          multiline={multiline}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          onFocus={(event) => {
            setFocused(true);
            onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          style={[styles.input, multiline && styles.multiline, { color: theme.text }, style]}
          {...rest}
        />
      </View>
      {error ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <Icon name="error" size={14} color={theme.danger} />
          <AppText variant="caption" color="danger" style={styles.message}>
            {error}
          </AppText>
        </View>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  inputRow: {
    minHeight: 50,
    borderRadius: Radius.md,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  multilineRow: { alignItems: 'flex-start', paddingVertical: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  multiline: { minHeight: 90, textAlignVertical: 'top', paddingVertical: 0 },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  message: { flex: 1 },
});
