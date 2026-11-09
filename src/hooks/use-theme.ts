/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useThemePreference } from '@/context/theme-preference-context';

export function useTheme() {
  const { colorScheme } = useThemePreference();
  return Colors[colorScheme];
}

export function useIsDark() {
  return useThemePreference().colorScheme === 'dark';
}
