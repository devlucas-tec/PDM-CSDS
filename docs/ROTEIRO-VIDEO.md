# Roteiro do vídeo de demonstração (P2)

**Duração sugerida:** 8 a 10 minutos.
**Material:** dois aparelhos (celular com Expo Go + emulador Android, ou dois celulares) e o painel do Supabase aberto no computador (**Table Editor**).
**Antes de gravar:** `cp .env.example .env.local`, `npx expo start`, banco do Supabase vazio (ou já com o admin criado).

O foco do P2 é mostrar o **backend** e, principalmente, o **offline first**: o app continua funcionando sem internet e envia a fila em ordem quando a conexão volta.

---

## 1. Abertura (30 s)

- Mostre o app e diga em uma frase o que mudou: "No P1 os dados ficavam só no aparelho. No P2 o app ganhou um backend na nuvem (Supabase) e funciona offline first".

## 2. Arquitetura do backend (2 a 3 min)

Texto para falar no vídeo. As indicações entre colchetes dizem o que mostrar na tela enquanto você fala.

> **[Na tela: diagrama de arquitetura do README]**
>
> "Antes de mostrar o app funcionando, vou explicar como ficou a arquitetura nesta segunda versão.
>
> No Projeto 1, todos os dados ficavam só no celular, num banco SQLite. Funcionava bem, mas tinha dois problemas: se o aparelho quebrasse, a Casa perdia todas as fichas, e a coordenação e os professores não conseguiam compartilhar informações entre os celulares.
>
> Para resolver isso, criamos um backend na nuvem com o Supabase. O Supabase entrega três coisas que usamos: um banco Postgres, um serviço de login e as Edge Functions, que são funções que rodam no servidor."
>
> **[Na tela: pasta `supabase/migrations` no VS Code e o Table Editor do Supabase]**
>
> "No Postgres, criamos as mesmas tabelas que já existiam no celular: alunos, oficinas, aulas, presenças, relatórios, histórico e auditoria. O esquema do banco fica versionado aqui no repositório, na pasta de migrações, então qualquer pessoa consegue recriar o banco do zero.
>
> Uma mudança importante foi nos identificadores. Antes, cada registro recebia um número sequencial: 1, 2, 3. Isso não funciona com vários aparelhos offline, porque dois celulares poderiam criar o 'aluno 10' ao mesmo tempo. Agora cada registro recebe um UUID, um código único gerado no próprio celular. Assim, um registro criado sem internet já nasce com o mesmo identificador que vai ter no servidor."
>
> **[Na tela: Authentication → Users no Supabase]**
>
> "O login agora é feito pelo Supabase Auth. A senha não fica mais guardada no celular. E só o administrador pode cadastrar novos usuários. Para isso, usamos uma Edge Function chamada `gerenciar-usuarios`. Criar uma conta exige uma chave de administrador do Supabase, e essa chave não pode ficar dentro do aplicativo, porque qualquer pessoa conseguiria extraí-la. Por isso essa parte roda no servidor: o app chama a função, a função confere se quem pediu é administrador e só então cria a conta."
>
> **[Na tela: tabela do README "Segurança no servidor" ou as policies em Authentication → Policies]**
>
> "As regras de cada perfil também passaram a valer no servidor, com um recurso do Postgres chamado Row Level Security, ou segurança por linha. No P1, quem escondia as telas era o próprio app. Agora o banco também confere. Por exemplo: o professor só consegue ler os alunos das oficinas em que ele dá aula, e o histórico do aluno só aceita inserção, nunca alteração. Mesmo que alguém tente acessar a API direto, sem passar pelo app, o banco recusa."
>
> **[Na tela: diagrama do README, destacando a fila de sincronização]**
>
> "Agora, a parte principal deste projeto: o funcionamento offline first. A ideia é que o app nunca dependa da internet para funcionar.
>
> As telas continuam lendo e gravando no SQLite do celular, exatamente como no P1, e por isso respondem na hora. A diferença é que, toda vez que algo é salvo, o app também coloca essa alteração numa fila, a tabela `fila_sincronizacao`. As duas coisas acontecem na mesma transação: ou a alteração e o pedido de envio são gravados juntos, ou nenhum dos dois. Assim, mesmo se o app fechar no meio, nada se perde."
>
> **[Na tela: arquivo `src/sync/engine.ts`]**
>
> "Em segundo plano, um sincronizador lê essa fila e envia os itens para o servidor na mesma ordem em que foram criados. Um item só sai da fila depois que o servidor confirma que recebeu.
>
> Se a internet cai no meio do envio, o sincronizador para, guarda o que falta e tenta de novo depois, esperando cada vez mais: dois segundos, quatro, oito, até dois minutos. E quando o celular detecta que a conexão voltou, ele envia na hora.
>
> Se o servidor recusar alguma alteração, por exemplo por uma regra de permissão, esse item fica marcado como erro e aparece numa tela própria, mas não trava o resto da fila.
>
> E como cada registro tem aquele identificador único, enviar a mesma alteração duas vezes não duplica nada: o servidor apenas atualiza o registro que já existe."
>
> **[Na tela: o app com o indicador no topo]**
>
> "No caminho de volta, o app também baixa o que outros aparelhos mudaram. Ele pede ao servidor só as linhas alteradas desde a última sincronização, usando o horário do servidor, e não o do celular, que pode estar errado. As exclusões feitas em outro aparelho também chegam e são aplicadas aqui.
>
> Para o usuário, tudo isso aparece neste indicador no topo das telas: sincronizado, enviando, offline ou com erro. Agora vou mostrar tudo isso funcionando."

## 3. Backend e primeiro acesso (1 min)

1. Aparelho A, com internet: tela **Primeiro acesso**. Cadastre o administrador.
2. No painel do Supabase, mostre a conta em **Authentication → Users** e a linha na tabela `usuarios`.
3. Na aba **Conta**, toque em **Gerar dados de demonstração**. Aponte o indicador no topo ("Enviando N") e o contador baixando até **Sincronizado**.
4. No Supabase, abra `alunos`, `aulas` e `presencas` e mostre que os dados chegaram.

## 4. Segundo aparelho e perfis (1 min)

1. Aparelho B: entre como professor (`judo@casa.org` / `casa1234`).
2. Mostre que ele vê só as aulas e os alunos das próprias oficinas. Explique que a regra vale no servidor (RLS), não só na tela.

## 5. Offline first: o ponto principal (2 a 3 min)

1. Aparelho B (professor): ligue o **modo avião**. O indicador muda para **Offline**.
2. Abra uma aula de hoje e faça a **lista de presença**. Escreva um **relatório de comportamento**. Tudo salva na hora e mostra a mensagem de sucesso.
3. Toque no indicador **Offline · N** para abrir a tela **Sincronização** e mostre a **fila**: os itens, na ordem em que serão enviados.
4. Feche o app por completo e abra de novo, ainda em modo avião. O professor continua logado e a fila continua lá (nada se perdeu).
5. Desligue o modo avião. Em poucos segundos o indicador passa por **Enviando N** e chega a **Sincronizado**, e a fila fica vazia.
6. No Supabase, mostre as presenças e o relatório recém-chegados.
7. Aparelho A (coordenação): abra **Relatórios**. O relatório do professor aparece sozinho (o app busca novidades a cada 30 s e ao voltar para o app).

## 6. Conexão oscilando e conflito (1 min)

1. Aparelho A: coloque em modo avião, edite a ficha de um aluno (mude a série) e exclua outro aluno.
2. Ligue e desligue o modo avião rapidamente uma ou duas vezes. Mostre que a fila não perde a ordem e só esvazia quando a conexão se firma.
3. Aparelho B ou painel do Supabase: mostre a série alterada e o aluno excluído.

## 7. Recusa do servidor (30 s, opcional)

- Explique, mostrando a tela Sincronização, que, se o servidor recusar uma alteração (por exemplo, uma regra de acesso), o item fica marcado como **erro**, não trava o resto e pode ser reenviado ou descartado.

## 8. Encerramento (30 s)

- Recapitule: dados na nuvem e compartilhados, regras de acesso no servidor, tudo funciona sem internet, a fila é enviada em ordem quando a conexão volta, e há 43 testes automatizados (`npm test`), incluindo queda de conexão no meio do envio.
