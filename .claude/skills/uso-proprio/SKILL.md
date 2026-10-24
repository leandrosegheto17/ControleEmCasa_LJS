---
name: uso-proprio
description: Orquestra o fluxo de aplicação para uso próprio (ferramenta pessoal, só o usuário usa, servidor local com Docker ou nuvem gratuita, custo zero) — descobre a fase pelos artefatos em .specs/, avisa a troca de modelo, aciona a peça certa (necessidade, tlc-spec-driven, implantacao) e pede aprovação ao fim de cada fase. Use quando o usuário quiser construir ou retomar uma ferramenta pessoal, ou via /fluxo. Não use para produto que será vendido (projeto-novo) nem para feature em projeto existente.
---

# Uso próprio (fluxo 2)

Você é o **orquestrador**: decide a fase, aciona a peça certa e controla as aprovações. As 9 fases e seus critérios estão em [references/fases.md](references/fases.md); leia-o na primeira vez que acionar esta skill na sessão.

Princípio: **menos cerimônia**. O usuário é o único usuário; não há plano comercial, nem lançamento gradual, nem suporte. O risco principal é **perder os dados**, e a ferramenta morre por **abandono**, não por falta de clientes.

## 1. Descobrir onde estamos

A **primeira linha que se aplica** define a fase:

| Situação dos arquivos | Fase atual |
|---|---|
| sem `.specs/produto/necessidade.md` | 1 a 3 Necessidade, escopo e restrições |
| `necessidade.md` com veredito `adaptar algo pronto` ou `desistir` | Encerrado: mostre o veredito e, se for adaptar, ofereça ajudar a configurar a solução pronta |
| `necessidade.md` com `construir`, sem `.specs/features/*/spec.md` | 4 Desenho enxuto |
| `spec.md`, e `necessidade.md` sem **Mockup** | 4 Desenho enxuto (mockup) |
| `spec.md`, sem `validation.md` com PASS | 5 e 6 Preparação e construção (o `tlc-spec-driven` retoma pelo `STATE.md` e pelo git) |
| `validation.md` com PASS, exposição pela internet e sem `seguranca.md` | 7 Validação: auditoria de segurança |
| `validation.md` com PASS (e `seguranca.md` sem crítico ou alto, se exigido), sem `.specs/implantacao.md` | 8 Implantação |
| `implantacao.md` existe | 9 Uso e manutenção |

## 2. Situar o usuário

Uma linha: "**Fase N de 9, <nome>.** Anterior: <fase>, aprovada." Se a fase pede outro modelo, avise:

- fases 1 a 4: "Esta fase rende melhor em Opus: use `/model opus`."
- fases 5 a 9: "Esta fase pode seguir em Sonnet: use `/model sonnet`."

## 3. Acionar a peça da fase

| Fase | Acione | Observações |
|---|---|---|
| 1 a 3 | skill `necessidade` | Uma conversa, um arquivo, uma aprovação. |
| 4 | `tlc-spec-driven`, fase **Specify** (e Design só se ele julgar necessário) | Entrada: `necessidade.md`. Projeto pessoal costuma ser Small ou Medium: deixe o tlc dimensionar. Os requisitos de **backup, restauração testada** e, se exposto pela internet, **autenticação e HTTPS** entram como critérios de aceite. Depois do Specify, se a ferramenta tem tela, pergunte via `AskUserQuestion`: **fazer o mockup (Recomendado)** ou **dispensar**. Fazer: skill `mockup-visual` (direções, guia e 2 a 3 telas-chave em `.specs/mockup/`). Registre em `necessidade.md` a linha **Mockup**: `aprovado`, `dispensado — <motivo>` ou `não se aplica` (sem tela). |
| 5 e 6 | `tlc-spec-driven`, fases **Tasks** (se ele não as pular) e **Execute** | Primeiras tarefas: ambiente reproduzível (Docker), esqueleto que roda ponta a ponta, **script de backup e de restauração**. Projeto pequeno roda sem subagentes; se houver lotes, use `implementador` ou `implementador-dominio`. |
| 7 | verificador do `tlc-spec-driven` (agente `verificador`) | Confere todos os critérios, inclusive a **restauração do backup a partir de uma cópia limpa**. Se a aplicação ficar exposta pela internet, despache depois o `auditor-seguranca`. Com **Mockup** `aprovado`, compare as telas (etapa 3 da `mockup-visual`). |
| 8 | skill `implantacao` | Destino conforme `necessidade.md`. Publicar na nuvem exige confirmação específica. |
| 9 | checklist de manutenção de `references/fases.md` | Ofereça a revisão periódica e a decisão manter / evoluir / aposentar. Evolução vira uma feature (fluxo 3) ou volta à fase 4. |

## 4. Fechar a fase

Apresente o que foi produzido (caminho do arquivo e 3 a 5 linhas com o essencial), o critério de passagem e se foi atendido, e pergunte via `AskUserQuestion`: **seguir / ajustar / parar**, dizendo qual é a próxima fase.

Não avance sem aprovação explícita. Antes de declarar uma fase concluída, aplique `verification-before-completion`.

## Regras

- Ações externas (push, publicar na nuvem, apagar dados) exigem confirmação específica.
- Parar é um resultado válido: registre o motivo.
- Tudo em português.
