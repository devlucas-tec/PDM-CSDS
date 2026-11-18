import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TabHeader } from '@/components/tab-header';
import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth, useCurrentUser } from '@/context/auth-context';
import { useDataVersion, useSync } from '@/context/sync-context';
import { useThemePreference, type ThemePreference } from '@/context/theme-preference-context';
import { useToast } from '@/context/toast-context';
import { listRecentAudit, type AuditEntry } from '@/database/audit-repository';
import { DEMO_PASSWORD, DEMO_STAFF, seedDemoData } from '@/database/seed';
import type { Usuario } from '@/database/types';
import { listUsers } from '@/database/user-repository';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';
import { formatDateTime, isoToBr } from '@/lib/format';
import { canManageUsers, isGestor, PERFIL_LABEL } from '@/lib/permissions';
import { createStaffAccount } from '@/services/users';
import { errorMessage } from '@/database/errors';

const THEMES: { label: string; value: ThemePreference }[] = [
  { label: 'Automático', value: 'system' },
  { label: 'Claro', value: 'light' },
  { label: 'Escuro', value: 'dark' },
];

const ACTION_LABEL: Record<AuditEntry['acao'], string> = {
  criar: 'Criou',
  editar: 'Editou',
  excluir: 'Excluiu',
  login: 'Entrou no sistema',
  logout: 'Saiu do sistema',
};

export default function AccountScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const { preference, setThemePreference } = useThemePreference();
  const { showToast } = useToast();
  const sync = useSync();
  const dataVersion = useDataVersion();
  const isAdmin = canManageUsers(user.perfil);
  const gestor = isGestor(user.perfil);

  const [users, setUsers] = useState<Usuario[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    const [userList, auditList] = await Promise.all([
      isAdmin ? listUsers(db) : Promise.resolve([]),
      gestor ? listRecentAudit(db, 10) : Promise.resolve([]),
    ]);
    setUsers(userList);
    setAudit(auditList);
    // dataVersion: recarrega quando chegam dados do servidor.
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega quando a sincronização traz dados novos
  }, [db, isAdmin, gestor, dataVersion]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSeed = async () => {
    const confirmed = await confirmAsync({
      title: 'Gerar dados de demonstração?',
      message:
        '40 alunos fictícios, a equipe (coordenação e 5 professores), as 9 oficinas com matrículas, o calendário do ano, chamadas e relatórios de comportamento. Nada do que já existe é apagado. As contas da equipe precisam de internet; o resto é gravado no aparelho e enviado pela fila.',
      confirmLabel: 'Gerar',
    });
    if (!confirmed) return;
    setSeeding(true);
    try {
      const summary = await seedDemoData(db, user, (person) => createStaffAccount(db, person));
      showToast(`Pronto: ${summary.alunos} alunos, ${summary.aulas} aulas, ${summary.presencas} presenças e ${summary.relatorios} relatórios.`);
      load();
    } catch (error) {
      showToast(errorMessage(error, 'Não foi possível gerar os dados de exemplo.'), 'error');
    } finally {
      setSeeding(false);
    }
  };

  const handleSignOut = async () => {
    const naoEnviadas = sync.pendentes + sync.erros;
    const confirmed = await confirmAsync(
      naoEnviadas > 0
        ? {
            title: 'Há alterações não enviadas',
            message: `${naoEnviadas} alteração(ões) ainda não chegaram ao servidor${sync.online ? '' : ' (sem conexão)'}. O app tentará enviar agora; o que não for enviado será perdido ao sair.`,
            confirmLabel: 'Sair mesmo assim',
            destructive: true,
          }
        : { title: 'Sair da conta?', message: 'Você precisará de internet para entrar novamente.', confirmLabel: 'Sair' },
    );
    if (confirmed) await signOut();
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <TabHeader overline={PERFIL_LABEL[user.perfil]} title={user.nome} subtitle={user.email} />
      <View style={styles.inner}>
        <Card title="Aparência" subtitle="Tema claro ou escuro" icon={preference === 'system' ? 'system' : preference}>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {THEMES.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={preference === option.value}
                onPress={() => setThemePreference(option.value)}
              />
            ))}
          </View>
        </Card>

        <Card
          title="Sincronização"
          subtitle={sync.online ? 'Conectado ao servidor' : 'Sem conexão: alterações ficam na fila'}
          icon={sync.online ? 'cloud' : 'cloudOff'}>
          <AppText variant="body">
            {sync.pendentes > 0 ? `${sync.pendentes} alteração(ões) aguardando envio.` : 'Nenhuma alteração pendente.'}
            {sync.erros > 0 ? ` ${sync.erros} recusada(s) pelo servidor.` : ''}
          </AppText>
          <Button title="Ver fila de sincronização" variant="secondary" icon="sync" onPress={() => router.push('/sincronizacao')} />
        </Card>

        {isAdmin && (
          <Card
            title="Usuários do sistema"
            subtitle={`${users.length} ${users.length === 1 ? 'conta' : 'contas'}`}
            icon="groups"
            right={<Button title="Novo" icon="personAdd" compact onPress={() => router.push('/usuarios/novo')} />}>
            <View style={styles.list}>
              {users.map((item) => (
                <View key={item.id} style={[styles.userRow, { borderBottomColor: theme.border }]}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{item.nome}</AppText>
                    <AppText variant="caption">
                      {item.email} · desde {isoToBr(item.created_at)}
                    </AppText>
                  </View>
                  <Badge label={PERFIL_LABEL[item.perfil]} tone={item.perfil === 'professor' ? 'neutral' : 'primary'} />
                </View>
              ))}
            </View>
          </Card>
        )}

        {gestor && (
          <Card title="Oficinas" subtitle="Professores, matrículas e calendário" icon="workshop">
            <Button title="Gerenciar oficinas" variant="secondary" icon="workshop" onPress={() => router.push('/oficinas')} />
          </Card>
        )}

        {gestor && (
        <Card title="Atividade recente" subtitle="Auditoria das últimas ações" icon="history">
          <View style={styles.list}>
            {audit.length === 0 && <AppText variant="caption">Nenhuma atividade registrada.</AppText>}
            {audit.map((entry) => (
              <View key={entry.id} style={[styles.userRow, { borderBottomColor: theme.border }]}>
                <View style={styles.flex}>
                  <AppText variant="body">
                    <AppText variant="bodyStrong">{entry.usuario_nome ?? 'Usuário removido'}</AppText> {ACTION_LABEL[entry.acao].toLowerCase()}{' '}
                    {entry.acao !== 'login' && entry.acao !== 'logout' && `${entry.entidade}${entry.descricao ? `: ${entry.descricao}` : ''}`}
                  </AppText>
                  <AppText variant="caption">{formatDateTime(entry.created_at)}</AppText>
                </View>
              </View>
            ))}
          </View>
        </Card>
        )}

        {isAdmin && (
          <Card title="Demonstração" subtitle="Preenche o app com um ano letivo fictício" icon="database">
            <Button title="Gerar dados de demonstração" variant="secondary" icon="add" onPress={handleSeed} loading={seeding} />
            <AppText variant="caption">
              Contas criadas (senha {DEMO_PASSWORD}):{'\n'}
              {DEMO_STAFF.map((p) => `${PERFIL_LABEL[p.perfil]}: ${p.email}`).join('\n')}
            </AppText>
          </Card>
        )}

        <Button title="Sair" variant="danger" icon="logout" onPress={handleSignOut} />

        <AppText variant="caption" style={styles.footer}>
          Casa São Domingos Sávio · Gestão de alunos{'\n'}Dados salvos no aparelho (SQLite) e sincronizados com o servidor (Supabase).
        </AppText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 120 },
  inner: { paddingHorizontal: 16, gap: 16, width: '100%', maxWidth: MaxContentWidth + 32, alignSelf: 'center' },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  list: { gap: 0 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  footer: { textAlign: 'center', marginTop: 8 },
});
