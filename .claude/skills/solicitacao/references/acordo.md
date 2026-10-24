# Estimativa, opções e acordo (fases 4 e 5)

Os números são **estimativas para decidir**, não promessas: faixa e confiança sempre, a fonte de cada um, `PREMISSA` no que é palpite. O prazo só vira compromisso no acordo.

## Fase 4: estimativa e opções

### Onde entraria

`leitor-codigo` com os `CA-NN` e o `inventario.md` (skill `inventario`, se faltar e houver código): módulos tocados, o que já existe para reaproveitar, área frágil ou sem testes (legado). Sem código acessível, toda a estimativa é `PREMISSA`.

### Estimativa

- **Por parte, não um número solto**: quebre o pedido nas partes que os `CA-NN` pedem (ex.: regra, tela, dado, integração) e estime cada uma com a **complexidade que justifica** o valor.
- **Escala**: P (até 1 dia) · M (até 1 semana) · G (até 1 mês) · GG (mais: quebre em versões). Em dias ou semanas de trabalho, com faixa (ex.: 3 a 5 dias).
- **Confiança**: alta (leitura do código, trabalho parecido já feito), média, baixa (palpite).
- **Incerteza que impede estimar** (serviço externo desconhecido, desempenho, viabilidade): não estime a parte; ela vira um **spike** (skill `spike`) com prazo próprio, e a opção diz "estimativa depois do spike".
- **Capacidade**: compare a soma com a capacidade conhecida (quem faz, quanto tempo por semana, o que já está em andamento). Sem essa informação, escreva **capacidade não informada** e pergunte ao usuário, em vez de inventar a comparação.
- **Riscos de prazo** nomeados (qual parte, quanto, por quê): dependência de terceiro, área sem testes, aprovação externa, férias. Preocupação vaga não conta.
- **Inclua o que o fluxo de destino exige**: testes, rede de proteção, verificação, revisão, liberação. Estimativa só do código é estimativa errada.

### Opções

Antes das opções, uma vez: **existe jeito mais barato que construir?** Mudar um padrão, tirar um passo, fazer à mão os primeiros casos, resolver só a metade que concentra o custo, comprar pronto (só se existe e quanto custa, sem desenhar). Os que não servem saem em uma linha cada; o que sobreviver entra como opção, dizendo qual parte do custo remove e qual deixa.

Ofereça **2 ou 3 opções que você entregaria** (nunca uma de enfeite):

| Opção | O que é |
|---|---|
| **Mínima agora, completa depois** | os `CA-NN` indispensáveis agora; os desejáveis numa segunda entrega, que só começa se a primeira provar valor |
| **Parcial por menos** | resolve a parte que concentra o custo, sem alguns casos (diga quais e o que o solicitante faz neles) |
| **Completa** | todos os `CA-NN` numa entrega |

Cada opção diz: `CA-NN` cobertos, esforço (faixa), prazo provável a partir do início (faixa, sem data de calendário ainda), riscos, o que fica fora e o custo permanente (manutenção, suporte). Recomende uma, com o motivo.

### Modelo

```markdown
## Estimativa e opções

- **Onde entraria**: <módulos, `arquivo:linha`; reaproveita <...>>
- **Partes**: | Parte | `CA-NN` | Complexidade (por quê) | Esforço | Confiança | (até 8 linhas)
- **Spike**: <— | pergunta, prazo>
- **Capacidade**: <quem, quanto por semana, o que já ocupa | não informada>
- **Riscos de prazo**: <parte — quanto — por quê>
- **Mais barato que construir**: <descartados em uma linha | sobrevivente e o que remove>
- **Opções**: | Opção | `CA-NN` | Esforço | Prazo provável | Fora | Riscos |
- **Recomendada**: <opção> — <motivo>
- **Enviadas ao solicitante**: <data, canal> · **Escolha dele**: <pendente | opção, data, "<trecho>">
```

As opções vão ao solicitante pela skill `demandas`, **Avisar** (modelo "opções" em [mensagens.md](mensagens.md)), com confirmação de envio; situação `aguardando autor`. Ele escolhe; a fase 5 transforma a escolha em acordo.

## Fase 5: negociação e prioridade

### Comparar com o que já existe

- Trabalho em andamento em `.specs/` (features, bugs, redesign, integrações...) e demandas `planejada` e `encaminhada` com acordo: tabela curta com prazo combinado de cada uma.
- **O que sai ou atrasa** se esta entrar agora, dito explicitamente ao usuário e, se afeta outro solicitante, a quem decide entre eles. Capacidade é finita.
- Dependência real ordena antes da urgência (B precisa de A: A vem antes).
- Conflito de prioridade entre solicitantes: não decida pela sessão; o usuário decide (ou leva a quem tem autoridade sobre os dois), e a decisão fica registrada.

### O acordo

| Item | O que registrar |
|---|---|
| **Escopo** | a opção escolhida e os `CA-NN` que entram (texto confirmado na fase 2, sem reescrever) |
| **Fica adiado** | os `CA-NN` e partes que saem; cada item vira **demanda nova** `planejada` (ou `em observação`) com **Originada de**, para não se perder |
| **Prazo** | data de entrega com a confiança; se depende de spike ou de terceiro, a condição. Início, se não for agora (situação `planejada`) |
| **Marcos** | 2 a 4 pontos de atualização, ligados a fases do destino (ex.: spec pronta, plano aprovado, verificação concluída, pronto para o aceite) com data; e o canal |
| **Critério de aceite** | os `CA-NN` do escopo; como será a demonstração (onde: staging, local, produção com flag só para ele; quem participa) |
| **Desvio** | o que conta como desvio a avisar (ex.: prazo provável passou da data, um `CA-NN` não cabe) e em quanto tempo o solicitante é avisado |
| **Mudança de escopo** | "pedidos novos durante o trabalho viram nova solicitação" |

### Decisão (do usuário, depois do solicitante)

Pergunte via `AskUserQuestion`, com a recomendada primeiro: **fechar o acordo** (mensagem de acordo ao solicitante, pedindo confirmação por escrito), **planejar** (acordo com início futuro), **renegociar** (volta à fase 4 com o que mudou) ou **recusar** (motivo honesto, mensagem de decisão da `demandas`). O acordo só vale com a confirmação escrita registrada.

### Modelo

```markdown
## Acordo

- **Versão**: <N> (<data>) · **Confirmado por escrito**: <pendente | <data>, <canal>, "<trecho>">
- **Comparação**: | Trabalho | Prazo combinado | Situação | (até 5 linhas) · **Sai ou atrasa**: <...>
- **Escopo**: opção <...> — CA-01, CA-03, ...
- **Fica adiado**: <CA-NN → DEM-NNN (planejada)>
- **Prazo**: <data> (confiança <...>; condição <...>) · **Início**: <agora | data>
- **Marcos**: | Marco | Fase do destino | Data | Canal |
- **Aceite**: <onde, quem, como> · **Desvio**: <o que conta, em quanto tempo avisar>
- **Versões anteriores**: <v1 (<data>): <o que mudou e por quê>>
```

Renegociação depois do acordo (desvio, mudança de escopo) gera uma nova versão, com o motivo, reenviada e confirmada por escrito; a anterior fica em "Versões anteriores".
