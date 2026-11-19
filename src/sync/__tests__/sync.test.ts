/**
 * @jest-environment node
 */
import { FakeRemote } from './fake-remote';

import { addUser, student } from '@/database/__tests__/fixtures';
import { openTestDatabase } from '@/database/__tests__/node-sqlite-adapter';
import { migrateDatabase } from '@/database/schema';
import { createStudent, deleteStudent, getStudent, listStudents, updateStudent } from '@/database/student-repository';
import { pullChanges, pushQueue, resetLocalData, syncNow } from '@/sync/engine';
import { countPending, discardFailed, listQueue } from '@/sync/outbox';
import { RemoteError } from '@/sync/remote';

jest.mock('expo-crypto', () => {
  const crypto = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return { randomUUID: () => crypto.randomUUID() };
});

async function device() {
  const db = openTestDatabase();
  await migrateDatabase(db);
  return db;
}

async function setup() {
  const db = await device();
  const adminId = await addUser(db, { nome: 'Ramona', email: 'ramona@casa.org', perfil: 'admin' });
  return { db, adminId, remote: new FakeRemote() };
}

describe('offline first', () => {
  it('sem internet, tudo é salvo no aparelho e fica na fila', async () => {
    const { db, adminId, remote } = await setup();
    remote.online = false;

    const id = await createStudent(db, student(), adminId);
    await updateStudent(db, id, student({ serie: '4º ano' }), adminId);

    // O app continua funcionando com os dados locais...
    expect((await getStudent(db, id))?.serie).toBe('4º ano');
    // ...e o envio falha de forma temporária, sem perder nada.
    await expect(pushQueue(db, remote)).rejects.toBeInstanceOf(RemoteError);
    expect((await countPending(db)).pendentes).toBe(6);
    expect(remote.rows('alunos')).toHaveLength(0);
  });

  it('quando a conexão volta, envia a fila na ordem em que as alterações aconteceram', async () => {
    const { db, adminId, remote } = await setup();
    remote.online = false;
    const id = await createStudent(db, student({ nome: 'Ana' }), adminId);
    await updateStudent(db, id, student({ nome: 'Ana Clara' }), adminId);

    remote.online = true;
    const result = await pushQueue(db, remote);

    expect(result.enviados).toBe(5); // só o nome mudou: não gera registro de histórico
    expect(remote.calls).toEqual([
      'salvar alunos x1',
      'inserir historico x1',
      'inserir auditoria x1',
      'salvar alunos x1',
      'inserir auditoria x1',
    ]);
    expect(remote.rows('alunos')[0].nome).toBe('Ana Clara');
    expect(await listQueue(db)).toHaveLength(0);
  });

  it('itens seguidos da mesma tabela vão num único lote', async () => {
    const { db, adminId, remote } = await setup();
    remote.online = false;
    for (const nome of ['Ana', 'Bia', 'Caio']) await createStudent(db, student({ nome }), adminId);
    // Muda a ordem só para agrupar: remove os históricos/auditorias da fila.
    await db.runAsync("DELETE FROM fila_sincronizacao WHERE tabela <> 'alunos'");

    remote.online = true;
    await pushQueue(db, remote);
    expect(remote.calls).toEqual(['salvar alunos x3']);
  });

  it('conexão oscilando: para no meio, mantém o resto e continua de onde parou', async () => {
    const { db, adminId, remote } = await setup();
    remote.online = false;
    const id = await createStudent(db, student(), adminId);
    await updateStudent(db, id, student({ serie: '5º ano' }), adminId);

    remote.online = true;
    remote.failAfter = 2; // cai depois de 2 envios
    await expect(pushQueue(db, remote)).rejects.toThrow('Network request failed');
    expect((await countPending(db)).pendentes).toBe(4);
    const [proximo] = await listQueue(db);
    expect(proximo.tentativas).toBe(1);

    remote.online = true;
    remote.failAfter = null;
    await pushQueue(db, remote);
    expect(await listQueue(db)).toHaveLength(0);
    expect(remote.rows('alunos')[0].serie).toBe('5º ano');
    expect(remote.rows('historico')).toHaveLength(2);
  });

  it('reenviar o mesmo item não duplica nada no servidor (idempotente)', async () => {
    const { db, adminId, remote } = await setup();
    await createStudent(db, student(), adminId);
    const copia = await listQueue(db);
    await pushQueue(db, remote);

    // Simula a resposta do servidor perdida: o app reenvia os mesmos itens.
    for (const item of copia) {
      await db.runAsync(
        'INSERT INTO fila_sincronizacao (tabela, operacao, chave, dados, criado_em) VALUES (?, ?, ?, ?, ?)',
        item.tabela,
        item.operacao,
        item.chave,
        item.dados,
        item.criado_em,
      );
    }
    await pushQueue(db, remote);
    expect(remote.rows('alunos')).toHaveLength(1);
    expect(remote.rows('historico')).toHaveLength(1);
    expect(remote.rows('auditoria')).toHaveLength(1);
  });

  it('recusa definitiva do servidor marca o item com erro e não trava o resto da fila', async () => {
    const { db, adminId, remote } = await setup();
    remote.online = false;
    await createStudent(db, student({ nome: 'Recusado' }), adminId);
    await createStudent(db, student({ nome: 'Aceito' }), adminId);

    remote.online = true;
    remote.reject = (table, row) => table === 'alunos' && row.nome === 'Recusado';
    const result = await pushQueue(db, remote);

    expect(result.recusados).toBeGreaterThanOrEqual(1);
    expect(remote.rows('alunos').map((r) => r.nome)).toEqual(['Aceito']);
    const erros = (await listQueue(db)).filter((item) => item.status === 'erro');
    expect(erros[0].ultimo_erro).toMatch(/row-level security/);
  });
});

describe('recebimento de mudanças do servidor', () => {
  it('um aparelho vê o que outro criou, editou e excluiu', async () => {
    const remote = new FakeRemote();
    const a = await device();
    const b = await device();
    const adminId = await addUser(a, { nome: 'Ramona', email: 'ramona@casa.org', perfil: 'admin' });
    remote.serverWrite('usuarios', (await a.getFirstAsync<Record<string, unknown>>('SELECT * FROM usuarios'))!);

    // Aparelho A cadastra offline e sincroniza depois.
    remote.online = false;
    const id = await createStudent(a, student({ nome: 'Davi' }), adminId);
    remote.online = true;
    await syncNow(a, remote);

    // Aparelho B recebe.
    await syncNow(b, remote);
    expect((await listStudents(b)).map((s) => s.nome)).toEqual(['Davi']);

    // B edita; A recebe a edição.
    await updateStudent(b, id, student({ nome: 'Davi Souza' }), adminId);
    await syncNow(b, remote);
    await syncNow(a, remote);
    expect((await getStudent(a, id))?.nome).toBe('Davi Souza');

    // A exclui; B recebe a exclusão (e o histórico some junto).
    await deleteStudent(a, id, adminId);
    await syncNow(a, remote);
    await syncNow(b, remote);
    expect(await getStudent(b, id)).toBeNull();
  });

  it('CPF repetido entre aparelhos: o servidor recusa e o recebimento não trava', async () => {
    const remote = new FakeRemote();
    const celular = await device();
    const computador = await device();
    const adminId = await addUser(celular, { nome: 'Ramona', email: 'ramona@casa.org', perfil: 'admin' });
    const usuario = (await celular.getFirstAsync<Record<string, unknown>>('SELECT * FROM usuarios'))!;
    remote.serverWrite('usuarios', usuario);
    await syncNow(computador, remote);

    // Celular offline cadastra; computador cadastra o mesmo CPF e envia primeiro.
    remote.online = false;
    await createStudent(celular, student({ nome: 'Do celular', cpf: '529.982.247-25' }), adminId);
    remote.online = true;
    await createStudent(computador, student({ nome: 'Do computador', cpf: '529.982.247-25' }), adminId);
    await syncNow(computador, remote);
    remote.reject = (table, row) =>
      table === 'alunos' && remote.rows('alunos').some((r) => r.cpf === row.cpf && r.id !== row.id);

    // O celular volta: o aluno dele é recusado, mas a sincronização termina sem erro.
    const result = await syncNow(celular, remote);
    expect(result.recusados).toBeGreaterThan(0);
    expect((await listStudents(celular)).map((s) => s.nome)).toEqual(['Do celular']);

    // Ao descartar o item recusado e baixar de novo, fica a versão do servidor.
    await discardFailed(celular);
    await resetLocalData(celular, { keepQueue: true });
    await syncNow(celular, remote);
    expect((await listStudents(celular)).map((s) => s.nome)).toEqual(['Do computador']);
  });

  it('não sobrescreve um registro com alteração local ainda não enviada', async () => {
    const { db, adminId, remote } = await setup();
    const id = await createStudent(db, student({ nome: 'Versão do servidor' }), adminId);
    await syncNow(db, remote);

    // Offline, o usuário edita; enquanto isso, o servidor recebe outra versão.
    remote.online = false;
    await updateStudent(db, id, student({ nome: 'Versão local' }), adminId);
    remote.online = true;
    remote.serverWrite('alunos', { ...remote.rows('alunos')[0], nome: 'Versão de outro aparelho' });

    await pullChanges(db, remote);
    expect((await getStudent(db, id))?.nome).toBe('Versão local');

    // Ao sincronizar, a alteração local é enviada (a última escrita vence).
    await syncNow(db, remote);
    expect(remote.rows('alunos')[0].nome).toBe('Versão local');
    expect((await getStudent(db, id))?.nome).toBe('Versão local');
  });
});
