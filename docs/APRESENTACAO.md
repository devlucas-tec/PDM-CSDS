# Apresentação em aula (P2)

Roteiro de slides (cerca de 10 minutos). Cada `---` é um slide.

---

## Casa São Domingos Sávio: Gestão de Alunos (P2)

- Programação para Dispositivos Móveis, 2026.2, IFPB Campus Esperança
- Lucas Barbosa Graciano · Valdênio Pantaleão · Pedro Pereira

---

## Onde paramos no P1

- App completo em React Native + Expo SDK 58
- Ficha do aluno (40+ campos), oficinas, calendário, chamada, relatórios de comportamento, dashboard e PDF
- **Limite:** os dados ficavam em um único aparelho, sem cópia de segurança e sem compartilhar com a equipe

---

## O que o P2 pede

1. **Backend:** persistência na nuvem
2. **Offline first:** toda alteração vai primeiro para a persistência local e gera uma **fila de requisições**, executada **em ordem** quando houver conexão

---

## Backend: Supabase

- **Postgres** com as mesmas tabelas do aparelho, com migrações versionadas no repositório
- **Supabase Auth** para login (a senha não fica mais no aparelho)
- **Edge Function** `gerenciar-usuarios`: cria contas da equipe sem expor a chave de administrador
- **Row Level Security:** as regras de perfil valem no servidor (o professor só vê as próprias oficinas)

---

## Arquitetura offline first

```
Tela → Repositório → SQLite ─┐ (mesma transação)
                             └→ fila_sincronizacao
Sincronizador: fila → Supabase (em ordem)
               Supabase → SQLite (updated_at > cursor, exclusões)
```

- A tela **sempre** lê e grava no SQLite e responde na hora
- O envio acontece em segundo plano

---

## A fila de requisições

- Padrão **transactional outbox**: alteração e pedido de envio nunca se separam
- Envio **em ordem de criação**; itens seguidos da mesma tabela vão em **lote**
- Cada item só sai da fila depois da confirmação do servidor
- **IDs UUID gerados no aparelho** e envio por **upsert**, então reenviar não duplica nada

---

## Quando a rede falha

| Situação | Comportamento |
|---|---|
| Sem internet | Tudo funciona; a fila cresce |
| Conexão volta | Envio imediato (`expo-network`) |
| Cai no meio do envio | Para sem perder a ordem; tenta de novo com backoff (2 s até 2 min) |
| Servidor recusa | Item marcado como erro, visível na tela; não trava a fila |

---

## Recebendo dados de outros aparelhos

- Baixa por tabela o que mudou desde o último `updated_at` (relógio do servidor)
- As exclusões chegam pela tabela `exclusoes`, preenchida por trigger
- **Conflito:** registro com alteração local pendente não é sobrescrito; depois do envio, vence a última escrita

---

## Interface

- Indicador no topo de todas as abas: **Sincronizado / Enviando N / Offline · N / Erro**
- Tela **Sincronização**: estado da conexão, fila em ordem, tentar de novo, descartar
- Ao sair com pendências, o app avisa antes

---

## Qualidade

- **43 testes automatizados**, entre eles: fila na ordem, conexão caindo no meio do envio, reenvio sem duplicar, recusa sem travar e dois aparelhos sincronizando
- Também validado de ponta a ponta contra o Supabase real (RLS do professor, Edge Function)
- Lint e TypeScript sem erros

---

## Demonstração

1. Gerar dados e ver a fila subir
2. Professor em **modo avião**: chamada e relatório
3. Fechar e reabrir o app offline
4. Voltar a conexão e ver a fila esvaziar em ordem
5. Coordenação recebe o relatório

---

## Obrigado!

Perguntas?
