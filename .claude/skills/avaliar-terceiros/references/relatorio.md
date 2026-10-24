# Relatório (fase 10)

Responde: **como registrar?** O relatório serve à negociação agora e a quem perguntar daqui a um ano por que se decidiu assim. Escreva para quem não acompanhou a avaliação.

## Regras

- Cada afirmação aponta para o artefato da fase que a sustenta (e dali para `arquivo:linha`, comando ou URL com data).
- **O que não foi visto** tem seção própria: material não entregue, fases dispensadas, alegações não verificadas, transitivas sem licença conferida. Limitação de escopo é parte do resultado.
- Pessoas por papel, sem nomes nem e-mails. Nada de segredo, nem trecho de dado pessoal.
- Aviso de que a parte legal **não é parecer jurídico**, com a lista do que vai ao advogado.
- Versão para fora (vendedor, sócio, cliente): sem detalhes exploráveis de vulnerabilidade ainda aberta (só a severidade e a condição) e respeitando o acordo de sigilo. Compartilhar é ação externa: confirmação específica.

## Modelo de `relatorio.md`

```markdown
# Relatório de avaliação: <candidato>

- **Data**: <AAAA-MM-DD> · **Motivo**: <...> · **Uso pretendido**: <...> · **Profundidade**: <...>
- **Cópia avaliada**: <origem> @ <commit ou sha256> · **Status**: <final | parado — <motivo>>

## Resumo
<5 a 8 linhas: o que é, decisão, fator decisivo, custo total em faixa, principais condições>

## Decisão
- **<adotar | adotar com condições | renegociar | recusar>** — <por quê, em 2 linhas> · **Mudaria se**: <...>

## Achados por gravidade
| ID | Achado | Gravidade | Efeito na decisão | Custo de corrigir | Quem resolve | Detalhe |
|---|---|---|---|---|---|---|
(impeditivos primeiro, depois condições, custos e notas; de `achados.md`)

## Custo total
<tabela resumida de `decisao.md`, com a natureza de cada número>

## Condições e riscos aceitos
<de `decisao.md`>

## Por área
- **Legal e propriedade**: <2 linhas> — `legal.md` (não é parecer jurídico; para o advogado: <N itens>)
- **Execução**: <roda? alegações confirmadas, refutadas, não verificadas> — `execucao.md`
- **Qualidade**: <...> — `qualidade.md`
- **Segurança**: <contagem por severidade> — `seguranca.md`
- **Dependências e custo de rodar**: <...> — `dependencias.md`
- **Saúde**: <fator ônibus, atividade, mantenedores> — `saude.md`

## O que não foi visto
- <item> — <motivo> — <efeito na confiança da decisão>

## Próximos passos
- <condição a cobrar, com prazo> · <conversa com o advogado> · <documentar o projeto adotado (skill `documentar`)>
- <apagar a cópia e o material ao fim, se o acordo de sigilo pedir> · <revisar a dependência em <data>>
```

## Fechamento

1. Revise com o usuário via `AskUserQuestion`: **seguir / ajustar / parar**.
2. Grave `Status: final` e, em `avaliacao.md`, **Resultado** com a decisão e a fase 10 `feita (<data>)`.
3. Com chamador: leve a decisão e as condições ao **Usar em** e responda a ele.
4. Pergunte o destino da cópia local e do material (manter para a negociação, apagar ao fim do sigilo, mover para o repositório do projeto adotado). Apagar é com confirmação específica.
5. Dependência adotada: sugira uma revisão periódica (licença, saúde, versões) com data, anotada nos **Próximos passos**.
