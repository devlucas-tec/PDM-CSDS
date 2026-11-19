# Casa São Domingos Sávio: Gestão de Alunos

<p align="center">
  <img src="assets/images/logo-csds.png" alt="Logomarca da Casa São Domingos Sávio" width="260" />
</p>

Aplicativo mobile para gerenciar os alunos atendidos pela **Casa São Domingos Sávio**, instituição sem fins lucrativos de Campina Grande (PB) que acolhe cerca de 60 crianças entre 7 e 15 anos. Hoje as fichas dos alunos ficam em papel e espalhadas em arquivos digitais. O app junta tudo em um só lugar, guarda a linha do tempo de cada aluno e mostra indicadores sociais para a gestão e para a prestação de contas.

Projetos 1 e 2 da disciplina **Programação para Dispositivos Móveis (2026.2)**, CST em Análise e Desenvolvimento de Sistemas, IFPB Campus Esperança.

- **P1:** app completo com persistência local (SQLite).
- **P2:** **backend na nuvem (Supabase)** e funcionamento **offline first**. Toda alteração é gravada primeiro no aparelho e entra numa **fila de requisições**, enviada ao servidor em ordem quando há conexão. A equipe inteira passa a compartilhar os mesmos dados, em vários aparelhos. Veja [Projeto 2: backend e offline first](#projeto-2-backend-e-offline-first).

## Vídeo de demonstração (P2)

▶️ **[Assista no YouTube](https://youtu.be/a5yAvp3g-Kg)**: backend no Supabase, regras de acesso por perfil e o funcionamento offline first (modo avião, conexão oscilando, fila de sincronização e recusa do servidor).

## Tema

A entidade principal é o **aluno**. A ficha cadastral tem mais de 40 campos, organizados em:

- dados pessoais;
- informações sociais;
- dados da família;
- endereço;
- dados escolares;
- informações adicionais;
- histórico médico.

Cada aluno tem um **histórico** (linha do tempo) que não pode ser alterado. O app também calcula um **índice de vulnerabilidade social** para cada aluno.

## Funcionalidades

| Requisito | Onde está no app |
|---|---|
| **RF01: CRUD completo** | Cadastrar, listar, ver a ficha, editar e excluir alunos. |
| **RF02: Persistência local** | Banco SQLite (`expo-sqlite`). Alunos, usuários, sessão de login e tema continuam salvos depois de fechar o app. No P2, os mesmos dados também são sincronizados com o servidor (Supabase). |
| **RF03: Listagem inteligente** | Busca por nome. Filtros por série, bairro e Bolsa Família. Ordenação por nome, data de cadastro ou idade. |
| **RF04: Validação** | Campos obrigatórios, data real e não futura, CPF com dígito verificador, CEP, telefone, email, senha de 8 caracteres ou mais, email e CPF únicos. |
| **RF05: Navegação** | Expo Router com telas de login, listagem, formulário, ficha (detalhe), histórico, dashboard e conta. |
| **RF06: Feedback** | Confirmação antes de excluir. Mensagens de sucesso e erro. Erros mostrados em cada campo. Indicadores de carregamento. No P2, indicador de sincronização em todas as abas (sincronizado, enviando, offline ou com erro). |

Também foram implementados:

- **Login e perfis:** o primeiro acesso cria o administrador. Só administradores cadastram novos usuários. As contas ficam no **Supabase Auth** (P2), e a sessão continua ativa ao reabrir o app, mesmo sem internet. Cada perfil vê uma parte do app, e as mesmas regras valem no servidor (Row Level Security):

  | Perfil | O que acessa |
  |---|---|
  | **Administrador** | Tudo, inclusive o cadastro de usuários. |
  | **Coordenador** | Alunos, oficinas, calendário (edição total), relatórios de comportamento e dashboard. |
  | **Professor** | Só a agenda das próprias oficinas, a lista de presença e os relatórios de comportamento. |

- **Oficinas:** cada oficina tem local, um ou mais professores vinculados e os alunos matriculados.
- **Calendário anual:** a coordenação monta as aulas de cada oficina (dias da semana, horário e período) ou cria aulas avulsas. Também remarca ou cancela aulas com **justificativa obrigatória**, por exemplo quando o professor avisa que não poderá comparecer. A data original fica registrada. O professor só visualiza os dias das suas oficinas, já com as mudanças e as justificativas.
- **Lista de presença:** no dia da aula (ou depois), o professor marca quem veio e quem faltou. Não é possível fazer chamada de aula futura ou cancelada.
- **Relatórios de comportamento:** na chamada, o professor pode escrever um relato sobre um aluno, que não pode ser alterado depois. A coordenação lê o relato, liga ou manda WhatsApp para os responsáveis direto do app e registra o contato. Esse contato entra no histórico da criança.
- **Histórico de cada criança:** a ficha mostra as oficinas em que ela está matriculada, a frequência por oficina (com alerta abaixo de 75%), as últimas chamadas, os relatórios de comportamento e a linha do tempo.
- **Histórico do aluno:** linha do tempo do registro mais recente para o mais antigo, com o usuário responsável por cada registro. Mudanças de série e de escola entram no histórico automaticamente.
- **Dashboard de análise social**, com:
  - filtros por ano, série e bairro;
  - indicadores principais;
  - gráficos de idade, gênero, raça/cor, escolaridade dos pais, profissões, tamanho das famílias, bairros, escolas e saúde;
  - índice de vulnerabilidade;
  - tabela com busca, ordenação e paginação.
- **Auditoria:** quem criou, editou ou excluiu cada registro, e quando.

### Itens opcionais (pontuação extra)

- [x] Tema claro/escuro: automático ou escolhido pelo usuário, salvo no banco.
- [x] Gráficos e estatísticas: dashboard de análise social.
- [x] Exportação de dados: relatório em PDF compartilhável (`expo-print` + `expo-sharing`).
- [ ] Notificações locais.

## Projeto 2: backend e offline first

### Arquitetura

```mermaid
flowchart LR
  subgraph Aparelho
    T[Telas] --> R[Repositórios]
    R -->|1. grava| DB[(SQLite local)]
    R -->|2. mesma transação| F[(fila_sincronizacao)]
    S[Sincronizador] -->|lê em ordem| F
    S -->|aplica mudanças| DB
  end
  S -->|envio: upsert / delete| API[Supabase<br/>PostgREST + Auth]
  API -->|recebimento: updated_at > cursor<br/>e exclusões| S
  API --> PG[(Postgres<br/>RLS por perfil)]
  APP[Cadastro de usuário] --> EF[Edge Function<br/>gerenciar-usuarios]
  EF --> PG
```

- **As telas leem sempre do SQLite.** O app abre e funciona igual com ou sem internet.
- **Escrita:** cada repositório grava no SQLite e, **na mesma transação**, coloca o registro na tabela `fila_sincronizacao` (padrão *outbox*). Se o app fechar no meio, ou as duas coisas ficam gravadas, ou nenhuma.
- **Envio da fila** (`src/sync/engine.ts`): os itens vão **em ordem de criação**. Itens seguidos da mesma tabela vão num único pedido (lote), e cada item só sai da fila depois que o servidor confirma.
  - **Sem conexão ou servidor fora do ar:** o envio para e tenta de novo com espera crescente (2 s, 4 s, 8 s… até 2 min). Também tenta assim que a internet volta (`expo-network`) e quando o app volta para a frente.
  - **Recusa do servidor** (regra de acesso, CPF repetido): o item fica marcado com erro, aparece na tela **Sincronização** e não trava o resto da fila.
  - **Reenvio seguro:** os IDs são UUIDs gerados no aparelho, e o envio é um *upsert* (histórico e auditoria usam "insert ou ignora"). Reenviar algo que o servidor já recebeu não duplica nada.
- **Recebimento:** para cada tabela, o app baixa as linhas com `updated_at` maior que o último recebido. O `updated_at` vem sempre do relógio do servidor, nunca do celular. As **exclusões** feitas em outros aparelhos chegam pela tabela `exclusoes`, preenchida por trigger, inclusive as em cascata.
- **Conflitos:** um registro com alteração local ainda na fila não é sobrescrito pelo que vem do servidor. Quando a fila é enviada, **vence a última escrita sincronizada**. Se uma linha do servidor esbarra numa alteração local recusada (por exemplo, o mesmo CPF cadastrado offline em dois aparelhos), ela fica de fora até o usuário descartar o item com erro; aí o app baixa tudo de novo.
- **O que exige internet:** só o login no aparelho pela primeira vez e o cadastro de novos usuários, porque a conta precisa existir no servidor. Todo o resto funciona offline.

### Segurança no servidor

As regras de perfil também valem no banco, por **Row Level Security** (`supabase/migrations/`). Assim, mesmo com a chave pública do app, ninguém lê ou altera o que o seu perfil não permite:

| Tabela | Admin/Coordenação | Professor |
|---|---|---|
| alunos | tudo | lê só os alunos das próprias oficinas |
| historico | lê e cria (nunca altera) | sem acesso |
| oficinas, aulas, matrículas | tudo | lê as próprias |
| presencas | tudo | faz a chamada das próprias aulas |
| relatorios_comportamento | lê e acompanha | escreve sobre alunos das próprias aulas (texto imutável) |
| usuarios | lê; cria pela Edge Function (só admin) | lê |

Uma conta criada fora do app, sem perfil cadastrado pelo administrador, não vê nada.

## Tecnologias

- **React Native 0.88** com **Expo SDK 58**
- **Expo Router** para navegação por arquivos e rotas protegidas por login (`Stack.Protected`)
- **expo-sqlite** para persistência local (dados, fila de sincronização e sessão)
- **Supabase** (P2): Postgres com Row Level Security, Auth e Edge Function, acessados pelo `@supabase/supabase-js`
- **expo-network** para detectar quando a conexão cai e volta
- **expo-crypto** para gerar os UUIDs no aparelho
- **expo-print** e **expo-sharing** para o relatório em PDF
- **react-native-svg** para o gráfico de rosca
- **expo-symbols** para os ícones (SF Symbols no iOS, Material Symbols no Android)
- **TypeScript**, **ESLint** e **Jest** (`jest-expo`)

## Como executar

Pré-requisitos: [Node.js](https://nodejs.org) 20 ou mais recente e o app **Expo Go** no celular Android (ou um emulador Android).

```bash
# 1. Instalar as dependências
npm install

# 2. Configurar o backend (URL e chave pública do Supabase)
cp .env.example .env.local

# 3. Iniciar o servidor de desenvolvimento
npx expo start
```

O `.env.example` já aponta para o projeto Supabase da equipe. Para usar outro projeto, aplique os arquivos de `supabase/migrations/` (em ordem) no SQL Editor do Supabase, publique a função `supabase/functions/gerenciar-usuarios` e troque a URL e a chave no `.env.local`.

Depois disso:

- **Celular Android:** abra o Expo Go e escaneie o QR Code que aparece no terminal.
- **Emulador Android:** com o emulador aberto, pressione `a` no terminal.

No primeiro acesso (com internet), o app pede o cadastro do **administrador**. Para a demonstração, use o botão **"Gerar dados de demonstração"** na aba **Conta**. Ele cria um ano letivo fictício:

- 40 alunos;
- a equipe (1 coordenadora e 5 professores);
- as 9 oficinas da Casa, com matrículas;
- o calendário de fevereiro a dezembro, com aulas remarcadas e canceladas;
- as chamadas das aulas que já aconteceram;
- relatórios de comportamento em vários estágios.

Contas de demonstração (todas com a senha `casa1234`):

| Perfil | Email |
|---|---|
| Coordenadora | `coordenacao@casa.org` |
| Professor (Judô e Educação Física) | `judo@casa.org` |
| Professora (Artes) | `artes@casa.org` |
| Professor (Música e Informática) | `musica@casa.org` |
| Professora (Balé e Dança) | `danca@casa.org` |
| Professora (Reforço escolar e Evangelização) | `reforco@casa.org` |

### Outros comandos

```bash
npm test             # testes automatizados (regras de negócio, SQLite e sincronização offline)
npx expo lint        # lint
npx tsc --noEmit     # verificação de tipos
```

## Estrutura do projeto

```
src/
├── app/                  # Telas (Expo Router)
│   ├── _layout.tsx       # Provedores (SQLite, auth, tema, toast) e rotas protegidas
│   ├── login.tsx
│   ├── primeiro-acesso.tsx
│   ├── (tabs)/           # Abas: Agenda, Alunos, Relatórios, Análise social, Conta
│   ├── alunos/           # novo, [id] (ficha), [id]/editar, [id]/historico
│   ├── aulas/            # [id] (aula), [id]/chamada, [id]/relatorio, [id]/editar
│   ├── calendario/       # planejar (calendário anual)
│   ├── oficinas/         # lista, nova, [id]
│   ├── relatorios/       # [id] (relatório de comportamento)
│   ├── sincronizacao.tsx # Estado da conexão e fila de envio (P2)
│   └── usuarios/novo.tsx
├── components/           # Componentes de interface (formulários, gráficos, ui/)
├── context/              # Sessão (Supabase Auth), sincronização, tema e mensagens (toast)
├── database/             # Camada de dados: esquema/migrações e repositórios SQLite
├── lib/                  # Regras puras: validação, formatação, estatísticas, vulnerabilidade
├── services/             # Relatório PDF e cadastro de usuários (Edge Function)
├── sync/                 # Offline first: fila (outbox), motor de sincronização, cliente do backend
└── constants/            # Paleta de cores e listas de opções
supabase/
├── migrations/           # Esquema Postgres, triggers e regras de acesso (RLS)
└── functions/            # Edge Function gerenciar-usuarios (cria contas da equipe)
```

As telas não escrevem SQL. Elas chamam os **repositórios** em `src/database/`, e as regras de negócio (validação, cálculos) ficam em `src/lib/` como funções puras, cobertas por testes.

## Capturas de tela

Prints tirados do app rodando no Expo Go, com os dados de demonstração.

### Acesso

| Primeiro acesso | Login | Novo usuário (admin) |
|:---:|:---:|:---:|
| <img src="docs/prints/primeiroacesso.png" width="220" alt="Cadastro do primeiro administrador" /> | <img src="docs/prints/tela-login.png" width="220" alt="Tela de login" /> | <img src="docs/prints/novo-usuario.png" width="220" alt="Cadastro de usuário com escolha de perfil" /> |

### Coordenação

| Agenda | Planejar calendário | Oficinas |
|:---:|:---:|:---:|
| <img src="docs/prints/agenda.png" width="220" alt="Agenda com o calendário mensal" /> | <img src="docs/prints/planejar-calendario.png" width="220" alt="Planejamento do calendário anual" /> | <img src="docs/prints/oficinas.png" width="220" alt="Lista de oficinas" /> |

| Alunos (busca e filtros) | Relatórios de comportamento | Contato realizado |
|:---:|:---:|:---:|
| <img src="docs/prints/alunos.png" width="220" alt="Lista de alunos com filtros" /> | <img src="docs/prints/relatorio-alunos.png" width="220" alt="Relatórios enviados pelos professores" /> | <img src="docs/prints/filtro2-relatorio-alunos.png" width="220" alt="Relatórios com contato registrado" /> |

### Professor (tema claro)

| Minhas aulas | Lista de presença | Relatório de comportamento |
|:---:|:---:|:---:|
| <img src="docs/prints/aulas-professor.png" width="220" alt="Agenda do professor" /> | <img src="docs/prints/lista-presen%C3%A7a.png" width="220" alt="Lista de presença" /> | <img src="docs/prints/relat%C3%B3rio-comportamento.png" width="220" alt="Relatório de comportamento" /> |

### Análise social

| Indicadores | Gráficos |
|:---:|:---:|
| <img src="docs/prints/analise-social.png" width="220" alt="Indicadores do dashboard" /> | <img src="docs/prints/analise-social2.png" width="220" alt="Gráficos do perfil dos alunos" /> |

### Conta e administração

| Usuários do sistema (admin) | Dados de demonstração | Tema claro |
|:---:|:---:|:---:|
| <img src="docs/prints/usuarios-sistema.png" width="220" alt="Lista de usuários do sistema com seus perfis" /> | <img src="docs/prints/seed.png" width="220" alt="Geração dos dados de demonstração e contas criadas" /> | <img src="docs/prints/tema-claro.png" width="220" alt="Escolha de aparência na tela de conta" /> |

### Projeto 2: sincronização e perfis

| Coordenação vê todas as aulas | Professor vê só as dele | Fila no modo avião |
|:---:|:---:|:---:|
| <img src="docs/prints/p2-agenda-coordenacao.png" width="220" alt="Agenda da coordenação com as aulas de todas as oficinas" /> | <img src="docs/prints/p2-agenda-professor.png" width="220" alt="Agenda do professor só com as aulas das próprias oficinas" /> | <img src="docs/prints/p2-fila-offline.png" width="220" alt="Tela de sincronização sem conexão, com a fila de alterações em ordem" /> |

| Fila enviada | Servidor recusou (CPF repetido) | Item com o motivo do erro |
|:---:|:---:|:---:|
| <img src="docs/prints/p2-fila-vazia.png" width="220" alt="Fila vazia depois que a conexão voltou" /> | <img src="docs/prints/p2-indicador-erro.png" width="220" alt="Indicador vermelho de itens com erro" /> | <img src="docs/prints/p2-item-com-erro.png" width="220" alt="Item recusado pelo servidor com o motivo e as opções de reenviar ou descartar" /> |

### Vídeos

- [Demonstração do P2 no YouTube](https://youtu.be/a5yAvp3g-Kg): backend e offline first.

- [Primeiro acesso](docs/prints/primeiro-acesso.mp4): cadastro do primeiro administrador.
- [Dados de demonstração](docs/prints/seed-admin.mp4): o admin gera o ano letivo fictício.

Exemplo do relatório exportado: [docs/prints/relatorio.pdf](docs/prints/relatorio.pdf).

## Documentação

- [docs/DOCUMENTACAO.md](docs/DOCUMENTACAO.md): tema, modelo de dados, persistência e, no P2, backend e sincronização.

## Integrantes

- Lucas Barbosa Graciano
- Valdênio Pantaleão
- Pedro Pereira

## Créditos

A logomarca pertence à Casa São Domingos Sávio. Os dados de exemplo são fictícios.
