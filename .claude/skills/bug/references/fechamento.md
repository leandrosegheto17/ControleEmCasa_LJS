# Fechamento (fase 9)

Grave também quando o bug para antes: não é bug, duplicado, inválido, não reproduzido, parado pelo usuário ou devolvido ao fluxo chamador.

## Modelo de `fechamento.md`

```markdown
# Fechamento: <slug>

- **Data**: <AAAA-MM-DD> · **Resultado**: corrigido | não é bug | duplicado de <slug> | inválido | não reproduzido | parado (<motivo>) | devolvido a <chamador>
- **Severidade**: P0–P3 · **Do relato à correção**: <dias>

## Resumo

<2 a 4 linhas: o sintoma, a causa, a correção.>

## Correção

- **Commit**: <hash> · **Teste que fica na suíte**: `<arquivo:linha>`
- **Verificação**: `validation.md` PASS · **Revisão**: <sem bloqueio> · **Segurança**: <ok | não se aplica>
- **Checagem final**: <N passaram, 0 falharam>
- **Integração**: <merge local | PR <link> | branch mantida>
- **Liberação**: <entrada em .specs/liberacao.md | implantacao.md | sem produção | a cargo de <chamador>>
- **Confirmado onde foi visto**: <sim, em <data> | a cargo de <chamador>>

## Aviso ao relator

- **Para**: <quem> · **Enviado**: <sim, em <data> | dispensado | a cargo de <chamador>>
- **Mensagem**: <texto curto: o que foi corrigido, desde quando vale, o que a pessoa precisa fazer>

## Aprendizado

- **Recorrente?** <não | sim: mesma causa em <slugs>>
- **Prevenção**: <nenhuma | regra no contexto do projeto | lint | teste | refatoração (skill `refatoracao`)>
- **Armadilha registrada no contexto do projeto**: <sim | não>
```
