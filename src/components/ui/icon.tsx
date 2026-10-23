import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

type SFName = SFSymbol;

/** Mapeia um nome único para o SF Symbol (iOS) e o Material Symbol (Android/web). */
const ICONS = {
  alunos: ['person.2.fill', 'group'],
  dashboard: ['chart.bar.fill', 'bar_chart'],
  conta: ['person.crop.circle', 'account_circle'],
  add: ['plus', 'add'],
  edit: ['pencil', 'edit'],
  delete: ['trash', 'delete'],
  search: ['magnifyingglass', 'search'],
  history: ['clock.arrow.circlepath', 'history'],
  filter: ['line.3.horizontal.decrease', 'filter_list'],
  sort: ['arrow.up.arrow.down', 'swap_vert'],
  share: ['square.and.arrow.up', 'share'],
  pdf: ['doc.richtext', 'picture_as_pdf'],
  logout: ['rectangle.portrait.and.arrow.right', 'logout'],
  chevronRight: ['chevron.right', 'chevron_right'],
  chevronDown: ['chevron.down', 'expand_more'],
  close: ['xmark', 'close'],
  check: ['checkmark', 'check'],
  checkCircle: ['checkmark.circle.fill', 'check_circle'],
  error: ['exclamationmark.circle.fill', 'error'],
  warning: ['exclamationmark.triangle.fill', 'warning'],
  info: ['info.circle', 'info'],
  personAdd: ['person.badge.plus', 'person_add'],
  dark: ['moon.fill', 'dark_mode'],
  light: ['sun.max.fill', 'light_mode'],
  system: ['circle.lefthalf.filled', 'settings_brightness'],
  home: ['house.fill', 'home'],
  health: ['cross.case.fill', 'medical_services'],
  school: ['graduationcap.fill', 'school'],
  child: ['figure.child', 'child_care'],
  family: ['figure.2.and.child.holdinghands', 'family_restroom'],
  location: ['mappin.and.ellipse', 'location_on'],
  lock: ['lock.fill', 'lock'],
  mail: ['envelope.fill', 'mail'],
  database: ['cylinder.split.1x2', 'database'],
  calendar: ['calendar', 'calendar_month'],
  badge: ['person.text.rectangle', 'badge'],
  groups: ['person.3.fill', 'groups'],
  view: ['eye', 'visibility'],
  report: ['doc.text.fill', 'description'],
  phone: ['phone.fill', 'call'],
  chat: ['message.fill', 'chat'],
  workshop: ['paintpalette.fill', 'palette'],
  clock: ['clock', 'schedule'],
  cancel: ['xmark.circle.fill', 'cancel'],
  plan: ['calendar.badge.plus', 'event_available'],
  reschedule: ['calendar.badge.clock', 'edit_calendar'],
  attendance: ['checklist', 'checklist'],
} satisfies Record<string, [SFName, AndroidSymbol]>;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 22, color, style }: IconProps) {
  const [ios, android] = ICONS[name];
  return (
    <SymbolView
      name={{ ios, android, web: android }}
      size={size}
      tintColor={color}
      style={style}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

export function iconSymbol(name: IconName) {
  const [sf, md] = ICONS[name];
  return { sf, md };
}
