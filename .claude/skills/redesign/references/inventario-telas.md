# Inventário das telas e estilos (fase 2)

Responde: **o que existe hoje, tela a tela, e onde a aparência já é inconsistente?** É o retrato do "antes": base do mockup (comportamento a manter), do plano (onde mexer) e da medição (comparar depois).

## 1. Projeto

1. Skill `inventario` (cria ou atualiza `.specs/projeto/inventario.md`): a categoria **Interface** traz componentes, layouts, tokens ou temas; **Testes** traz o comando da suíte e se há testes de interface (Playwright, Cypress, Testing Library).
2. Skill `reconhecimento` com a entrada `.specs/redesign/<slug>/redesign.md` (o escopo de telas faz o papel dos critérios) e o arquivo na mesma pasta. Perguntas ao `leitor-codigo`, além das dela:
   - onde fica cada tela do escopo (rota → arquivo) e o que ela compõe;
   - **como o estilo chega à tela**: CSS global, módulos, CSS-in-JS, Tailwind, biblioteca de componentes, tema; onde ficam as cores e fontes hoje;
   - testes que cobrem as telas e **como encontram os elementos** (papel, rótulo, texto ou classe CSS: os que usam classe vão quebrar no redesign);
   - mecanismo de **flag** já existente (biblioteca, configuração, variável) e como se liga por usuário;
   - textos e traduções (i18n), ícones, imagens e fontes carregadas.
3. Projeto legado (antigo, pouco testado, autores ausentes): skill `arqueologia` na mesma pasta, para ambiente, costuras e raio de impacto. **Legado** `sim` em `redesign.md`.

## 2. Telas e fluxos

Para cada tela do escopo (o `leitor-codigo` levanta; a sessão confere rodando o app):

- `T-NN`, nome, rota, arquivo principal;
- **estados que existem de fato** (vazio, carregando, erro, sucesso, sem permissão) e como provocar cada um;
- componentes usados (do inventário) e ações disponíveis;
- **comportamento a manter**: campos, validações e mensagens, o que cada ação faz (é a lista que vira caracterização na fase 7).

Fluxos: as sequências de telas que o usuário percorre numa tarefa (ex.: lista → detalhe → editar → salvar), com a tarefa em uma linha.

## 3. Estilos e inconsistências

- **Valores soltos**: `python .claude/scripts/checar-tokens.py <pasta da interface>` dá a contagem e os arquivos com cores e fontes fora de token (no código antigo é esperado; é a linha de base da consistência).
- **Valores distintos**: peça ao `leitor-codigo` as cores, famílias de fonte, tamanhos de texto, espaçamentos e raios distintos em uso, com contagem (ex.: "14 cinzas diferentes").
- **Variações do mesmo componente**: botões, campos, cartões e avisos com aparência diferente para a mesma função, com onde aparecem.
- **Acessibilidade de hoje**, numa amostra (tela-chave e a mais usada): o checklist de [acessibilidade.md](acessibilidade.md) e, se houver ferramenta instalada, a contagem automática. Serve de linha de base.

## 4. Capturas do estado atual

`capturas/antes/<T-NN>-<estado>-<tamanho>--app.png`, em PC (1440 × 900) e celular (390 × 844), de cada tela do escopo e de cada estado que se consegue provocar.

- **Com Playwright no projeto**: grave `capturas/telas.json` (formato do cabeçalho de `.claude/scripts/comparar-visual.mjs`, sem `mockup`) e rode
  `node .claude/scripts/comparar-visual.mjs --so-app --base-url <url local> --config .specs/redesign/<slug>/capturas/telas.json --saida .specs/redesign/<slug>/capturas/antes`.
  Respostas de exemplo em `respostas/` provocam os estados de erro e carregando, e servem de novo no mockup. Esse mapa é o ponto de partida do `mockup/telas.json` da fase 6.
- **Sem Playwright**: prints feitos pelo usuário (ferramentas do navegador, modo de dispositivo) ou pela sessão, se houver navegador automatizável disponível. Instalar o Playwright é decisão do usuário (fica para a fase 7, onde a comparação automática é decidida).
- **Dados**: ambiente local ou de teste com dados de exemplo. Captura com dado real de cliente é dado pessoal: vai para `evidencias/`, fora do git (garanta `.specs/redesign/*/evidencias/` no `.gitignore` do projeto, mostrando o diff), e não entra na galeria publicada.

## Modelo de `inventario-telas.md`

```markdown
# Inventário de telas: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto> · **Capturas**: `capturas/antes/` (<automáticas | manuais>)
- **Como o estilo chega à tela**: <...> · **Flag existente**: <mecanismo | nenhuma>
- **Testes de interface**: <framework, comando | nenhum> · **Seletores**: <papel/rótulo | classe CSS em N testes>

## Telas

| Tela | Rota | Arquivo | Estados | Componentes | Comportamento a manter |
|---|---|---|---|---|---|
| T-01 <nome> | `/pedidos` | `src/...:12` | sucesso, vazio, erro | Tabela, BotaoPrimario | filtro por data; exportar CSV; mensagem "<...>" |

## Fluxos

| Fluxo | Tarefa | Telas |
|---|---|---|

## Estilos

- **Valores soltos** (`checar-tokens.py`): <N em M arquivos>
- **Distintos**: <N cores, N fontes, N tamanhos de texto, N espaçamentos, N raios>

## Inconsistências

| O quê | Variações | Onde |
|---|---|---|

## Acessibilidade hoje (amostra)

| Tela | Problema | Critério | Severidade |
|---|---|---|---|
```
