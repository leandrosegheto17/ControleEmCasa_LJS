# Acessibilidade (fases 2, 5, 6 e 9)

Acessibilidade é **requisito desde o mockup**, não revisão no fim: o requisito nasce no guia e nas telas, e a verificação confere o código. Nível padrão: **WCAG 2.2 AA**, declarado em `redesign.md` (outro nível só com fonte).

## Requisitos (checklist por tela)

Organizado pelos quatro princípios da WCAG: perceptível, operável, compreensível, robusto.

**Perceptível**
- [ ] Contraste: texto normal ≥ 4,5:1; texto grande (≥ 24 px, ou ≥ 18,5 px em negrito) ≥ 3:1; contorno de controle, ícone que informa e foco ≥ 3:1 (1.4.3, 1.4.11).
- [ ] Cor nunca é a única pista: erro tem ícone ou texto; link se distingue sem cor (1.4.1).
- [ ] Imagem que informa tem texto alternativo; decorativa tem `alt=""`; ícone com função tem nome acessível (1.1.1).
- [ ] Estrutura no código: títulos `h1`–`h6` em ordem, listas, tabelas com cabeçalho, campos com `label` (1.3.1); ordem de leitura igual à visual (1.3.2).
- [ ] Zoom de 200% sem perder conteúdo; largura de 320 px sem rolagem horizontal (1.4.4, 1.4.10); espaçamento de texto aumentado não corta nada (1.4.12).
- [ ] Conteúdo que aparece no foco ou ao passar o mouse pode ser fechado e não some sozinho (1.4.13).

**Operável**
- [ ] Toda ação funciona só com teclado, em ordem lógica, sem armadilha; janela modal prende o foco enquanto aberta e devolve ao fechar (2.1.1, 2.1.2, 2.4.3).
- [ ] Foco **sempre visível** e não encoberto por cabeçalho fixo ou aviso (2.4.7, 2.4.11).
- [ ] Atalho para pular ao conteúdo e regiões (`header`, `nav`, `main`) (2.4.1); título de página único e descritivo (2.4.2).
- [ ] Texto de link e botão diz o destino ou a ação, sem "clique aqui" (2.4.4, 2.4.6).
- [ ] Alvo de toque ≥ 24 × 24 px (2.5.8); no nosso padrão de celular, 44 px. Ação de arrastar tem alternativa de clique (2.5.7).
- [ ] Animação respeita `prefers-reduced-motion`; nada pisca mais de 3 vezes por segundo (2.3.1); movimento automático pode ser pausado (2.2.2).
- [ ] Tempo limite (sessão) avisa e pode ser estendido (2.2.1).

**Compreensível**
- [ ] `lang` da página certo (`pt-BR`) (3.1.1).
- [ ] Foco ou digitação não mudam a página de surpresa; nada envia sozinho (3.2.1, 3.2.2).
- [ ] Navegação e nomes iguais em todas as telas (3.2.3, 3.2.4); ajuda no mesmo lugar (3.2.6).
- [ ] Formulário: rótulo visível, obrigatório indicado, formato explicado antes; erro identificado em texto, ligado ao campo e dizendo como corrigir (3.3.1, 3.3.2, 3.3.3); operação financeira ou legal revisável ou reversível (3.3.4); não pedir de novo o que já foi informado (3.3.7); login sem teste de memória obrigatório (3.3.8).

**Robusto**
- [ ] Controles próprios com nome, papel e estado (`aria-*` só quando o elemento nativo não serve: `<button>` antes de `div role="button"`) (4.1.2).
- [ ] Mensagens de status e de erro anunciadas ao leitor de tela (`role="status"`, `role="alert"`) sem mover o foco (4.1.3).
- [ ] IDs únicos; HTML válido.

Mídia (vídeo, áudio), quando houver: legendas e transcrição (1.2).

## Severidade

| Severidade | Exemplos | Efeito |
|---|---|---|
| **Crítica** | ação impossível só com teclado; campo sem rótulo; botão de ícone sem nome; armadilha de foco; texto principal sem contraste; erro só em cor | bloqueia a aprovação do guia e da tela, e a integração da etapa |
| **Séria** | foco pouco visível; falta de atalho para o conteúdo; título de página ausente; componente próprio sem estado anunciado; rolagem horizontal em 320 px | bloqueia a liberação, salvo aceite do usuário registrado com prazo |
| **Moderada** | hierarquia de títulos com salto; texto de link vago; região sem nome | vira tarefa; não bloqueia |

## Como verificar

- **No mockup** (fases 5 e 6): o checklist em cada tela, pela sessão; contraste calculado na tabela do guia.
- **Automático** (fase 9, e no CI depois da etapa 1): a ferramenta que o projeto tiver — `@axe-core/playwright` num teste por tela com a flag ligada (padrão recomendado: vira teste da suíte), `pa11y` ou Lighthouse acessibilidade. Instalar é decisão do usuário. A automática acha só uma parte dos problemas (algo entre um terço e metade, `PREMISSA`); nunca substitui a manual.
- **Manual** (fase 9, por etapa), pelo usuário ou pela sessão com navegador automatizável:
  - percorrer cada tela só com `Tab`, `Shift+Tab`, `Enter`, `Espaço`, `Esc` e setas;
  - leitor de tela no fluxo principal: NVDA (Windows), VoiceOver (Mac e iPhone) ou TalkBack (Android) — títulos, campos, botões e erros anunciados com sentido;
  - zoom de 200%, largura de 320 px, `prefers-reduced-motion` ligado, modo de alto contraste do Windows.

## Modelo de `acessibilidade.md`

```markdown
# Acessibilidade: <slug>

- **Nível**: <WCAG 2.2 AA (padrão) | ...> · **Ferramenta automática**: <nome e versão | nenhuma>

## Requisitos aplicados ao guia (fase 5)

- <requisito> — <como o guia atende>

## Linha de base (fase 2)

| Tela | Problema | Critério | Severidade |
|---|---|---|---|

## Auditoria — etapa <N> (<AAAA-MM-DD>)

| Tela | Critério | Situação | Severidade | Evidência | Correção |
|---|---|---|---|---|---|
| T-03 | 2.1.1 teclado | atende | — | `tests/a11y/pedidos.spec.ts:20`; percorrido com Tab | — |

- **Automático**: <N violações (por severidade) | sem ferramenta>
- **Manual**: <teclado, leitor de tela (qual), zoom, 320 px, movimento — quem fez e quando>
```
