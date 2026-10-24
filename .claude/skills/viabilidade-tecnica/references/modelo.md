# Modelo de `.specs/produto/viabilidade-tecnica.md`

```markdown
# Viabilidade técnica: <título curto>

- **Data**: <AAAA-MM-DD>
- **Opção avaliada**: <nome da opção recomendada em solucao.md>
- **Veredito**: viável | viável com riscos | inviável

## Incertezas e como foram resolvidas

| # | Incerteza | Dimensão | Caminho | Resultado | Evidência |
|---|---|---|---|---|---|
| 1 | <...> | integrações | pesquisa | <resposta> | <fonte> |
| 2 | <...> | funcionalidade central | spike | sim / não / sim com ressalvas | `.specs/spikes/<slug>/registro.md` |
| 3 | <...> | volume | risco aceito | — | <motivo> |

## Dados e LGPD

- **Dados guardados**: <...>
- **Dado pessoal ou sensível**: sim / não — <quais>
- **Cuidados exigidos**: <base legal, retenção, consentimento, exclusão>

## Segurança

- <riscos principais e o que exigem (autenticação, autorização por usuário, criptografia...)>

## Custo de operação estimado

| Item | Início (mês) | Com o volume esperado (mês) | Fonte |
|---|---|---|---|
| Hospedagem | <valor> | <valor> | <fonte | PREMISSA> |
| Banco de dados | ... | ... | ... |
| Serviços externos | ... | ... | ... |
| **Total** | <valor> | <valor> | |

## Stack candidata (não decidida)

- <opção A>: <por que atende>
- <opção B>: <por que atende>

## Riscos e mitigação

| Risco | Impacto | Probabilidade | Mitigação |
|---|---|---|---|
| <...> | alto/médio/baixo | alta/média/baixa | <...> |

## Veredito e motivo

<um parágrafo: por que viável, viável com riscos ou inviável; se inviável, o que mudaria o quadro>
```
