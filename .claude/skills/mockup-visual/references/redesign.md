# Modo redesign

Vale quando a skill `redesign` (fluxo 7) aciona esta skill. O resto do `SKILL.md` e de [estrutura.md](estrutura.md) continua valendo; aqui ficam só as diferenças. Os pré-requisitos do projeto novo (`spec.md`, `design.md`) não se aplicam: as entradas são os artefatos do redesign.

## Pasta

```
.specs/redesign/<slug>/mockup/
  direcoes/               etapa 1 (mesma estrutura de estrutura.md)
  tokens.css  guia.html   etapa 2a
  telas/<tela>--<estado>.html   etapa 2b: todas as telas do escopo, um arquivo por estado
  telas.json              etapa 2b: mapa para a comparação automática
  index.html              galeria e protótipo navegável
  comparacao/<data>/      etapa 3
```

`.specs/mockup/` (se existir) é a referência da interface **atual** e não é tocado durante o redesign. A troca acontece no fim, na fase 10 do redesign.

## Entradas

- `redesign.md` (meta, o que não muda, escopo de telas, nível de acessibilidade), `inventario-telas.md` e as capturas de `capturas/antes/`, `pesquisa.md` (problemas `P-NN` priorizados).
- Na etapa 2a, também `sistema.md` (regras de uso e mapa de componentes) e a seção de requisitos de `acessibilidade.md`, ambos da pasta do redesign.

## Etapa 1: direções

- **Tela-chave:** a que concentra os problemas de maior prioridade de `pesquisa.md` (diga quais `P-NN` ela cobre).
- Mesmos dados de exemplo da captura atual, para comparar só a aparência.
- Na galeria, a **tela de hoje** (captura) aparece primeiro, ao lado das direções; cada direção diz que problemas `P-NN` ela ataca e como.
- Identidade imposta (manual da marca do cliente): a etapa vira uma direção só, dentro do manual, e a fase 4 do redesign pode ser dispensada com esse motivo.

## Etapa 2a: guia de estilo (fase 5 do redesign)

Como a etapa 2 de sempre, **sem as telas-chave**, mais:

- Componentes do guia com nomes que o mapa de `sistema.md` usa (componente antigo → componente do guia).
- Estados de interação de cada componente (normal, foco, ativo, desabilitado, erro) e o **foco visível** desenhado.
- Regras de uso no próprio `guia.html` (quando usar cada variação, o que não fazer), curtas.
- Tabela de contraste completa e o checklist de acessibilidade do guia (requisitos de `acessibilidade.md`).

Publique e pare para aprovação.

## Etapa 2b: todas as telas (fase 6 do redesign)

1. **Uma página por tela e estado** do escopo de `redesign.md`: `telas/<tela>--sucesso.html`, `--vazio`, `--carregando`, `--erro` (só os estados que a tela tem; formulário ganha também `--erro-validacao` quando houver). A mesma página vale para PC e celular.
2. **Navegável:** links e botões levam às outras telas do mockup como no app (o `index.html` abre na tela inicial e lista todas as telas e estados). Sem script de terceiros; script próprio, se precisar, só para alternar estado.
3. **Comportamento igual ao de hoje:** os mesmos campos, ações, validações e mensagens de regra da captura atual. Mudança de fluxo de navegação só se o `redesign.md` a puser no escopo; mudança de regra nunca (é feature).
4. **Dados de exemplo** iguais aos que a comparação vai usar: se a tela busca dados de uma API, guarde as respostas de exemplo em `respostas/<nome>.json` e monte a página com esses mesmos valores.
5. **`telas.json`** no formato do cabeçalho de `.claude/scripts/comparar-visual.mjs`: uma entrada por tela e estado, com `rota` do app, `mockup`, `viewports`, `respostas` (inclusive `status: 500` para erro e `pendente: true` para carregando) e `ocultar` para conteúdo variável (data, hora). Confira com `node .claude/scripts/comparar-visual.mjs --listar --config <pasta>/telas.json`.
6. Checklist de [estrutura.md](estrutura.md) e o de acessibilidade em **cada** tela antes de publicar.

**Muitas telas** (mais de ~6): desenhe primeiro as do fluxo principal; as demais podem ir ao agente `implementador` em lotes, com `tokens.css`, `guia.html`, uma tela pronta como modelo, a captura atual e o critério "só classes do guia e `var(--...)`". Confira cada uma pelo checklist antes de publicar; quem desenhou não aprova.

Publique a galeria (agora também protótipo) e pare para aprovação. Aprovado, o mockup é a **fonte de verdade** do redesign.

## Etapa 3: comparação (fases 8 e 9 do redesign)

Com o app rodando localmente e a interface nova ligada (bloco `flag` do `telas.json`):

```
node .claude/scripts/comparar-visual.mjs --base-url <url local> --config .specs/redesign/<slug>/mockup/telas.json --tela <ids da etapa> [--pacote <pasta da interface>]
```

O resumo (`comparacao/<data>/resumo.md`) entra na galeria como seção "Mockup × app". Limite de diferença por tela vem de `migracao.md` (campo `limite` no `telas.json`). Acima do limite: corrige-se o código, ou o usuário aceita a diferença, que fica registrada. Sem Playwright no projeto, a etapa 3 de sempre (prints lado a lado e o olhar do usuário).
