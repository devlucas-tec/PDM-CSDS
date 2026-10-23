import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { iconSymbol } from '@/components/ui/icon';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';
import { isGestor } from '@/lib/permissions';

/**
 * Abas por perfil. Professor: Agenda e Conta. Coordenação/admin: também
 * Alunos, Relatórios e Análise social. Abas ocultas não podem ser abertas.
 */
export default function TabsLayout() {
  const theme = useTheme();
  const { user } = useAuth();
  const gestor = isGestor(user?.perfil);

  return (
    <NativeTabs
      backgroundColor={theme.surface}
      indicatorColor={theme.primarySoft}
      iconColor={{ default: theme.textSecondary, selected: theme.primary }}
      labelStyle={{ default: { color: theme.textSecondary }, selected: { color: theme.primary } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Agenda</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...iconSymbol('calendar')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="alunos" hidden={!gestor}>
        <NativeTabs.Trigger.Label>Alunos</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...iconSymbol('alunos')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="relatorios" hidden={!gestor}>
        <NativeTabs.Trigger.Label>Relatórios</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...iconSymbol('report')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="dashboard" hidden={!gestor}>
        <NativeTabs.Trigger.Label>Análise</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...iconSymbol('dashboard')} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="conta">
        <NativeTabs.Trigger.Label>Conta</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon {...iconSymbol('conta')} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
