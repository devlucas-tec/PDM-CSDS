-- =============================================================================
-- Casa São Domingos Sávio: esquema do backend (Supabase / Postgres)
--
-- O esquema espelha o banco local (SQLite) do aplicativo. As chaves primárias
-- são UUIDs gerados no próprio aparelho, para que registros criados offline
-- nunca colidam entre aparelhos diferentes.
--
-- Sincronização:
--   * updated_at é sempre definido pelo servidor (trigger). O aplicativo baixa
--     as mudanças com "updated_at > último sincronizado".
--   * Exclusões ficam registradas em `exclusoes` (inclusive as em cascata),
--     para que os outros aparelhos apaguem o registro local.
-- =============================================================================

create extension if not exists citext;

-- -----------------------------------------------------------------------------
-- Tabelas
-- -----------------------------------------------------------------------------

-- Perfil de cada conta do Supabase Auth.
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null,
  email citext not null unique,
  perfil text not null check (perfil in ('admin', 'coordenador', 'professor')),
  telefone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  nome_social text,
  cpf text,
  rg text,
  nacionalidade text,
  pais_origem text,
  sexo text check (sexo in ('M', 'F')),
  cor_raca text,
  data_nascimento date not null,
  municipio_nascimento text,
  uf_nascimento text,

  bolsa_familia smallint not null default 0 check (bolsa_familia in (0, 1)),
  possui_deficiencia smallint not null default 0 check (possui_deficiencia in (0, 1)),
  descricao_deficiencia text,

  nome_mae text not null,
  escolaridade_mae text,
  profissao_mae text,
  nome_pai text,
  escolaridade_pai text,
  profissao_pai text,
  responsavel text,
  parentesco_responsavel text,
  total_pessoas_casa integer,
  tipo_moradia text,

  rua text,
  bairro text not null,
  cidade text not null,
  uf text,
  cep text,
  telefone text,

  escola_origem text,
  cidade_escola text,
  serie text,
  ano_conclusao integer,

  transporte_escolar smallint not null default 0 check (transporte_escolar in (0, 1)),
  pessoas_autorizadas text,
  irmaos_gemeos text,

  convenio_medico text,
  hipertensao smallint not null default 0 check (hipertensao in (0, 1)),
  diabetes smallint not null default 0 check (diabetes in (0, 1)),
  asma smallint not null default 0 check (asma in (0, 1)),
  tratamento_medico text,
  restricao_medicamentos text,
  medicamentos_controlados text,
  restricao_alimentar text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) on delete set null,
  updated_by uuid references public.usuarios (id) on delete set null
);
create unique index alunos_cpf_unico on public.alunos (cpf) where cpf is not null;
create index alunos_nome_idx on public.alunos (nome);
create index alunos_updated_idx on public.alunos (updated_at);

create table public.historico (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  tipo text not null,
  descricao text not null,
  data_evento date not null,
  usuario_id uuid references public.usuarios (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index historico_aluno_idx on public.historico (aluno_id, data_evento desc);
create index historico_updated_idx on public.historico (updated_at);

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references public.usuarios (id) on delete set null,
  acao text not null,
  entidade text not null,
  entidade_id text,
  descricao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index auditoria_updated_idx on public.auditoria (updated_at);

create table public.oficinas (
  id uuid primary key default gen_random_uuid(),
  nome citext not null unique,
  descricao text,
  local text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um professor pode estar em várias oficinas, e uma oficina pode ter vários professores.
create table public.oficina_professores (
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  professor_id uuid not null references public.usuarios (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (oficina_id, professor_id)
);
create index oficina_professores_professor_idx on public.oficina_professores (professor_id);

-- Matrícula dos alunos nas oficinas (quem aparece na lista de chamada).
create table public.oficina_alunos (
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (oficina_id, aluno_id)
);
create index oficina_alunos_aluno_idx on public.oficina_alunos (aluno_id);

-- Calendário: cada linha é uma aula de uma oficina em um dia.
create table public.aulas (
  id uuid primary key default gen_random_uuid(),
  oficina_id uuid not null references public.oficinas (id) on delete cascade,
  data date not null,
  hora_inicio text not null check (hora_inicio ~ '^\d{2}:\d{2}$'),
  hora_fim text not null check (hora_fim ~ '^\d{2}:\d{2}$'),
  status text not null default 'agendada' check (status in ('agendada', 'remarcada', 'cancelada')),
  data_original date,
  justificativa text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios (id) on delete set null,
  check (hora_fim > hora_inicio),
  check (status = 'agendada' or justificativa is not null)
);
create index aulas_oficina_idx on public.aulas (oficina_id, data);
create index aulas_updated_idx on public.aulas (updated_at);

create table public.presencas (
  aula_id uuid not null references public.aulas (id) on delete cascade,
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  presente smallint not null check (presente in (0, 1)),
  registrado_por uuid references public.usuarios (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (aula_id, aluno_id)
);
create index presencas_aluno_idx on public.presencas (aluno_id);
create index presencas_updated_idx on public.presencas (updated_at);

create table public.relatorios_comportamento (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos (id) on delete cascade,
  aula_id uuid references public.aulas (id) on delete set null,
  professor_id uuid references public.usuarios (id) on delete set null,
  texto text not null,
  status text not null default 'novo' check (status in ('novo', 'lido', 'contato_realizado')),
  observacao_coordenacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index relatorios_aluno_idx on public.relatorios_comportamento (aluno_id, created_at desc);
create index relatorios_updated_idx on public.relatorios_comportamento (updated_at);

-- Registro de exclusões ("tombstones") para os aparelhos apagarem a cópia local.
create table public.exclusoes (
  id bigint generated always as identity primary key,
  tabela text not null,
  chave jsonb not null,
  excluido_em timestamptz not null default clock_timestamp()
);
create index exclusoes_excluido_em_idx on public.exclusoes (excluido_em);

-- -----------------------------------------------------------------------------
-- Triggers de sincronização
-- -----------------------------------------------------------------------------

-- O horário de alteração vem sempre do relógio do servidor (o do celular pode
-- estar errado). clock_timestamp() muda dentro da transação, now() não.
create function public.definir_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

-- Guarda a chave primária do registro excluído. Os argumentos do trigger são
-- os nomes das colunas da chave.
create function public.registrar_exclusao() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  linha jsonb := to_jsonb(old);
  chave jsonb := '{}'::jsonb;
  coluna text;
begin
  foreach coluna in array tg_argv loop
    chave := chave || jsonb_build_object(coluna, linha -> coluna);
  end loop;
  insert into public.exclusoes (tabela, chave) values (tg_table_name, chave);
  return old;
end;
$$;

do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('usuarios', array['id']),
      ('alunos', array['id']),
      ('historico', array['id']),
      ('auditoria', array['id']),
      ('oficinas', array['id']),
      ('oficina_professores', array['oficina_id', 'professor_id']),
      ('oficina_alunos', array['oficina_id', 'aluno_id']),
      ('aulas', array['id']),
      ('presencas', array['aula_id', 'aluno_id']),
      ('relatorios_comportamento', array['id'])
    ) as v (tabela, chave)
  loop
    execute format(
      'create trigger %I before insert or update on public.%I for each row execute function public.definir_updated_at()',
      t.tabela || '_updated_at', t.tabela);
    execute format(
      'create trigger %I after delete on public.%I for each row execute function public.registrar_exclusao(%s)',
      t.tabela || '_exclusao', t.tabela,
      (select string_agg(quote_literal(c), ', ') from unnest(t.chave) c));
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Regras de negócio que valem também no servidor
-- -----------------------------------------------------------------------------

-- O histórico é imutável: uma vez registrado, não pode ser alterado.
create function public.bloquear_alteracao_historico() returns trigger
language plpgsql as $$
begin
  raise exception 'Registros de histórico não podem ser alterados' using errcode = 'P0001';
end;
$$;
create trigger historico_sem_update before update on public.historico
  for each row execute function public.bloquear_alteracao_historico();

-- O texto do professor não muda depois de enviado; a coordenação só altera o
-- andamento (status) e a própria observação. aula_id pode virar null quando a
-- aula é excluída (on delete set null).
create function public.proteger_relatorio() returns trigger
language plpgsql as $$
begin
  if new.texto is distinct from old.texto
     or new.aluno_id is distinct from old.aluno_id
     or new.professor_id is distinct from old.professor_id
     or new.created_at is distinct from old.created_at
     or (new.aula_id is distinct from old.aula_id and new.aula_id is not null) then
    raise exception 'O relatório do professor não pode ser alterado' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger relatorio_texto_imutavel before update on public.relatorios_comportamento
  for each row execute function public.proteger_relatorio();

-- -----------------------------------------------------------------------------
-- Funções auxiliares das regras de acesso
-- (security definer: consultam as tabelas sem passar pelo próprio RLS)
-- -----------------------------------------------------------------------------

create function public.perfil_atual() returns text
language sql stable security definer set search_path = public as $$
  select perfil from public.usuarios where id = auth.uid();
$$;

create function public.eh_gestor() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.perfil_atual() in ('admin', 'coordenador'), false);
$$;

create function public.leciona_oficina(p_oficina uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.oficina_professores
    where oficina_id = p_oficina and professor_id = auth.uid()
  );
$$;

create function public.leciona_aula(p_aula uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.aulas a
    join public.oficina_professores op on op.oficina_id = a.oficina_id
    where a.id = p_aula and op.professor_id = auth.uid()
  );
$$;

-- O professor vê só os alunos das próprias oficinas (matriculados ou com
-- presença registrada em uma aula dele).
create function public.aluno_do_professor(p_aluno uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.oficina_alunos oa
    join public.oficina_professores op on op.oficina_id = oa.oficina_id
    where oa.aluno_id = p_aluno and op.professor_id = auth.uid()
  ) or exists (
    select 1 from public.presencas p
    join public.aulas a on a.id = p.aula_id
    join public.oficina_professores op on op.oficina_id = a.oficina_id
    where p.aluno_id = p_aluno and op.professor_id = auth.uid()
  );
$$;

-- Usada na tela inicial (sem login) para decidir entre "Entrar" e "Primeiro acesso".
create function public.possui_usuarios() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.usuarios);
$$;

revoke all on function public.possui_usuarios() from public;
grant execute on function public.possui_usuarios() to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Permissões e Row Level Security
-- -----------------------------------------------------------------------------

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Contas são criadas e alteradas apenas pela Edge Function (service_role).
revoke insert, update, delete on public.usuarios from authenticated;
revoke insert, update, delete on public.exclusoes from authenticated;

alter table public.usuarios enable row level security;
alter table public.alunos enable row level security;
alter table public.historico enable row level security;
alter table public.auditoria enable row level security;
alter table public.oficinas enable row level security;
alter table public.oficina_professores enable row level security;
alter table public.oficina_alunos enable row level security;
alter table public.aulas enable row level security;
alter table public.presencas enable row level security;
alter table public.relatorios_comportamento enable row level security;
alter table public.exclusoes enable row level security;

-- usuarios: toda a equipe vê os nomes (aparecem em históricos e oficinas).
create policy usuarios_select on public.usuarios for select to authenticated using (true);

-- alunos: gestão completa pela coordenação; professor só lê os seus.
create policy alunos_gestor on public.alunos for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
create policy alunos_professor_select on public.alunos for select to authenticated
  using (public.aluno_do_professor(id));

-- historico: só a coordenação (e não há policy de update: é imutável).
create policy historico_select on public.historico for select to authenticated using (public.eh_gestor());
create policy historico_insert on public.historico for insert to authenticated with check (public.eh_gestor());
create policy historico_delete on public.historico for delete to authenticated using (public.eh_gestor());

-- auditoria: cada um registra as próprias ações; a coordenação lê tudo.
create policy auditoria_insert on public.auditoria for insert to authenticated
  with check (usuario_id = auth.uid() or public.eh_gestor());
create policy auditoria_select on public.auditoria for select to authenticated using (public.eh_gestor());

-- oficinas e professores vinculados: todos leem, a coordenação altera.
create policy oficinas_select on public.oficinas for select to authenticated using (true);
create policy oficinas_gestor on public.oficinas for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
create policy oficina_professores_select on public.oficina_professores for select to authenticated using (true);
create policy oficina_professores_gestor on public.oficina_professores for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());

-- matrículas: coordenação altera; professor vê as das próprias oficinas.
create policy oficina_alunos_select on public.oficina_alunos for select to authenticated
  using (public.eh_gestor() or public.leciona_oficina(oficina_id));
create policy oficina_alunos_gestor on public.oficina_alunos for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());

-- aulas: coordenação monta o calendário; professor vê as das próprias oficinas.
create policy aulas_select on public.aulas for select to authenticated
  using (public.eh_gestor() or public.leciona_oficina(oficina_id));
create policy aulas_gestor on public.aulas for all to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());

-- presenças: o professor faz a chamada das próprias aulas.
create policy presencas_select on public.presencas for select to authenticated
  using (public.eh_gestor() or public.leciona_aula(aula_id));
create policy presencas_insert on public.presencas for insert to authenticated
  with check (public.eh_gestor() or (public.leciona_aula(aula_id) and registrado_por = auth.uid()));
create policy presencas_update on public.presencas for update to authenticated
  using (public.eh_gestor() or public.leciona_aula(aula_id))
  with check (public.eh_gestor() or (public.leciona_aula(aula_id) and registrado_por = auth.uid()));
create policy presencas_delete on public.presencas for delete to authenticated using (public.eh_gestor());

-- relatórios: o professor escreve sobre alunos das próprias aulas; a coordenação acompanha.
create policy relatorios_select on public.relatorios_comportamento for select to authenticated
  using (public.eh_gestor() or professor_id = auth.uid() or (aula_id is not null and public.leciona_aula(aula_id)));
create policy relatorios_insert on public.relatorios_comportamento for insert to authenticated
  with check (
    public.eh_gestor()
    or (professor_id = auth.uid() and aula_id is not null and public.leciona_aula(aula_id) and status = 'novo')
  );
create policy relatorios_update on public.relatorios_comportamento for update to authenticated
  using (public.eh_gestor()) with check (public.eh_gestor());
create policy relatorios_delete on public.relatorios_comportamento for delete to authenticated using (public.eh_gestor());

-- exclusoes: só leitura (contém apenas chaves primárias).
create policy exclusoes_select on public.exclusoes for select to authenticated using (true);
