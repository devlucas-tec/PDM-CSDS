import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'casa-sao-domingos-savio.db';

/**
 * Cada posição é uma migração. A migração N leva o banco da versão N para a
 * N + 1. Nunca altere uma migração já publicada: crie outra no fim da lista.
 */
export const MIGRATIONS: ((db: SQLiteDatabase) => Promise<void>)[] = [
  // v1: usuários, sessão, alunos, histórico e auditoria.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        senha_hash TEXT NOT NULL,
        senha_salt TEXT NOT NULL,
        perfil TEXT NOT NULL DEFAULT 'usuario' CHECK (perfil IN ('admin', 'usuario')),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessao (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS preferencias (
        chave TEXT PRIMARY KEY NOT NULL,
        valor TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS alunos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        nome_social TEXT,
        cpf TEXT,
        rg TEXT,
        nacionalidade TEXT,
        pais_origem TEXT,
        sexo TEXT CHECK (sexo IN ('M', 'F')),
        cor_raca TEXT,
        data_nascimento TEXT NOT NULL,
        municipio_nascimento TEXT,
        uf_nascimento TEXT,

        bolsa_familia INTEGER NOT NULL DEFAULT 0 CHECK (bolsa_familia IN (0, 1)),
        possui_deficiencia INTEGER NOT NULL DEFAULT 0 CHECK (possui_deficiencia IN (0, 1)),
        descricao_deficiencia TEXT,

        nome_mae TEXT NOT NULL,
        escolaridade_mae TEXT,
        profissao_mae TEXT,
        nome_pai TEXT,
        escolaridade_pai TEXT,
        profissao_pai TEXT,
        responsavel TEXT,
        parentesco_responsavel TEXT,
        total_pessoas_casa INTEGER,
        tipo_moradia TEXT,

        rua TEXT,
        bairro TEXT NOT NULL,
        cidade TEXT NOT NULL,
        uf TEXT,
        cep TEXT,
        telefone TEXT,

        escola_origem TEXT,
        cidade_escola TEXT,
        serie TEXT,
        ano_conclusao INTEGER,

        transporte_escolar INTEGER NOT NULL DEFAULT 0 CHECK (transporte_escolar IN (0, 1)),
        pessoas_autorizadas TEXT,
        irmaos_gemeos TEXT,

        convenio_medico TEXT,
        hipertensao INTEGER NOT NULL DEFAULT 0 CHECK (hipertensao IN (0, 1)),
        diabetes INTEGER NOT NULL DEFAULT 0 CHECK (diabetes IN (0, 1)),
        asma INTEGER NOT NULL DEFAULT 0 CHECK (asma IN (0, 1)),
        tratamento_medico TEXT,
        restricao_medicamentos TEXT,
        medicamentos_controlados TEXT,
        restricao_alimentar TEXT,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        updated_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_cpf ON alunos(cpf) WHERE cpf IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome);
      CREATE INDEX IF NOT EXISTS idx_alunos_bairro ON alunos(bairro);
      CREATE INDEX IF NOT EXISTS idx_alunos_serie ON alunos(serie);

      CREATE TABLE IF NOT EXISTS historico (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        tipo TEXT NOT NULL,
        descricao TEXT NOT NULL,
        data_evento TEXT NOT NULL,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_historico_aluno ON historico(aluno_id, data_evento DESC);

      -- O histórico é imutável: uma vez registrado, não pode ser alterado.
      CREATE TRIGGER IF NOT EXISTS historico_sem_update
      BEFORE UPDATE ON historico
      BEGIN
        SELECT RAISE(ABORT, 'Registros de histórico não podem ser alterados');
      END;

      CREATE TABLE IF NOT EXISTS auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        acao TEXT NOT NULL,
        entidade TEXT NOT NULL,
        entidade_id INTEGER,
        descricao TEXT,
        created_at TEXT NOT NULL
      );
    `);
  },

  // v2: perfis de coordenador e professor, oficinas, calendário, presença e relatórios.
  async (db) => {
    // O SQLite não altera um CHECK existente: a tabela de usuários é recriada
    // (procedimento recomendado pela documentação do SQLite, com as chaves
    // estrangeiras desligadas fora da transação). O antigo perfil "usuario"
    // passa a ser "coordenador".
    await db.execAsync(`
      CREATE TABLE usuarios_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        senha_hash TEXT NOT NULL,
        senha_salt TEXT NOT NULL,
        perfil TEXT NOT NULL CHECK (perfil IN ('admin', 'coordenador', 'professor')),
        telefone TEXT,
        created_at TEXT NOT NULL
      );
      INSERT INTO usuarios_v2 (id, nome, email, senha_hash, senha_salt, perfil, created_at)
        SELECT id, nome, email, senha_hash, senha_salt,
               CASE perfil WHEN 'admin' THEN 'admin' ELSE 'coordenador' END, created_at
        FROM usuarios;
      DROP TABLE usuarios;
      ALTER TABLE usuarios_v2 RENAME TO usuarios;

      CREATE TABLE IF NOT EXISTS oficinas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
        descricao TEXT,
        local TEXT,
        created_at TEXT NOT NULL
      );

      -- Um professor pode estar em várias oficinas, e uma oficina pode ter vários professores.
      CREATE TABLE IF NOT EXISTS oficina_professores (
        oficina_id INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
        professor_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        PRIMARY KEY (oficina_id, professor_id)
      );

      -- Matrícula dos alunos nas oficinas (quem aparece na lista de chamada).
      CREATE TABLE IF NOT EXISTS oficina_alunos (
        oficina_id INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        PRIMARY KEY (oficina_id, aluno_id)
      );
      CREATE INDEX IF NOT EXISTS idx_oficina_alunos_aluno ON oficina_alunos(aluno_id);

      -- Calendário: cada linha é uma aula de uma oficina em um dia.
      CREATE TABLE IF NOT EXISTS aulas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        oficina_id INTEGER NOT NULL REFERENCES oficinas(id) ON DELETE CASCADE,
        data TEXT NOT NULL,
        hora_inicio TEXT NOT NULL,
        hora_fim TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'remarcada', 'cancelada')),
        data_original TEXT,
        justificativa TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        CHECK (hora_fim > hora_inicio),
        CHECK (status = 'agendada' OR justificativa IS NOT NULL)
      );
      CREATE INDEX IF NOT EXISTS idx_aulas_data ON aulas(data);
      CREATE INDEX IF NOT EXISTS idx_aulas_oficina ON aulas(oficina_id, data);

      CREATE TABLE IF NOT EXISTS presencas (
        aula_id INTEGER NOT NULL REFERENCES aulas(id) ON DELETE CASCADE,
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        presente INTEGER NOT NULL CHECK (presente IN (0, 1)),
        registrado_por INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (aula_id, aluno_id)
      );
      CREATE INDEX IF NOT EXISTS idx_presencas_aluno ON presencas(aluno_id);

      CREATE TABLE IF NOT EXISTS relatorios_comportamento (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        aluno_id INTEGER NOT NULL REFERENCES alunos(id) ON DELETE CASCADE,
        aula_id INTEGER REFERENCES aulas(id) ON DELETE SET NULL,
        professor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
        texto TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'lido', 'contato_realizado')),
        observacao_coordenacao TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_relatorios_aluno ON relatorios_comportamento(aluno_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_relatorios_status ON relatorios_comportamento(status);

      -- O texto do professor não pode ser alterado depois de enviado; a
      -- coordenação só muda o andamento (status) e a própria observação.
      CREATE TRIGGER IF NOT EXISTS relatorio_texto_imutavel
      BEFORE UPDATE OF aluno_id, aula_id, professor_id, texto, created_at ON relatorios_comportamento
      BEGIN
        SELECT RAISE(ABORT, 'O relatório do professor não pode ser alterado');
      END;
    `);
  },
];

export const LATEST_VERSION = MIGRATIONS.length;

/**
 * Executa as migrações pendentes usando `PRAGMA user_version` para saber em
 * qual versão do esquema o banco do dispositivo está. Cada migração roda em
 * uma transação: se falhar, o banco continua na versão anterior.
 */
export async function migrateDatabase(db: SQLiteDatabase, targetVersion = LATEST_VERSION) {
  await db.execAsync('PRAGMA journal_mode = WAL');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < targetVersion) {
    // Chaves estrangeiras desligadas durante as migrações (não dá para mudar
    // esse PRAGMA dentro de uma transação).
    await db.execAsync('PRAGMA foreign_keys = OFF');
    try {
      while (version < targetVersion) {
        const migrate = MIGRATIONS[version];
        const next = version + 1;
        await db.withTransactionAsync(async () => {
          await migrate(db);
          const broken = await db.getAllAsync('PRAGMA foreign_key_check');
          if (broken.length > 0) throw new Error(`Migração ${next} deixou referências inválidas.`);
          await db.execAsync(`PRAGMA user_version = ${next}`);
        });
        version = next;
      }
    } finally {
      await db.execAsync('PRAGMA foreign_keys = ON');
    }
  }

  await db.execAsync('PRAGMA foreign_keys = ON');
}
