# As 10 fases da avaliação de terceiros

Princípio: **descobrir o que realmente se está levando.** Desenho original: `.rascunho/FLUXO-AVALIACAO-TERCEIROS.md`. Artefatos em `.specs/avaliacoes/<slug>/`; a cópia do código do terceiro fica **fora** do projeto (caminho em `acesso.md`).

| # | Fase | Pergunta | Saída | Critério de passagem | Modelo |
|---|---|---|---|---|---|
| 1 | Objetivo | Por que avaliar e o que decidirá o resultado? | `avaliacao.md` (motivo, uso pretendido, critérios, profundidade, **Fases**) | Motivo e uso pretendido escritos; eliminatórios verificáveis e desejáveis com peso, **antes** de olhar o candidato; fases fora do escopo `dispensada` com motivo | Opus |
| 2 | Acesso e escopo | O que posso examinar? | `acesso.md`, `alegacoes.md`, cópia local fora do projeto | Material recebido listado com origem e data; cópia com commit registrado; restrições de uso do material; **Não visto** preenchido; nada executado ainda | Sonnet |
| 3 | Legal e propriedade | O que é permitido fazer com isso? | `legal.md`, `evidencias/licencas*` | Licença do projeto e das dependências (diretas com fonte; transitivas por ferramenta ou marcadas não vistas) contra o uso pretendido; titularidade, marcas, LGPD e obrigações com resposta ou `[A ESCLARECER]`; aviso de que não é parecer jurídico | Opus |
| 4 | Execução | Funciona do jeito que dizem? | `execucao.md`, `inventario.md` (na pasta da avaliação) | Ambiente isolado confirmado; instalado do zero; suíte e aplicação rodaram (ou o bloqueio está registrado); fluxos principais exercitados; cada alegação com `confirmada`, `refutada` ou `não verificada` | Sonnet |
| 5 | Qualidade do código | Em que estado está? | `.specs/revisoes/terceiro-<slug>/`; `qualidade.md` | Revisão devolvida após a análise; recorte e amostra justificados; achados com custo de corrigir estimado | Sonnet |
| 6 | Segurança | Que riscos vêm junto? | `.specs/seguranca/<data>-terceiro-<slug>/`; `seguranca.md` | Auditoria fases 1 a 7 e 9 concluída (8 `não se aplica`); críticos e altos com efeito na decisão | Sonnet (auditor em Opus) |
| 7 | Dependências e infraestrutura | Do que depende? | `dependencias.md` | Cada dependência direta com versão usada, atual, última versão publicada e situação; runtime com fim de suporte; serviços pagos, contas e custo mensal com fonte e data; bloqueio por fornecedor avaliado | Sonnet |
| 8 | Saúde e sustentabilidade | Dá para manter? | `saude.md`, `evidencias/propriedade.*` | Atividade ao longo do tempo (não um instantâneo), mantenedores, fator ônibus, código sensível sem dono, ritmo de correções; custo de manter em horas por mês | Sonnet |
| 9 | Custo total e decisão | Vale a pena? | `decisao.md` (e `.specs/escolhas/<slug>/`, se houve comparação) | Custos somados com a natureza de cada número; comparação com construir do zero ou com alternativas; fator decisivo; decisão do usuário com condições | Opus |
| 10 | Relatório | Como registrar? | `relatorio.md`, **Resultado** em `avaliacao.md` | Resumo, achados por gravidade, custo, condições, riscos aceitos e **o que não foi visto**; revisado com o usuário | Sonnet |

## Aprovações

Uma por fase (seguir / ajustar / parar). Nas fases 5 e 6, as skills chamadas pedem as aprovações delas; a da avaliação vem depois, sobre o resumo. Eliminatório que falha em qualquer fase abre a saída "direto à decisão" (`SKILL.md`).

## Profundidade

`completa` (todas as fases que o motivo pede) ou `enxuta` (as marcadas como leves na tabela de `objetivo.md`). A fase 1 propõe pelo motivo e pelo tamanho do compromisso; o usuário confirma. Legal (3) nunca é dispensada: código excelente que não se pode usar não vale nada.

## Achados consolidados (`achados.md`)

Cada fase acrescenta seus achados a `achados.md`, numa só tabela, para a fase 9 somar e a 10 ordenar. Os das skills chamadas entram com o ID delas (`SEC-NNN`, `REV-NNN`) como origem.

```markdown
# Achados: <slug>

| ID | Fase | Origem | Achado | Evidência | Gravidade | Efeito na decisão | Custo de corrigir | Quem resolve |
|---|---|---|---|---|---|---|---|---|
| AV-001 | 3 | — | dependência `x` em AGPL-3.0, uso pretendido é SaaS fechado | `package.json:12`, licença em <url> (<data>) | alta | impeditivo · condição · custo · nota | <horas ou faixa> (estimativa) | vendedor · nós · ninguém |
```

- **Gravidade**: a da origem quando houver (segurança: crítico, alto, médio, baixo); nas demais fases, alta, média ou baixa.
- **Efeito na decisão**: `impeditivo` (fere um eliminatório: recusar ou renegociar), `condição` (só adota se for resolvido antes ou por contrato), `custo` (entra na conta da fase 9), `nota` (registro, sem efeito).
- **Custo de corrigir**: horas ou faixa, marcado `estimativa`; sem base, `não quantificável`, nunca um número inventado.
- **Quem resolve**: o vendedor antes de fechar, nós depois de adotar, ou ninguém (risco aceito, com dono).

## Laços comuns

- Eliminatório falhou → saída "direto à decisão" ou seguir para ter argumento; fases puladas ficam `dispensada` com o motivo.
- Alegação refutada na execução → achado; se o critério dependia dela, é candidato a `impeditivo`.
- Ferramenta não instalada → `NÃO EXECUTADO` e pergunta (instalar, seguir com o limite anotado, parar). Nunca some em silêncio.
- O vendedor manda material novo no meio → entra em `acesso.md` com data; fases já feitas são revistas só no que o material muda.
- Revisão ou auditoria paradas → a fase fica `feita` com o limite registrado em **Não visto**, ou a avaliação para; nunca `feita` em silêncio.
