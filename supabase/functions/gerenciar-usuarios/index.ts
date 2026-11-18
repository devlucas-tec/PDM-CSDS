// Edge Function: cria contas da equipe.
//
// Criar uma conta no Supabase Auth exige a chave de administrador
// (service_role), que nunca pode ir dentro do aplicativo. Por isso o app chama
// esta função, que roda no servidor e confere as regras:
//   * se ainda não existe nenhum usuário, cria o primeiro administrador
//     ("primeiro acesso", sem login);
//   * caso contrário, só um administrador logado pode criar contas.
//
// Publicada com verify_jwt = false porque o primeiro acesso acontece sem
// login; a função valida o token do chamador por conta própria.

import { createClient } from 'npm:@supabase/supabase-js@2';

const PERFIS = ['admin', 'coordenador', 'professor'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function reply(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply(405, { erro: 'Método não permitido.' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return reply(400, { erro: 'Corpo da requisição inválido.' });
  }

  const nome = String(body.nome ?? '').trim();
  const email = String(body.email ?? '').trim().toLowerCase();
  const senha = String(body.senha ?? '');
  const telefone = body.telefone ? String(body.telefone).trim() : null;
  let perfil = String(body.perfil ?? '');

  if (nome.length < 3) return reply(400, { erro: 'Informe o nome completo.', campo: 'nome' });
  if (!EMAIL.test(email)) return reply(400, { erro: 'Email inválido.', campo: 'email' });
  if (senha.length < 8) return reply(400, { erro: 'A senha deve ter pelo menos 8 caracteres.', campo: 'senha' });

  // Primeiro acesso: banco sem nenhum usuário.
  const { count, error: countError } = await admin.from('usuarios').select('id', { count: 'exact', head: true });
  if (countError) return reply(500, { erro: 'Não foi possível consultar os usuários.' });

  let criadoPor: string | null = null;
  if (count === 0) {
    perfil = 'admin';
  } else {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const { data: caller } = await admin.auth.getUser(token);
    if (!caller?.user) return reply(401, { erro: 'Faça login novamente.' });
    const { data: perfilChamador } = await admin.from('usuarios').select('perfil').eq('id', caller.user.id).maybeSingle();
    if (perfilChamador?.perfil !== 'admin') return reply(403, { erro: 'Apenas administradores cadastram usuários.' });
    criadoPor = caller.user.id;
  }
  if (!PERFIS.includes(perfil)) return reply(400, { erro: 'Perfil inválido.', campo: 'perfil' });

  const { data: created, error: authError } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: { nome },
  });
  if (authError || !created.user) {
    const duplicado = /already|registered|exists/i.test(authError?.message ?? '');
    return reply(duplicado ? 409 : 400, {
      erro: duplicado ? 'Já existe um usuário com este email.' : (authError?.message ?? 'Erro ao criar a conta.'),
      campo: duplicado ? 'email' : undefined,
    });
  }

  const { data: usuario, error: insertError } = await admin
    .from('usuarios')
    .insert({ id: created.user.id, nome, email, perfil, telefone })
    .select()
    .single();
  if (insertError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return reply(500, { erro: 'Não foi possível salvar o perfil do usuário.' });
  }

  await admin.from('auditoria').insert({
    usuario_id: criadoPor ?? usuario.id,
    acao: 'criar',
    entidade: 'usuario',
    entidade_id: usuario.id,
    descricao: `Usuário ${email} (${perfil})`,
  });

  return reply(201, { usuario });
});
