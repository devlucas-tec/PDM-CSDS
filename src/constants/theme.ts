/**
 * Paleta da Casa São Domingos Sávio, tirada da logomarca: verde-oliva da casa,
 * dourado/mostarda do letreiro e terracota da capela. Tons para tema claro e escuro.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#2A3020',
    textSecondary: '#666D5A',
    background: '#F5F4EC',
    surface: '#FFFFFF',
    backgroundElement: '#ECEBDF',
    backgroundSelected: '#DDE3C8',
    border: '#E1DFD1',
    primary: '#4F5F2A',
    primarySoft: '#E4EACF',
    onPrimary: '#FFFFFF',
    accent: '#E3A12F',
    accentSoft: '#FBEFD6',
    terracotta: '#B95C34',
    terracottaSoft: '#F6E2D8',
    danger: '#B3261E',
    dangerSoft: '#F9DEDC',
    success: '#3E7B3A',
    successSoft: '#DCEFD9',
    // Paleta categórica validada (faixa de luminosidade, croma, daltonismo e contraste).
    chart: ['#6F8A34', '#2F7FB0', '#C98A1E', '#9A5BB5'],
  },
  dark: {
    text: '#EEF0E6',
    textSecondary: '#A7AD9A',
    background: '#13160E',
    surface: '#1D2117',
    backgroundElement: '#262B1F',
    backgroundSelected: '#34402A',
    border: '#323828',
    primary: '#AFC56F',
    primarySoft: '#2E3820',
    onPrimary: '#1A1F10',
    accent: '#F0B954',
    accentSoft: '#3B2F17',
    terracotta: '#E08A62',
    terracottaSoft: '#3E2519',
    danger: '#F2B8B5',
    dangerSoft: '#4A1F1C',
    success: '#9CD39A',
    successSoft: '#1F3520',
    // Mesmos matizes, recalibrados e validados contra a superfície escura.
    chart: ['#7E9C3A', '#3F8BC0', '#B5821F', '#A06CC0'],
  },
} as const;

export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  pill: 999,
} as const;

export const MaxContentWidth = 760;
