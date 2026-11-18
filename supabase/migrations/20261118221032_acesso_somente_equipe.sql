-- O cadastro público do Supabase Auth pode estar ligado no painel. Para que uma
-- conta criada por fora (sem perfil cadastrado pelo administrador) não veja
-- nada, as tabelas que eram legíveis por qualquer usuário autenticado passam a
-- exigir um perfil da equipe.

create function public.eh_equipe() returns boolean
language sql stable security definer set search_path = public as $$
  select public.perfil_atual() is not null;
$$;

drop policy usuarios_select on public.usuarios;
create policy usuarios_select on public.usuarios for select to authenticated using (public.eh_equipe());

drop policy oficinas_select on public.oficinas;
create policy oficinas_select on public.oficinas for select to authenticated using (public.eh_equipe());

drop policy oficina_professores_select on public.oficina_professores;
create policy oficina_professores_select on public.oficina_professores for select to authenticated using (public.eh_equipe());

drop policy exclusoes_select on public.exclusoes;
create policy exclusoes_select on public.exclusoes for select to authenticated using (public.eh_equipe());

drop policy auditoria_insert on public.auditoria;
create policy auditoria_insert on public.auditoria for insert to authenticated
  with check (public.eh_equipe() and (usuario_id = auth.uid() or public.eh_gestor()));
