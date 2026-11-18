import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { InfoRow } from '@/components/info-row';
import { MaxContentWidth } from '@/constants/theme';
import { useSync } from '@/context/sync-context';
import { useTheme } from '@/hooks/use-theme';
import { confirmAsync } from '@/lib/confirm';
import { formatDateTime } from '@/lib/format';
import { listQueue, type QueueItem } from '@/sync/outbox';

const TABLE_LABEL: Record<string, string> = {
  alunos: 'Aluno',
  historico: 'Histórico',
  auditoria: 'Auditoria',
  oficinas: 'Oficina',
  oficina_professores: 'Professor na oficina',
  oficina_alunos: 'Matrícula',
  aulas: 'Aula',
  presencas: 'Presença',
  relatorios_comportamento: 'Relatório',
};

const OPERATION_LABEL: Record<QueueItem['operacao'], string> = {
  inserir: 'Criar',
  salvar: 'Salvar',
  excluir: 'Excluir',
};

/**
 * Mostra o estado do modo offline: conexão, fila de alterações ainda não
 * enviadas (na ordem em que serão enviadas) e itens recusados pelo servidor.
 */
export default function SyncScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const sync = useSync();
  const [items, setItems] = useState<QueueItem[]>([]);

  const { pendentes, erros, syncing } = sync;
  useFocusEffect(
    useCallback(() => {
      listQueue(db, 100).then(setItems);
      // Recarrega quando os contadores mudam (envio em andamento).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recarrega quando a sincronização traz dados novos
    }, [db, pendentes, erros, syncing]),
  );

  const discard = async () => {
    const confirmed = await confirmAsync({
      title: 'Descartar alterações recusadas?',
      message: 'Os itens com erro serão apagados da fila e o app baixará novamente os dados do servidor.',
      confirmLabel: 'Descartar',
      destructive: true,
    });
    if (confirmed) await sync.discardErrorsAndReload();
  };

  return (
    <ScrollView style={{ backgroundColor: theme.background }} contentContainerStyle={styles.scroll}>
      <View style={styles.inner}>
        <Card title={sync.online ? 'Conectado' : 'Sem conexão'} subtitle="Offline first: tudo é salvo primeiro no aparelho" icon={sync.online ? 'cloud' : 'cloudOff'}>
          <InfoRow label="Alterações na fila" value={String(sync.pendentes)} />
          <InfoRow label="Recusadas pelo servidor" value={String(sync.erros)} />
          <InfoRow label="Última sincronização" value={sync.ultimaSync ? formatDateTime(sync.ultimaSync) : 'Ainda não sincronizado'} />
          {sync.ultimoErro && (
            <AppText variant="caption" color="danger">
              {sync.ultimoErro}
            </AppText>
          )}
          <Button
            title={sync.syncing ? 'Sincronizando…' : 'Sincronizar agora'}
            icon="sync"
            onPress={sync.syncNow}
            loading={sync.syncing}
            disabled={!sync.online}
          />
          {!sync.online && (
            <AppText variant="caption">
              Pode continuar usando o app normalmente. As alterações ficam na fila e são enviadas, na ordem, assim que a internet voltar.
            </AppText>
          )}
        </Card>

        {sync.erros > 0 && (
          <Card title="Itens com erro" subtitle="O servidor recusou estas alterações" icon="warning">
            <Button title="Tentar enviar de novo" variant="secondary" icon="sync" onPress={sync.retryErrors} />
            <Button title="Descartar e baixar do servidor" variant="danger" icon="delete" onPress={discard} />
          </Card>
        )}

        <Card title="Fila de envio" subtitle={items.length === 0 ? 'Nada pendente: tudo foi enviado' : 'Enviada de cima para baixo'} icon="history">
          {items.map((item) => (
            <View key={item.id} style={[styles.row, { borderBottomColor: theme.border }]}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">
                  #{item.id} · {OPERATION_LABEL[item.operacao]} {TABLE_LABEL[item.tabela]?.toLowerCase() ?? item.tabela}
                </AppText>
                <AppText variant="caption">
                  {formatDateTime(item.criado_em)}
                  {item.tentativas > 0 ? ` · ${item.tentativas} tentativa(s)` : ''}
                </AppText>
                {item.ultimo_erro && (
                  <AppText variant="caption" color={item.status === 'erro' ? 'danger' : undefined}>
                    {item.ultimo_erro}
                  </AppText>
                )}
              </View>
              <Badge label={item.status === 'erro' ? 'Erro' : 'Pendente'} tone={item.status === 'erro' ? 'danger' : 'neutral'} />
            </View>
          ))}
          {sync.pendentes + sync.erros > items.length && (
            <AppText variant="caption">e mais {sync.pendentes + sync.erros - items.length} item(ns)…</AppText>
          )}
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingVertical: 16, paddingBottom: 60 },
  inner: { paddingHorizontal: 16, gap: 16, width: '100%', maxWidth: MaxContentWidth + 32, alignSelf: 'center' },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
});
