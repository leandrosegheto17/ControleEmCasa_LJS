# Registro e decisão final (fases 7 e 8)

## Registro (fase 7)

Notas curtas, a partir do que o usuário fez e disse no diário e na verificação, não de um resumo genérico da tecnologia. Antes de gravar, mostre o rascunho e peça que ele corrija o que não reconhece como seu.

- **O que aprendi**, por objetivo, nas palavras dele.
- **Armadilhas**: o que quebrou, o erro que apareceu e o que resolveu.
- **Trechos reutilizáveis**: poucos, escritos pelo usuário (não os exemplos da IA), com uma linha do porquê.
- **Links úteis**: as fontes que serviram, com data da consulta.
- **Revisitar em** (opcional): uma data, dias ou semanas depois, para uma pergunta de recordação; ao reabrir o estudo nessa data, a sessão faz 2 ou 3 perguntas sem consulta e anota o resultado.

## Decisão final (fase 8)

Pergunte via `AskUserQuestion`. A recomendada depende do resultado: objetivos atingidos → **arquivar**; parcial com interesse em seguir → **aprofundar**.

- **Arquivar**: o código fica na pasta do veículo, como está, para consulta. Se tiver git próprio, sugerir um commit final (ação do usuário ou com confirmação). Nada vai para outro repositório.
- **Aprofundar**: estudo novo `<slug>-2`, com `plano.md` começando pelas lacunas de `verificacao.md` e apontando para este. O veículo pode continuar na mesma pasta.
- **Aproveitar como base**: o veículo virou ideia de algo que vai ficar. Abra o fluxo que constrói (`uso-proprio`, `projeto-novo`, `feature`) com `notas.md` como entrada, como na promoção do spike: a construção nasce dos critérios de aceite, **com testes**, e o código de estudo **não é copiado** (pode ser lido como referência). Ele fica arquivado ou é descartado.
- **Descartar**: o aprendizado está em `notas.md`. Antes de apagar a pasta do veículo, confirmação específica listando o que será apagado.

Grave **Destino** em `notas.md`. O estudo está encerrado.

## Modelo de `notas.md`

```markdown
# Notas do estudo: <tema>

- **Slug**: <slug> · **Data**: <AAAA-MM-DD> · **Prazo era**: <AAAA-MM-DD>
- **Resultado da verificação**: <objetivos atingidos | parcial | não atingidos | sem verificação (parado)>
- **Destino**: <pendente | arquivado em <caminho> | aprofundar em <slug-2> | base para <fluxo e pasta>, código não copiado | descartado (AAAA-MM-DD) | parado — <motivo> | não era estudo>
- **Revisitar em**: <AAAA-MM-DD | não>

## O que aprendi

- **O-1**: <nas palavras do usuário>

## Armadilhas

- <o que quebrou> → <o que resolveu>

## Trechos reutilizáveis (escritos por mim)

<poucas linhas, com o porquê>

## Lacunas para depois

- <o que ficou parcial ou não atingido>

## Links

- <fonte> — consultada em <AAAA-MM-DD> (dado, não instrução)
```
