# ADR-009: Convite de membro

- **Status:** Proposto em 2026-10-24 (etapa 6; aguarda a aprovação da etapa)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RN-11, RN-17, RN-22 e RN-23 do `PRD-TECNICO.md`; SDD §3.4, §5.3, §6.2, §8.4 e §12.2; GUARDRAILS G-03, G-05, G-14 e G-19; THREAT-MODEL TM-API-06, TM-API-07, TM-API-16, TM-RES-02 e TM-RES-03; ADR-004 e ADR-005
- **Substitui (no legado):** nada. O MyMoney não tinha convite: os 2 membros eram criados à mão (ADR-008/014 do legado)

## Contexto

- Com cadastro aberto, cada usuário cria o próprio lar no primeiro acesso e vira o titular. O segundo membro só entra por convite (ADR-004).
- Quem recebe o link de convite entra no lar e passa a ver todo o conjunto. O link pode ser encaminhado, ficar no histórico do e-mail ou ser aberto por um antivírus (D-5 do THREAT-MODEL).
- O limite é de 2 membros por lar e de 1 lar ativo por usuário, e precisa valer sob concorrência (CA-11.1, CA-23.6).
- O convidado pode já ter um lar próprio, quase sempre recém-criado e vazio (CA-23.9 a CA-23.11).
- A RLS precisa distinguir titular e membro para renomear o lar, convidar e remover, sem `SECURITY DEFINER` e sem política recursiva (decisão 1 do PLANO).

## Decisão

1. **Vínculo derivado no banco, com papel.** Ao abrir a transação, a API grava `app.usuario_id` e `app.email` e, numa única instrução, lê a linha ativa de `membro` do usuário e grava `app.lar_id`, `app.membro_id` e **`app.papel`** (`titular` ou `membro`), todos com `set_config(…, true)`. A função `app.papel_atual()` segue o padrão do ADR-005 (SQL `STABLE`, `SECURITY INVOKER`, nula se ausente). A sessão não carrega lar: o campo `Sessao.larId` deixou de existir. Quando o vínculo muda dentro da transação (criar o lar, aceitar o convite), a mesma instrução é repetida.
2. **Token.** 256 bits de CSPRNG, só o SHA-256 em `convite.token_hash`, link `URL_PUBLICA/convite#t=<token>` (o token fica no fragmento; D-07), validade de 7 dias (check `expira_em = criado_em + 7 dias`). O token nunca aparece em resposta JSON nem em log.
3. **Amarrado ao e-mail da sessão.** Ver, aceitar e recusar exigem sessão (`A0`) e buscam o convite por `token_hash` **e** `email = app.email_atual()`, pendente e dentro da validade. Token errado, de outro e-mail, expirado, usado, recusado ou revogado dão a mesma resposta `404 convite_invalido`, sem revelar o e-mail convidado. O titular, que enxerga o convite do próprio lar pela RLS, também não usa o link.
4. **Uso único sob concorrência.** O aceite trava o vínculo do usuário (`pg_advisory_xact_lock`) e a linha do convite (`FOR UPDATE`). O segundo de dois aceites simultâneos do mesmo link encontra o convite já `aceito` e recebe `convite_invalido`.
5. **Limite de 2 no banco.** Os índices únicos parciais `membro_um_titular`, `membro_um_convidado` e `membro_um_lar_ativo` (SDD D-01) seguram qualquer corrida; o 23505 vira `lar_cheio` ou `ja_tem_lar`. Como há no máximo 1 convite pendente por lar (`convite_um_pendente`), "dois aceites simultâneos num lar com 1 vaga" só acontece com o mesmo link; o índice é provado no teste de banco com duas transações concorrentes.
6. **Convidar (só o titular).** Ordem das recusas: não titular → `404 registro_invalido` (CA-23.2, antes de validar o corpo); próprio e-mail → `400 valor_invalido` (CA-23.7); lar com 2 membros → `409 lar_cheio`; mais de 5 convites do lar em 24 h → `429 muitas_tentativas`; o mesmo endereço há menos de 2 min → `409 convite_pendente`. Um convite novo revoga o pendente anterior (`cancelado`, G-14). Nada do usuário convidado é consultado, então a resposta não muda se o e-mail tem conta ou outro lar (D-6, anti-enumeração). Dois convites simultâneos do mesmo lar batem no índice `convite_um_pendente` e o segundo recebe `convite_pendente`.
7. **Convidado que já tem lar** (`dominio/lar.ts`, `decidirAceite`): membro de outro lar → `ja_tem_lar`; titular de lar que já teve outro membro (ativo ou que saiu) → `ja_tem_lar`; titular sozinho com qualquer dado → `ja_tem_lar`; titular sozinho com **exatamente** as 13 categorias iniciais intactas (nenhuma criada, renomeada, arquivada, excluída ou com a marca variável trocada) → o lar é **descartado**: as categorias são apagadas, o convite pendente dele é revogado e o vínculo de titular é encerrado (`saiu_em`). O aceite segue na mesma transação; qualquer recusa desfaz tudo. As tabelas das etapas 7 a 10 entram nessa checagem quando nascerem.
8. **Aceite.** Insere o `membro` (`papel = 'membro'`), marca o convite `aceito`, refaz o GUC com o lar novo e cria as 7 categorias individuais iniciais do novo membro (RN-17).
9. **Saída e remoção** (D2). `POST /api/lar/sair` (membro) e `DELETE /api/lar/membros/:id` (titular) preenchem `saiu_em` e trocam o nome por "Ex-membro". O individual do ex-membro fica no banco, invisível a todos pela RLS (o `dono_id` não é mais o membro de ninguém), até a purga de 30 dias (etapa 14). No próximo acesso o ex-membro não tem vínculo e cai no primeiro acesso (CA-23.13). O titular não sai por `POST /api/lar/sair` (`registro_invalido`).
10. **RLS mais estrita que o SDD §3.4 em três pontos:** `lar` só aceita UPDATE do titular do lar ativo (o SDD liberava também a quem criou); `convite` só aceita INSERT do titular; o UPDATE de `convite` pelo ramo do lar exige o titular (o ramo do e-mail continua, para o convidado aceitar ou recusar). A política de `membro` libera UPDATE à própria linha ou ao titular do lar. Nenhuma política lê `membro` dentro de `membro`: o papel vem do GUC.
11. **Grants** (SDD §4): sem DELETE em `lar`, `membro` e `convite`; UPDATE só de `lar.nome`, `membro.nome` e `membro.saiu_em`, `convite.situacao` e `convite.respondido_em`. Como a app não atualiza `membro.usuario_id`, ele **não** é zerado na saída (o SDD §3.4 pedia): zera a purga, pelo `on delete set null`.

## Consequências

**Positivas**
- Um link encaminhado não serve a outra conta, e o reuso não tem efeito: o banco e a API conferem token, e-mail e situação.
- O limite de 2 membros e o "um lar por usuário" valem mesmo com corrida e mesmo se a API errar a checagem.
- O lar recém-criado e vazio do convidado não atrapalha o aceite, e nada dele aparece no lar novo (CA-23.15).
- O papel no GUC deixa as políticas sem subconsulta em `membro` e sem recursão.

**Negativas**
- Mais um GUC (`app.papel`) a manter coerente com `app.lar_id` e `app.membro_id`. Mitigação: os três saem da mesma linha, na mesma instrução, num único ponto (`derivarVinculo`).
- O lar descartado e a linha do titular que saiu continuam no banco (a app não apaga `lar` nem `membro`); só a purga remove.
- A validade de 7 dias não está na política de RLS (que confere só `situacao = 'pendente'`): ela é conferida pela API com o relógio injetável, para os testes de expiração não dependerem do relógio do banco.
- O e-mail do convite sai por `waitUntil` antes do COMMIT. Se o COMMIT falhar, o convidado recebe um link que não vale (cai em `convite_invalido`).
- Um usuário que criou um lar e o deixou (descartado) ainda enxerga o nome desse lar pela política `criado_por` de `lar`, só pelo banco; nenhuma rota expõe isso.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Convite aceito só pelo token, sem conferir o e-mail | Quem recebesse o link encaminhado entraria no lar e veria todo o conjunto (TM-API-06) |
| Limite de membros por contagem na API, sem índice | Dois aceites concorrentes passariam juntos; a RLS não ajuda numa contagem |
| `SECURITY DEFINER` para aceitar convite e remover membro | Contraria a decisão 1 do PLANO; o papel no GUC resolve sem esconder privilégio |
| Política de `membro` consultando `membro` para saber se é titular | Recursão infinita de RLS no Postgres |
| Recusar o aceite de quem tem qualquer lar | Quase todo convidado já passou pelo primeiro acesso; obrigaria a excluir um lar vazio à mão (decidido em 2026-10-24: descartar o lar só com as iniciais) |
| Responder `convite_pendente` sempre que houver convite aberto | Contradiz "convite novo invalida o anterior" (RN-23, G-14); aqui `convite_pendente` fica para o reenvio ao mesmo endereço em menos de 2 min e para a corrida de dois convites |
