# PRD — Controle em Casa

- **Status:** Aprovado pelo usuário em 2026-10-24 (etapa 0 do `.md/PLANO.md`).
- **Base:** `.md/ANALISE-MYMONEY.md` (análise do legado e decisões P1–P9 do usuário) e o PRD do MyMoney (`C:\Leandro\Projetos\MyMoney\.md\PRD.md`, aprovado em 2026-10-09).
- **Origem:** recriação do MyMoney no Padrão LJS, com o mesmo núcleo de produto, agora com cadastro aberto e plano pago.
- **Regras e critérios de aceite:** `.md/PRD-TECNICO.md`. **Desenho:** `.md/SDD.md`.

---

## 1. Problema

- Casais dividem as despesas da casa e também têm contas, receitas e gastos individuais.
- **Problema central:** os gastos variáveis do dia a dia (mercado, delivery, almoço fora) fogem do controle. O casal não sabe se gasta R$ 2.000 ou R$ 6.000 por mês com eles.
- **Problemas secundários:**
  - não há visão única das despesas fixas da casa nem de quem pagou o quê;
  - não há orçamento com acompanhamento;
  - compras parceladas comprometem meses futuros sem que ninguém veja;
  - metas de poupança ficam sem acompanhamento (quanto falta, quem depositou, onde está guardado).
- **Restrição de privacidade:** cada um vê o conjunto e ninguém vê o individual do outro. Numa despesa conjunta paga por um, o outro vê **que foi paga e por quem**, mas não vê a forma de pagamento nem a conta usada.
- **Concorrente real:** não registrar nada. O app só vence se registrar um gasto for mais fácil do que ignorá-lo.
- **Hoje:** a família do stakeholder controla isso numa planilha, e o MyMoney (uso privado, 2 usuários) provou o fluxo desde 2026-10-15.

## 2. Público

- **Primário:** casais (ou duas pessoas que dividem a casa) que querem separar o conjunto do individual. O lar tem **um titular e até um membro convidado**.
- **Também atende:** uma pessoa sozinha, num lar sem convidado, usando só o individual e as despesas da casa.
- **Uso:** celular **na hora do gasto**, para lançar; celular ou computador para acompanhar o mês. PWA instalável no Android e no iPhone.
- **Fora do público agora:** famílias com 3 ou mais membros, empresas, contadores.

## 3. Proposta de valor

> "Saiba quanto a casa gasta de verdade, sem expor o que é só seu."

- Lançar um gasto em até 10 segundos, inclusive sem internet.
- Uma tela com o total do casal e o seu individual no mês.
- Crédito parcelado que mostra o que já está comprometido nos próximos meses.
- Orçamento por categoria ("estou cumprindo?") e metas de poupança com quanto falta (Pro).

## 4. Métricas de sucesso

As métricas M1, M3 e M4 vêm do legado. M5 e M6 são novas, para o produto aberto.

| # | Métrica | Meta | Como medir |
|---|---|---|---|
| M1 | Cobertura do gasto variável registrado | Total do app dentro de 10% do extrato e da fatura | Conferência manual do stakeholder no fim do mês |
| M3 | Tempo para lançar um gasto no celular | Mediana ≤ 10 s, com até 3 toques além do valor | Cronometragem de 10 lançamentos reais |
| M4 | Clareza do gasto variável do mês | Um número único, por categoria, que o casal reconhece | Pergunta direta ao casal |
| M5 | Ativação | Usuário cadastrado que lança ao menos 5 gastos na 1ª semana | Consulta no banco (agregada, sem dado pessoal) |
| M6 | Conversão do trial | Proporção de lares que assinam o Pro ao fim dos 14 dias | Tabela `assinatura` |

**Observação (P5):** a sessão expira após 15 min de inatividade. Isso pode afetar a M3, porque quase todo lançamento começará com um login. A fila offline guarda o gasto, que é enviado depois do login. A M3 deve ser medida com esse fluxo e, se ficar acima da meta, a decisão P5 é revista em ADR.

## 5. Escopo

### 5.1 Núcleo (o mesmo do MyMoney)

| Item | Plano | Regra |
|---|---|---|
| Tela principal: resumo do mês com o bloco **Conjunto** no topo e o **Meu individual** abaixo | Free | RN-16 |
| Lançamento rápido de despesa (valor, categoria, forma), também offline | Free | RN-01, RN-05, ADR-007 do legado |
| Categorias conjuntas e individuais, de despesa e receita, com a marca "variável" | Free | RN-02, RN-17 |
| Contas individuais com saldo e ajuste de saldo | Free | RN-12 |
| Formas de pagamento privadas (Pix, Débito, Crédito) | Free | RN-02 |
| Crédito à vista ou parcelado, com parcelas no vencimento do cartão a partir do mês seguinte | Free | RN-13, RN-14 |
| Receitas individuais | Free | RN-17 |
| Despesas fixas conjuntas recorrentes, pendentes ou pagas | Free | RN-28 (correção) |
| Editar e excluir lançamentos, inclusive a compra parcelada inteira | Free | RN-06, RN-07 |
| Registro de pagamento do cartão | Free | — |
| **Orçamento mensal por categoria** ("estou cumprindo?") | **Pro** | RN-24, RN-25 |
| **Metas de poupança** individuais e compartilhadas, com aportes por local | **Pro** | RN-08, RN-09, RN-24, RN-25 |

### 5.2 Novo (Padrão LJS)

| Item | Regra |
|---|---|
| Landing em `/` com proposta de valor, planos e "Começar grátis"; o app fica em `/app` | — |
| Cadastro aberto com confirmação por e-mail, aceite de termos, entrar, sair, sair de todos os aparelhos, recuperação de senha | RN-19, RN-20, RN-21 |
| Lar criado no primeiro acesso, com o usuário como titular e as categorias iniciais | RN-22 |
| Convite do segundo membro por e-mail | RN-23 |
| Planos Free e Pro, com trial Pro de 14 dias sem cartão | RN-24 |
| Página "Meu plano": plano atual, renovação, Pix copia-e-cola e QR, cancelar | RN-24 |
| Ao cair para o Free, orçamento e metas ficam **somente leitura**, sem apagar dados | RN-25 |
| `/termos` e `/privacidade` (LGPD); exclusão de conta pelo próprio usuário, com e-mail de confirmação e purga em 30 dias | RN-26 |
| Notificações push: fixa vencendo ou atrasada, lembrete diário opcional de lançar, meta atingida | RN-27 |
| E-mails transacionais: confirmação, recuperação, convite, cobrança gerada, pagamento confirmado, atraso | — |

### 5.3 Planos

| | Free | Pro |
|---|---|---|
| Preço | R$ 0 | **R$ 9,90/mês**, Pix como método principal (Asaas) |
| Lançamentos, fixas, resumo, contas, formas, categorias | Sim | Sim |
| Convite do segundo membro | Sim | Sim |
| Orçamento | Somente leitura do que já existia | Sim |
| Metas | Somente leitura do que já existia | Sim |
| Quem paga | — | O **titular**. O plano vale para o **lar**, e o membro convidado usa o Pro sem pagar |
| Trial | — | 14 dias de Pro no cadastro, sem cartão |

### 5.4 Fora do escopo

| Item | Motivo |
|---|---|
| Migração dos dados do MyMoney atual | Decisão P3: começar vazio |
| Mais de 2 membros por lar | Decisão P1 |
| Integração bancária, Open Finance, importação de extrato, leitura de nota | Igual ao legado: registro manual |
| Fatura do cartão (fechamento, juros) | Igual ao legado: só o dia de vencimento, e diferenças viram ajuste manual da data da parcela |
| Exportação CSV, relatórios de vários meses, acerto de contas entre membros | Igual ao legado |
| Conta conjunta, receita conjunta, transferência entre membros, dinheiro em espécie | Igual ao legado |
| App de loja, outras moedas, investimentos | Igual ao legado |
| Ambiente de homologação | Padrão LJS: o preview é o `wrangler dev` local |

## 6. Requisitos de alto nível

Ordem de entrega conforme o `.md/PLANO.md`.

| # | Requisito | Prioridade | Etapa |
|---|---|---|---|
| RA-01 | Cadastro aberto, confirmação de e-mail, acesso e sessão seguros | Must | 4 |
| RA-02 | Lar com titular e convite do segundo membro, com isolamento entre lares | Must | 6 |
| RA-03 | Regra de privacidade entre membros garantida no servidor | Must | 6–8 |
| RA-04 | Contas, formas de pagamento e categorias | Must | 7 |
| RA-05 | Lançamento rápido de despesa e receita, editar e excluir, crédito parcelado | Must | 8 |
| RA-06 | Despesas fixas conjuntas e tela principal com o resumo do mês | Must | 9 |
| RA-07 | Orçamento e metas | Must | 10 |
| RA-08 | PWA instalável, com lançamento offline e o mesmo layout do MyMoney | Must | 11–12 |
| RA-09 | Planos Free e Pro, trial, assinatura por Pix, Meu plano | Must | 13 |
| RA-10 | Landing, termos, privacidade, exclusão de conta | Must | 14 |
| RA-11 | Notificações push | Should | 15 |
| RA-12 | Observabilidade, backup e deploy automatizados | Must | 16 |

## 7. Premissas e riscos de produto

| # | Premissa ou risco | Situação |
|---|---|---|
| PR-01 | O núcleo validado pelo casal no MyMoney serve a outros casais | `PREMISSA`: sem pesquisa de mercado, por decisão do usuário |
| PR-02 | O valor do Pro (orçamento e metas) justifica R$ 9,90/mês | `PREMISSA`, a medir pela M6 |
| PR-03 | A categoria define o escopo, e cada um lança os próprios gastos | Confirmada no legado |
| PR-04 | "Minha parte" no conjunto = o que eu paguei, sem acerto de contas | Confirmada no legado (risco R-06 aceito) |
| PR-05 | Parcela no vencimento do mês seguinte; diferença da fatura real é ajuste manual | Confirmada no legado (risco R-07 aceito) |
| R-01 | Lançar fica lento por causa do login frequente (P5) | Risco; medir pela M3 |
| R-02 | Pausa ou limite da infraestrutura gratuita (Neon Free, Workers Free) | Risco; conferir os limites atuais na publicação |
| R-03 | Casos de borda da privacidade entre membros | Mitigado pelas regras e pelo teste negativo de isolamento |
| R-04 | Escopo crescer por ter cadastro aberto (pedidos de usuários) | Pedido novo vai para o fluxo de feature, depois da publicação |

## 8. Perguntas em aberto

Todas **resolvidas** pelo usuário em 2026-10-24 (detalhes no PRD-TECNICO §6 e no SDD §14):

- exclusão de conta do titular quando há membro ativo: o lar é encerrado com aviso ao membro;
- saída ou remoção de membro: individual purgado em 30 dias; conjuntas que pagou ficam com "Ex-membro"; o titular pode remover;
- convidado que já tem lar próprio: lar só com as categorias iniciais é descartado no aceite; com dados, o aceite é recusado (`ja_tem_lar`);
- perda do Pro: no fim do período pago, com 3 dias de carência no atraso; sem novo trial.
