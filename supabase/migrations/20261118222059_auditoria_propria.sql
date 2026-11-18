-- O envio da fila usa "insert ... on conflict do nothing" (reenvio seguro). No
-- Postgres, o "on conflict" exige também permissão de leitura da linha; o
-- professor não lia a auditoria, então os registros das próprias ações (chamada,
-- relatório) eram recusados. Cada pessoa passa a ler as próprias entradas.
drop policy auditoria_select on public.auditoria;
create policy auditoria_select on public.auditoria for select to authenticated
  using (public.eh_gestor() or usuario_id = auth.uid());
