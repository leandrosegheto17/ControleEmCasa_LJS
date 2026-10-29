# Casa: remover membro e sair do lar — Especificação

## Problem Statement

A API já tem `DELETE /api/lar/membros/:id` (titular remove o membro) e `POST /api/lar/sair` (membro sai), com os efeitos de CA-23.12 a CA-23.14 e ADR-009 §9. O front não oferece nenhuma das duas ações: a tela "Casa e membros" só lista os membros e envia convite. Quem convidou a pessoa errada, ou quer deixar a casa, não consegue. É a pendência do front desde a etapa 12.

## Objetivos

- [x] O titular remove o membro pela tela "Casa e membros", com confirmação que diz os efeitos.
- [x] O membro sai da casa pela mesma tela, com confirmação que diz os efeitos, e cai no primeiro acesso.
- [x] Nenhuma ação destrutiva entra na fila offline.

## Out of Scope

| Item | Motivo |
| --- | --- |
| Mudar a API, o banco ou o contrato | Já prontos e verificados (etapa 6, ADR-009) |
| Titular sair da casa ou transferir a titularidade | A API recusa (`registro_invalido`); a saída do titular é excluir a conta (RN-26) |
| Purga de 30 dias e apagar `lancamento_pagamento` do removido | Etapa 14 (já entregue) e `purgar.ts` |
| E-mail ao membro removido | Não existe na API; fora desta etapa |
| Desfazer a saída ou a remoção | Só por novo convite (RN-23) |

## Assumptions & Open Questions

| Premissa / decisão | Padrão escolhido | Justificativa | Confirmada? |
| --- | --- | --- | --- |
| Destino depois de sair | Primeiro acesso (`/app/bem-vindo`), com aviso de que saiu | CA-23.13; escolha do usuário em 2026-10-29 | s |
| Texto de confirmação | Efeitos completos (acesso ao conjunto, individual em 30 dias, "Ex-membro", só volta por novo convite) | Escolha do usuário em 2026-10-29 | s |
| Offline | Ações só online; botões desativados sem conexão, com aviso | Ação destrutiva sobre outra pessoa não vai para a fila; escolha do usuário em 2026-10-29 | s |
| Quem vê qual botão | Titular vê "Remover" no membro; membro vê "Sair da casa" em si mesmo; ninguém mais vê nenhum | A API já recusa o resto; o front só não oferece | s |
| Falha de rede no meio da ação | Mostra erro de conexão e mantém o estado; nada é presumido | A API é idempotente quanto ao efeito final: já saído devolve `registro_invalido` | s |
| `registro_invalido` na remoção (membro já saiu) | Trata como já resolvido: recarrega a lista e informa que o membro não está mais na casa | Evita erro confuso numa corrida entre as duas ações | s |

**Open questions:** none; todas resolvidas ou registradas acima.

---

## User Stories

### P1: Titular remove o membro ⭐ MVP

**História**: Como titular, quero remover o segundo membro da casa para que ele deixe de ver o conjunto.

**Por que P1**: sem isso o titular fica preso a um convite aceito por engano.

**Critérios de aceite**:

1. WHEN o titular abre "Casa e membros" e a casa tem outro membro THEN o sistema SHALL mostrar o botão "Remover" ao lado desse membro.
2. WHEN o titular toca em "Remover" THEN o sistema SHALL abrir uma confirmação destrutiva com o nome do membro e o texto dos efeitos (perde o acesso ao conjunto; o que é só dele some em 30 dias; as despesas conjuntas que pagou ficam como "Ex-membro"; só volta por novo convite).
3. WHEN o titular confirma THEN o sistema SHALL chamar `DELETE /api/lar/membros/:id` com o id do membro e, no sucesso, SHALL recarregar a lista de membros e mostrar o aviso "Membro removido".
4. WHEN o titular cancela, toca no véu ou aperta Esc THEN o sistema SHALL fechar a confirmação sem chamar a API.
5. WHILE a remoção está em andamento o sistema SHALL manter o botão de confirmar inerte e impedir um segundo envio.
6. IF a API responde `registro_invalido` THEN o sistema SHALL recarregar a lista e mostrar "Este membro já não está na casa".
7. IF a chamada falha por rede ou erro do servidor THEN o sistema SHALL manter a confirmação aberta com a mensagem de erro e a lista inalterada.
8. The sistema SHALL NOT mostrar "Remover" para o próprio titular nem a quem não é titular.

**Teste independente**: com titular e membro, remover o membro e ver a lista voltar só com o titular.

---

### P1: Membro sai da casa ⭐ MVP

**História**: Como membro, quero sair da casa para deixar de compartilhar meus dados com ela.

**Por que P1**: é o direito de saída do convidado (CA-23.12, CA-23.13).

**Critérios de aceite**:

1. WHEN um membro não titular abre "Casa e membros" THEN o sistema SHALL mostrar o botão "Sair da casa".
2. WHEN o membro toca em "Sair da casa" THEN o sistema SHALL abrir uma confirmação destrutiva com o texto dos efeitos (perde o acesso ao conjunto; o que é só dele some em 30 dias; as despesas conjuntas que pagou ficam como "Ex-membro"; só volta por novo convite).
3. WHEN o membro confirma THEN o sistema SHALL chamar `POST /api/lar/sair` e, no sucesso, SHALL renovar a sessão e levar o usuário a `/app/bem-vindo`, mostrando o aviso "Você saiu da casa".
4. WHEN o membro cancela, toca no véu ou aperta Esc THEN o sistema SHALL fechar a confirmação sem chamar a API.
5. WHILE a saída está em andamento o sistema SHALL manter o botão de confirmar inerte e impedir um segundo envio.
6. IF a API responde `registro_invalido` ou `sem_lar` THEN o sistema SHALL renovar a sessão e seguir o destino que a sessão indicar, sem mostrar erro.
7. IF a chamada falha por rede ou erro do servidor THEN o sistema SHALL manter a confirmação aberta com a mensagem de erro e o membro na casa.
8. The sistema SHALL NOT mostrar "Sair da casa" ao titular.

**Teste independente**: entrar como membro, sair, e ver o primeiro acesso com uma casa nova vazia.

---

### P2: Sem conexão

**História**: Como usuário, quero saber por que não posso remover ou sair sem internet.

**Por que P2**: evita ação destrutiva presumida e fila offline surpreendente.

**Critérios de aceite**:

1. WHILE o aparelho está sem conexão o sistema SHALL manter "Remover" e "Sair da casa" desativados e mostrar o aviso "Precisa de conexão para esta ação".
2. The sistema SHALL NOT enfileirar a remoção nem a saída na fila offline.

**Teste independente**: com o modo avião ligado, os dois botões ficam desativados com o aviso.

---

## Casos limite

- IF o titular tem a casa sozinho (sem outro membro) THEN o sistema SHALL NOT mostrar nenhum botão de remoção ou saída.
- WHEN o titular remove o membro THEN o sistema SHALL voltar a oferecer o formulário de convite, pela regra existente (RN-23: a casa passa a ter 1 membro).
- IF a sessão expirou durante a ação THEN o sistema SHALL seguir o tratamento de sessão já existente (aviso e login), sem repetir a ação sozinho.

---

## Requirement Traceability

| ID | História | Fase | Situação |
| --- | --- | --- | --- |
| CASA-01 | P1: Titular remove o membro (critérios 1 a 4) | T1, T2, T4, T5, T7 | Implementado |
| CASA-02 | P1: Titular remove o membro (critérios 5 a 8) | T3, T5, T7 | Implementado |
| CASA-03 | P1: Membro sai da casa (critérios 1 a 4) | T1, T2, T4, T6, T8 | Implementado |
| CASA-04 | P1: Membro sai da casa (critérios 5 a 8) | T3, T6, T8 | Implementado |
| CASA-05 | P2: Sem conexão | T2, T4, T8 | Implementado |

**Cobertura:** 5 requisitos, 5 mapeados a tarefas.

---

## Critérios de sucesso

- [ ] O titular remove o membro em até 2 toques depois de abrir "Casa e membros" (Remover, Confirmar).
- [ ] O membro que sai cai no primeiro acesso e ganha uma casa nova vazia, sem dado da casa anterior.
- [ ] Zero chamadas a `/api/lar/sair` ou a `/api/lar/membros/:id` sem confirmação explícita.
