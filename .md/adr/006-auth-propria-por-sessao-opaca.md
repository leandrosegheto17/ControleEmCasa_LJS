# ADR-006: Auth própria por sessão opaca

- **Status:** Aceito em 2026-10-24 (etapa 4)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RN-19, RN-20 e RN-21 do `PRD-TECNICO.md`; SDD 5.1, 5.2, 8.1 e 8.2; GUARDRAILS G-15 a G-21, G-46 e G-48; THREAT-MODEL TM-NAV-01, TM-NAV-05, TM-API-07, TM-API-08, TM-API-11, TM-API-16 e TM-OBS-02

## Contexto

- O legado (MyMoney) usava o Supabase Auth. Aqui não há Supabase: a API é um Worker com Postgres próprio (ADR-001, ADR-005), e o cadastro é aberto (PRD).
- O casal usa o app no celular, às vezes em aparelho compartilhado; a decisão P5 fixou 15 min de inatividade e 12 h absolutas.
- O Worker tem orçamento de CPU curto (R1). bcrypt no Worker gastaria esse orçamento; no Postgres, com `pgcrypto`, não.
- Cadastro aberto atrai enumeração de e-mail, força bruta, credential stuffing e e-mail bombing.

## Decisão

1. **Sessão opaca no servidor**, sem JWT:
   - token de 32 bytes de `crypto.getRandomValues`, em base64url (43 caracteres); o banco guarda só o SHA-256 (`sessao.token_hash`, 32 bytes);
   - cookie `__Host-sid=<token>; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=43200`, sem `Domain`. Cookie repetido ou fora do formato é tratado como ausente;
   - validade conferida numa única instrução (`WITH … UPDATE … SELECT`): `ultimo_uso_em > agora − 15 min` **e** `expira_absoluta_em > agora` (`= criada_em + 12 h`, garantido por `CHECK`). O `ultimo_uso_em` só é regravado depois de 60 s;
   - **rotação no login**: cada login cria uma sessão nova e apaga a sessão do cookie que o navegador apresentou (fixação, TM-API-11);
   - sair revoga a sessão do aparelho; sair de todos e redefinir a senha apagam todas as sessões do usuário. Os dois "sair" são idempotentes (204);
   - cookie ausente, malformado, desconhecido, revogado ou vencido produzem a mesma resposta (`401 sessao_expirada`), e o cookie é limpo.
2. **Senha com bcrypt no Postgres** (`app.crypt(senha, app.gen_salt('bf', 12))`), sempre como parâmetro do template `sql` do Kysely; a comparação é `crypt(senha, hash) = hash` no SQL. Política: de 12 caracteres a 72 bytes UTF-8 (`senhaAtendePolitica`, no contrato, compartilhada com o front).
3. **Tokens de e-mail** (confirmação e recuperação): 256 bits, só o SHA-256 em `token_email`, 30 min (`CHECK`), uso único por `UPDATE … WHERE usado_em IS NULL … RETURNING` (dois POSTs simultâneos: só um vence). O link leva o token no fragmento (`#t=`) e o consumo é só por `POST`. Pedir outro invalida o aberto; há no máximo um envio a cada 2 min por usuário e finalidade.
4. **Anti-enumeração por resposta e tempo:**
   - cadastro, reenvio e "esqueci" respondem `202` sem corpo para qualquer e-mail;
   - o cadastro faz `INSERT … ON CONFLICT (email) DO NOTHING` com o `crypt()` no `VALUES`: o bcrypt roda nos dois casos e dois cadastros simultâneos geram um único usuário. Quem já tem conta recebe o e-mail "Você já tem conta";
   - entrar com e-mail inexistente compara a senha com `HASH_FIXO` (custo 12), e a resposta é `400 credenciais_invalidas` nos dois casos. `email_nao_confirmado` só aparece com a senha certa;
   - todo e-mail sai por `ctx.waitUntil`, fora do tempo de resposta.
5. **Bloqueio por tentativas** (`tentativa_login`, fonte de verdade): 5 falhas em 15 min (janela deslizante) pelo e-mail **ou** pelo IP → `429 muitas_tentativas`, sem conferir a senha. E-mail e IP só existem como HMAC-SHA-256 com `CHAVE_HMAC`. O IP vem só de `CF-Connecting-IP`. A falha é **reservada antes do bcrypt**, numa transação curta com travas consultivas (e-mail, depois IP), para que tentativas paralelas não furem o limite; a senha certa descarta a reserva, e o sucesso zera a contagem do e-mail.
6. **Limite de taxa** por cima do bloqueio: `LIMITE_ENTRAR` em `/api/sessao/entrar` e `LIMITE_PUBLICO` em cadastro, confirmar, reenviar, esqueci e redefinir, chaveados pelo IP, antes do CSRF e do banco → `429 muitas_requisicoes`. Sem binding (local), não limita; em https, a ausência é registrada.
7. **E-mail via Resend por `fetch`**, num módulo isolado (`infraestrutura/email`) que só importa da própria pasta (ESLint e teste). O transporte nunca lança e nunca registra o destinatário. Em `teste`, os e-mails nunca saem; em `local` sem chave, o assunto e os links aparecem no terminal do `wrangler dev`; em `producao`, `RESEND_API_KEY` é obrigatória (a config falha fechada).
8. **Log sem dado pessoal**: o logger único limpa e-mails e sequências com cara de token em todo campo de texto (o id de correlação UUID fica), e os fluxos registram só nomes de eventos e erros. Testado com espião em todos os fluxos.
9. **Segredos no local** ficam em `.dev.vars` (ignorado pelo git). Os testes da API desligam a leitura do `.env` pelo wrangler (`CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`) e usam uma `CHAVE_HMAC` aleatória por execução.

## Consequências

**Positivas**
- Revogar é imediato: apagar a linha da sessão corta o acesso na requisição seguinte, inclusive em "sair de todos".
- Vazar o banco não entrega sessões nem links válidos (só hashes) nem e-mails das tentativas.
- O bcrypt não pesa na CPU do Worker.
- A mesma peça (sessão, tokens, e-mail) serve aos outros dois apps quando for extraída (decisão 4 do PLANO).

**Negativas**
- Cada requisição autenticada faz uma consulta à sessão (e no máximo uma escrita por minuto).
- Com a regravação a cada 60 s, a inatividade pode encerrar a sessão até 60 s antes dos 15 min contados da última requisição real.
- O bcrypt de custo 12 no Neon consome compute a cada login e cadastro; o bloqueio e os limites contêm o abuso.
- Um casal atrás do mesmo IP (NAT) pode se bloquear com 5 falhas somadas (aceito pela RN-21).
- O aviso "Você já tem conta" não tem intervalo mínimo próprio; o `LIMITE_PUBLICO` é a única barreira contra repetição nesse caminho.
- `conta_em_exclusao` (RN-26) e a derivação de `membro`, `lar` e `plano` na sessão ficam para as etapas 14, 6 e 13.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| JWT sem estado | Não revoga na hora ("sair de todos", troca de senha); 15 min de inatividade exigiria estado de qualquer jeito |
| Supabase Auth, Clerk ou outro provedor | Dependência e custo por usuário; sai do Padrão LJS (ADR-001) e duplica a identidade fora do Postgres |
| bcrypt ou Argon2 no Worker | Estoura o orçamento de CPU (R1) |
| Token de link na query string | Vai para log, histórico e `Referer`; antivírus consome o link com `GET` |
| Bloqueio só pelo binding de rate limit | O binding é por localidade e aproximado; não conta por e-mail nem sobrevive como prova. A tabela é a fonte de verdade |
| Responder "e-mail já cadastrado" no cadastro | Enumeração direta (TM-API-07) |
