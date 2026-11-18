-- Ajustes sugeridos pelo Security Advisor do Supabase.

-- search_path fixo nas funções de trigger.
alter function public.definir_updated_at() set search_path = public;
alter function public.bloquear_alteracao_historico() set search_path = public;
alter function public.proteger_relatorio() set search_path = public;

-- Extensão fora do schema exposto pela API.
alter extension citext set schema extensions;

-- Funções auxiliares das regras de acesso: ninguém sem login executa.
-- (Usuários logados precisam de EXECUTE, porque as policies as chamam; elas só
-- respondem sobre o próprio usuário.) A função de trigger não é chamável.
revoke execute on function public.perfil_atual() from public, anon;
revoke execute on function public.eh_gestor() from public, anon;
revoke execute on function public.eh_equipe() from public, anon;
revoke execute on function public.leciona_oficina(uuid) from public, anon;
revoke execute on function public.leciona_aula(uuid) from public, anon;
revoke execute on function public.aluno_do_professor(uuid) from public, anon;
revoke execute on function public.registrar_exclusao() from public, anon, authenticated;
grant execute on function public.perfil_atual() to authenticated;
grant execute on function public.eh_gestor() to authenticated;
grant execute on function public.eh_equipe() to authenticated;
grant execute on function public.leciona_oficina(uuid) to authenticated;
grant execute on function public.leciona_aula(uuid) to authenticated;
grant execute on function public.aluno_do_professor(uuid) to authenticated;
