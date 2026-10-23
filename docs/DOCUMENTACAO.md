# Documentação: App de Gestão de Alunos da Casa São Domingos Sávio

**Disciplina:** Programação para Dispositivos Móveis, 2026.2 (IFPB Campus Esperança). Prof. André Atanasio.
**Tecnologia:** React Native + Expo SDK 58, com persistência local em SQLite.

## 1. Tema

A Casa São Domingos Sávio é uma instituição filantrópica de Campina Grande (PB) que atende cerca de 60 crianças de 7 a 15 anos. Ela oferece oficinas, reforço escolar e refeições. Os dados dos alunos estavam em fichas de papel e em arquivos desorganizados, sem cópia de segurança. Isso dificultava consultar e atualizar as informações e também tomar decisões.

O aplicativo, baseado na minuta do projeto *Sincronize* (sem o módulo de sincronização), permite:

- cadastrar, consultar, editar e excluir a **ficha completa do aluno**;
- registrar a **linha do tempo** de cada aluno (entrada no projeto, mudanças de série e escola, acompanhamentos, ocorrências e avaliações). Esses registros não podem ser apagados nem alterados;
- consultar um **dashboard de análise social** com indicadores, gráficos e o **índice de vulnerabilidade social**, e exportar um relatório em PDF;
- controlar o acesso com **login** e **perfis**: administrador, coordenador e professor;
- organizar as **oficinas** (professores vinculados e alunos matriculados) e montar o **calendário anual** de aulas. A coordenação remarca ou cancela aulas com justificativa;
- deixar o professor ver só os dias das suas oficinas, fazer a **lista de presença** e escrever **relatórios de comportamento**. A coordenação lê esses relatórios e contata os responsáveis;
- manter, para cada criança, o histórico de **frequência**, de **comportamento** e de acontecimentos.

## 2. Modelo de dados

```
usuarios ──< oficina_professores >── oficinas ──< oficina_alunos >── alunos
    │                                   │                               │
    │                                   └──< aulas ──< presencas >──────┤
    │                                              └─< relatorios_comportamento >┤
    ├───< historico >──────────────────────────────────────────────────┘
    ├───< auditoria          sessao (1 linha)          preferencias (tema)
```

| Tabela | Principais campos | Regras |
|---|---|---|
| **alunos** (entidade principal) | Dados pessoais: `nome`, `nome_social`, `cpf`, `rg`, `sexo` (M/F), `cor_raca`, `data_nascimento`, naturalidade. Sociais: `bolsa_familia`, `possui_deficiencia`, `descricao_deficiencia`. Família: `nome_mae`, escolaridade e profissão dos pais, `total_pessoas_casa`, `tipo_moradia`. Endereço: `rua`, `bairro`, `cidade`, `uf`, `cep`, `telefone`. Escola: `escola_origem`, `serie`, `ano_conclusao`. Adicionais: `transporte_escolar`, autorizados, irmãos. Saúde: `convenio_medico`, `asma`, `diabetes`, `hipertensao`, medicamentos, `restricao_alimentar`. Controle: `created_at`, `updated_at`, `created_by`, `updated_by`. | `nome`, `data_nascimento`, `nome_mae`, `bairro` e `cidade` são `NOT NULL`. Campos sim/não são `INTEGER` com `CHECK (valor IN (0,1))`. `cpf` é único (índice parcial). Há índices em nome, bairro e série. |
| **historico** | `aluno_id`, `tipo`, `descricao`, `data_evento`, `usuario_id`, `created_at` | `ON DELETE CASCADE` em relação ao aluno. Um **trigger** bloqueia `UPDATE`, o que garante a rastreabilidade. |
| **usuarios** | `nome`, `email` (único, sem diferenciar maiúsculas), `senha_hash`, `senha_salt`, `perfil` (`admin`/`coordenador`/`professor`), `telefone`, `created_at` | A senha nunca é guardada em texto puro: o app guarda SHA-256(salt + senha). |
| **oficinas** | `nome` (único), `local`, `descricao` | Vínculos N:N: `oficina_professores` (professor ↔ oficina) e `oficina_alunos` (matrícula). |
| **aulas** | `oficina_id`, `data`, `hora_inicio`, `hora_fim`, `status` (`agendada`/`remarcada`/`cancelada`), `data_original`, `justificativa` | `CHECK`: o término é depois do início, e remarcar ou cancelar **exige justificativa**. Aula com chamada não pode ser remarcada, cancelada ou excluída. |
| **presencas** | `aula_id`, `aluno_id`, `presente` (0/1), `registrado_por` | Chave primária composta (uma marcação por aluno por aula). Só o professor da oficina ou a coordenação registra, e só no dia da aula ou depois. |
| **relatorios_comportamento** | `aluno_id`, `aula_id`, `professor_id`, `texto`, `status` (`novo`/`lido`/`contato_realizado`), `observacao_coordenacao` | Um **trigger** impede alterar o texto do professor. Registrar o contato com os responsáveis também cria uma entrada no `historico` do aluno. |
| **sessao** | `usuario_id`, `token`, `created_at` | Uma única linha. Mantém o usuário logado ao reabrir o app. |
| **auditoria** | `usuario_id`, `acao`, `entidade`, `entidade_id`, `descricao`, `created_at` | Registra login, logout, criação, edição e exclusão. |
| **preferencias** | `chave`, `valor` | Guarda o tema claro/escuro. |

**Índice de vulnerabilidade social.** É calculado a partir da ficha e não fica gravado no banco, então está sempre atualizado. Cada critério atendido vale 1 ponto:

- recebe Bolsa Família;
- mora com mais de 5 pessoas na casa;
- pai ou mãe com escolaridade até "Fundamental incompleto";
- mora em ocupação ou em moradia precária;
- precisa de transporte escolar.

Com 0 ou 1 ponto, a vulnerabilidade é **baixa**. Com 2 ou 3 pontos, é **média**. Com 4 ou 5 pontos, é **alta**.

## 3. Justificativa da persistência: SQLite (`expo-sqlite`)

A escolha foi o **SQLite** e não o AsyncStorage, porque:

1. **Os dados são relacionais.** Aluno, histórico, usuário e auditoria se relacionam por chaves estrangeiras. No AsyncStorage, que é um armazenamento chave-valor de texto, seria preciso serializar listas inteiras em JSON e controlar as relações manualmente.
2. **As consultas são feitas no banco.** Busca por nome (`LIKE`), filtros por série, bairro e Bolsa Família e ordenação são executados em SQL, com índices, sem carregar e filtrar tudo na memória.
3. **Integridade garantida pelo próprio banco.** `NOT NULL`, `UNIQUE` (email e CPF), `CHECK` (valores sim/não), `FOREIGN KEY` com `CASCADE` e o trigger que impede alterar o histórico continuam valendo mesmo se houver um erro na interface.
4. **Transações.** Cadastrar um aluno grava a ficha, o primeiro registro do histórico e a auditoria em **uma única transação** (`withTransactionAsync`). Se o app for interrompido no meio, não sobra registro pela metade.
5. **Migrações versionadas.** O esquema é criado e atualizado com `PRAGMA user_version` (`src/database/schema.ts`), então versões futuras podem evoluir o banco sem perder dados.
6. **Funciona no Expo Go**, totalmente offline, como pede o projeto.

**Organização em camadas:**

- telas: `src/app`;
- componentes: `src/components`;
- regras puras: `src/lib`, com validação, estatísticas e vulnerabilidade;
- camada de dados: `src/database`, com esquema e repositórios.

As telas nunca escrevem SQL; elas chamam funções como `createStudent`, `listStudents` e `addHistory`.

**Testes.** O comando `npm test` roda 37 testes automatizados. Os testes dos repositórios executam o SQL de verdade, usando o SQLite do Node, e verificam:

- CRUD;
- filtros;
- CPF e email duplicados;
- as constraints;
- o bloqueio de alteração do histórico e dos relatórios;
- a **migração v1 → v2** de um banco com dados;
- o calendário: geração de datas, remarcação com justificativa e o professor vendo só as próprias aulas;
- as permissões da chamada: outro professor não registra, e aula futura ou cancelada não aceita chamada;
- o fluxo relatório → leitura → contato → histórico;
- o seed de demonstração;
- a persistência: dados e sessão continuam no arquivo depois de **fechar e reabrir o banco**.

## 4. Capturas de tela

> Inserir os prints do app (pasta `docs/prints/`): login, listagem com filtros, formulário de cadastro com validação, ficha do aluno com histórico, dashboard e tema escuro.
