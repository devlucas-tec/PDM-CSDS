# Roteiro do vídeo de demonstração (P2)

**Duração sugerida:** 6 a 8 minutos.
**Material:** dois aparelhos (celular com Expo Go + emulador Android, ou dois celulares) e o painel do Supabase aberto no computador (**Table Editor**).
**Antes de gravar:** `cp .env.example .env.local`, `npx expo start`, banco do Supabase vazio (ou já com o admin criado).

O foco do P2 é mostrar o **backend** e, principalmente, o **offline first**: o app continua funcionando sem internet e envia a fila em ordem quando a conexão volta.

---

## 1. Abertura (30 s)

- Mostre o app e diga em uma frase o que mudou: "No P1 os dados ficavam só no aparelho. No P2 o app ganhou um backend na nuvem (Supabase) e funciona offline first".
- Mostre rapidamente o diagrama de arquitetura do README.

## 2. Backend e primeiro acesso (1 min)

1. Aparelho A, com internet: tela **Primeiro acesso**. Cadastre o administrador.
2. No painel do Supabase, mostre a conta em **Authentication → Users** e a linha na tabela `usuarios`.
3. Na aba **Conta**, toque em **Gerar dados de demonstração**. Aponte o indicador no topo ("Enviando N") e o contador baixando até **Sincronizado**.
4. No Supabase, abra `alunos`, `aulas` e `presencas` e mostre que os dados chegaram.

## 3. Segundo aparelho e perfis (1 min)

1. Aparelho B: entre como professor (`judo@casa.org` / `casa1234`).
2. Mostre que ele vê só as aulas e os alunos das próprias oficinas. Explique que a regra vale no servidor (RLS), não só na tela.

## 4. Offline first: o ponto principal (2 a 3 min)

1. Aparelho B (professor): ligue o **modo avião**. O indicador muda para **Offline**.
2. Abra uma aula de hoje e faça a **lista de presença**. Escreva um **relatório de comportamento**. Tudo salva na hora e mostra a mensagem de sucesso.
3. Toque no indicador **Offline · N** para abrir a tela **Sincronização** e mostre a **fila**: os itens, na ordem em que serão enviados.
4. Feche o app por completo e abra de novo, ainda em modo avião. O professor continua logado e a fila continua lá (nada se perdeu).
5. Desligue o modo avião. Em poucos segundos o indicador passa por **Enviando N** e chega a **Sincronizado**, e a fila fica vazia.
6. No Supabase, mostre as presenças e o relatório recém-chegados.
7. Aparelho A (coordenação): abra **Relatórios**. O relatório do professor aparece sozinho (o app busca novidades a cada 30 s e ao voltar para o app).

## 5. Conexão oscilando e conflito (1 min)

1. Aparelho A: coloque em modo avião, edite a ficha de um aluno (mude a série) e exclua outro aluno.
2. Ligue e desligue o modo avião rapidamente uma ou duas vezes. Mostre que a fila não perde a ordem e só esvazia quando a conexão se firma.
3. Aparelho B ou painel do Supabase: mostre a série alterada e o aluno excluído.

## 6. Recusa do servidor (30 s, opcional)

- Explique, mostrando a tela Sincronização, que, se o servidor recusar uma alteração (por exemplo, uma regra de acesso), o item fica marcado como **erro**, não trava o resto e pode ser reenviado ou descartado.

## 7. Encerramento (30 s)

- Recapitule: dados na nuvem e compartilhados, regras de acesso no servidor, tudo funciona sem internet, a fila é enviada em ordem quando a conexão volta, e há 43 testes automatizados (`npm test`), incluindo queda de conexão no meio do envio.
