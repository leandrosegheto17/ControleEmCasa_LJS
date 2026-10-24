# Objetivo (fase 1)

Responde: **por que avaliar e o que decidirá o resultado?** Sem critério escrito antes, qualquer demonstração bem feita convence.

## Conversa

Uma pergunta por vez, via `AskUserQuestion`, a recomendada primeiro, com sugestão e "Ainda não sei" nas abertas (vira `[A ESCLARECER]`; eliminatório `[A ESCLARECER]` não passa desta fase).

1. **Motivo**: comprar (código ou empresa), herdar (projeto que passa para o usuário ou a equipe), adotar como dependência (biblioteca, projeto aberto, SDK), contratar quem fez (avaliar trabalho de alguém), contribuir (entrar num projeto aberto).
2. **Candidato**: nome, quem oferece (vendedor, autor, comunidade), onde está (repositório, zip, acesso a um ambiente), preço ou proposta, se houver.
3. **Uso pretendido**, porque a licença e o custo dependem dele: uso interno, produto vendido instalado na máquina do cliente (redistribuição), serviço na web (SaaS), embarcado, revenda, modificação do código, código fechado ou aberto do lado do usuário.
4. **O que seria um bom resultado**: o que precisa funcionar, prazo, orçamento, quem vai manter depois.
5. **Alternativa** se recusar: construir do zero, outro candidato conhecido, ficar como está. Se houver alternativas reais, a fase 9 usa a skill `escolha-tecnologia`.
6. **Restrições**: confidencialidade do material (acordo de sigilo), prazo do vendedor, o que não pode sair do computador do usuário.

**Não abra o código nem o material do vendedor nesta fase.** Se o usuário já viu uma demonstração e gostou, anote em **Impressão inicial** e siga sem ela.

## Critérios de decisão

Escritos **antes** de olhar o candidato e congelados na aprovação. Mesma forma da `escolha-tecnologia` (`../escolha-tecnologia/references/criterios.md`), para a fase 9 poder passá-los adiante sem reescrever.

**Eliminatórios** (falhou, recusa ou renegocia), cada um verificável. Exemplos: licença compatível com o uso pretendido; titularidade transferível (comprar, herdar); roda a partir do que é entregue; sem crítico de segurança sem correção possível; projeto ativo (dependência); custo mensal de rodar abaixo de X; trata dado pessoal conforme a LGPD.

**Desejáveis** (peso 1 a 3): qualidade e testes, documentação, saúde e fator ônibus, custo de manter, dependência de fornecedor, encaixe com a stack do usuário, custo total abaixo do de construir.

Teste do critério: diga o que faria o candidato ir mal nele. Se nada faria, é vago: refaça.

## Motivo × fases

| Motivo | Fases centrais | Leves ou dispensáveis (profundidade `enxuta`) |
|---|---|---|
| Comprar | todas | — |
| Herdar | 3, 4, 5, 6, 8 | 9 (sem preço: custo de manter e de corrigir) |
| Adotar como dependência | 3, 7, 8 | 4 (exercitar só o uso pretendido), 5 (amostra da API pública), 6 (dependências e avisos de segurança conhecidos, fases 4-5 da auditoria) |
| Contratar quem fez | 3 (titularidade: quem escreveu), 4, 5 | 7, 8 (só se o projeto vier junto), 9 (sem preço do código) |
| Contribuir | 3 (licença e acordo de contribuição), 4, 8 | 5 (convenções), 6, 7 e 9 dispensáveis |

Legal (3) nunca é dispensada. Proponha a profundidade pelo motivo e pelo tamanho do compromisso (quanto custa errar); na dúvida, `completa`.

## Modelo de `avaliacao.md`

É também o **contrato de entrada** quando outro fluxo chama esta skill.

```markdown
# Avaliação de terceiros: <candidato>

- **Slug**: <slug> · **Data**: <AAAA-MM-DD>
- **Chamado por**: <usuário | fluxo N <pasta>> · **Usar em**: <arquivo do chamador | —>
- **Motivo**: <comprar | herdar | adotar como dependência | contratar quem fez | contribuir>
- **Candidato**: <nome, quem oferece, onde está, preço ou proposta>
- **Uso pretendido**: <interno | SaaS | redistribuído | embarcado | revenda> · modificação: <sim | não> · código do usuário: <fechado | aberto>
- **Bom resultado**: <...> · **Alternativa se recusar**: <...>
- **Restrições**: <sigilo, prazo, o que não sai do computador | nenhuma>
- **Profundidade**: <completa | enxuta>
- **Impressão inicial**: <nenhuma | <o que o usuário já viu>, anotada antes dos critérios>
- **Critérios aprovados**: <pendente | sim (<data>)>
- **Resultado**: <pendente | adotar | adotar com condições | renegociar | recusar | parada — <motivo>>

## Critérios de decisão (congelados na aprovação)

### Eliminatórios
| # | Requisito | Como se verifica | Fase |
|---|---|---|---|
| E1 | <...> | <fonte ou teste> | <3> |

### Desejáveis
| # | Critério | Peso (1-3) | O que é bom |
|---|---|---|---|
| D1 | <...> | <n> | <...> |

### Mudanças de critério
<nenhuma | <data>: <o que mudou>, motivo, aprovada pelo usuário>

## Fases
| # | Fase | Situação |
|---|---|---|
| 1 | Objetivo | pendente · feita (<data>) · dispensada — <motivo> |
| 2 | Acesso e escopo | ... |
| 3 | Legal e propriedade | ... |
| 4 | Execução | ... |
| 5 | Qualidade do código | ... |
| 6 | Segurança | ... |
| 7 | Dependências e infraestrutura | ... |
| 8 | Saúde e sustentabilidade | ... |
| 9 | Custo total e decisão | ... |
| 10 | Relatório | ... |
```

Antes da aprovação, acrescente ao `.gitignore` do projeto a linha `.specs/avaliacoes/*/evidencias/` (mostrando o diff). Com acordo de sigilo, pergunte se a pasta inteira da avaliação fica fora do git.
