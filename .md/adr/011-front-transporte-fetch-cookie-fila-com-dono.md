# ADR-011: Front: transporte fetch + cookie, fila offline com o dono da sessão

- **Status:** Proposto em 2026-10-25 (etapa 11, lote 1)
- **Data:** 2026-10-25
- **Decisores:** Leandro (stakeholder)
- **Detalha:** RN-20 do `PRD-TECNICO.md`; SDD 5.2, 7, 9.1, 9.2 e 9.3; GUARDRAILS G-18, G-21, G-35, G-36, G-37, G-38 e G-39; THREAT-MODEL TM-NAV-03 e TM-NAV-04; ADR-006 e ADR-010; decisão P5 de `ANALISE-MYMONEY.md`
- **Substitui (no legado):** a camada `dados/` sobre o `supabase-js` (cliente, sessão do Auth e RPC) e o dono da fila vindo de `user.id` do Supabase

## Contexto

- O legado falava com o Supabase: o `supabase-js` guardava o JWT no navegador, renovava o token e dizia ao front quem era o usuário. Aqui a sessão é um cookie `__Host-sid` `HttpOnly` (ADR-006): o front não o lê e "estou logado?" só se sabe perguntando à API.
- A fila offline (RNF-02) guarda lançamentos de despesa no aparelho e os envia depois. A decisão P5 pede que, se a sessão expirar e outra pessoa entrar no mesmo aparelho, os itens da primeira não sejam enviados nem mostrados à segunda. No legado o dono já existia no item, mas vinha do `supabase-js`.
- O Worker serve o front e a API na mesma origem. A API é protegida contra CSRF por cabeçalho (`X-Controle-Em-Casa: 1` e `Origin`; G-21).
- O app passa a viver em `/app/*`; `/`, `/entrar`, `/cadastro` e as páginas legais são públicas. O service worker do legado (`generateSW`) não serve: as notificações push da etapa 15 exigem handlers escritos à mão.

## Decisão

1. **Um só módulo faz `fetch`: `dados/transporte.ts`.** `chamar(metodo, rota, corpo?, opcoes?)` usa `credentials: 'same-origin'` (o cookie vai sozinho), `Accept` e `Content-Type` JSON, `cache: 'no-store'`, `AbortController` de 10 s e o cabeçalho `X-Controle-Em-Casa: 1` em toda escrita. O `Origin` é do navegador: o código nunca o define. Só rotas que começam com `/api/` são aceitas. O ESLint proíbe `fetch` fora de `dados/` e `idb-keyval` fora de `dados/`.
2. **Erros por `code`.** `dados/erros.ts` converte a resposta em `ErroDados`: 401 ou `sessao_expirada` viram `autenticacao`; um `code` do contrato vira `regra` (inclusive `muitas_requisicoes` e `muitas_tentativas`, que têm texto próprio); 429 sem código reconhecido e 5xx viram `indisponivel`; falha antes de haver resposta (rede, prazo de 10 s) vira `rede`; o resto, `desconhecido`. A tela mostra só o texto de `rotulos/erros.ts`, nunca a `message` do servidor. A lista de códigos de execução fica em `comum/erros.ts`, e um teste confere que ela é igual à união das listas do contrato.
3. **Validação do contrato só em dev e teste.** Cada chamada pode nomear um schema `saida.*`; a conferência roda quando `import.meta.env.MODE !== 'production'`, com `import('@controle/contrato')` de string literal (G-37). O build de produção descarta esse ramo e não leva o Zod; um teste do build procura `ZodError` nos chunks.
4. **Sessão sempre por `GET /api/sessao`.** `obterSessao()` devolve a sessão, `null` em 401 ou lança `rede`. O estado na tela é a consulta `['sessao']` do TanStack Query. Sem rede, com um usuário lembrado neste aparelho, a sessão é **presumida**: o app abre para lançar offline, mas a fila só envia depois que o servidor confirmar a sessão.
5. **Dono lembrado.** Cada resposta de `GET /api/sessao` grava o `usuario.id` (memória e `localStorage`). Ele é o dono dos itens que a fila guarda sem rede. Um 401 em `GET /api/sessao`, sair, sair de todos e redefinir senha apagam esse valor. O `usuario.id` não é segredo: sem o cookie ele não dá acesso a nada.
6. **Fila com dono (G-38).** O item guarda `dono`, `args` (o corpo de `POST /api/lancamentos/despesas`, com o `id` do cliente, ADR-010), `exibicao`, `criadoEm`, `situacao` e `motivo`. O dono nunca é parâmetro de quem chama nem sai no corpo enviado. Listar, descartar e reativar falhas só enxergam os itens do dono lembrado. **Enviar** exige o dono **confirmado agora** por `GET /api/sessao`: sem rede, sem sessão ou com outro usuário, nada é enviado e nada é tocado. Os itens de outro usuário ficam retidos e invisíveis até ele voltar; o servidor ainda ignora qualquer dono vindo do cliente (G-26). Uma rodada por vez, entre abas, com `navigator.locks`; teto de 200 itens por dono.
7. **Limpeza do aparelho (G-39).** `dados/aparelho.ts` guarda as limpezas registradas pelos módulos que gravam algo local. Ao sair, sair de todos, redefinir a senha ou receber 401 de sessão perdida, o front esvazia o cache do TanStack Query, roda essas limpezas e leva a `/entrar?volta=`. A fila não se registra: ela se isola pelo dono. A remoção da `push_subscription` se registra na etapa 15.
8. **Service worker `injectManifest` (G-39).** `pwa/sw.ts` faz o precache, registra `NetworkOnly` para `/api/*` antes de qualquer outra rota e usa `NavigationRoute` com o `index.html`, allowlist `^/app` e denylist `^/api`. Não há `runtimeCaching` nem estratégia de cache. O manifest tem `start_url` e `scope` em `/app/`, e o registro do SW também. As regras de roteamento ficam em `pwa/configuracaoSw.ts`, sem dependências, para serem testadas.
9. **Rotas e guardas (SDD 9.3).** Sem sessão, `/app/*` leva a `/entrar?volta=<caminho+consulta>`; com sessão, `/entrar` leva a `/app` (ou ao `volta`); `termos_pendentes` leva ao aceite; sessão sem lar leva a `/app/bem-vindo`. O `volta` só vale se começar com `/app` e não tiver `//`, barra invertida nem caractere de controle (sem redirecionamento aberto). `/redefinir-senha` e `/confirmar` abrem mesmo com sessão, para o link com token nunca se perder. O token chega no fragmento (`#t=`), é lido na primeira renderização e removido do endereço logo depois (G-18).
10. **Fronteiras de camada no ESLint** (`eslint.config.mjs`): `paginas` importa `componentes`, `ganchos`, `formatacao`, `rotulos` e `comum`; `componentes`, `formatacao`, `rotulos` e `comum` não chegam a `dados`; `ganchos` importa `dados`; `dados` importa só `comum` e `configuracao`; `componentes/base` não importa o resto de `componentes`. Mais G-36 (sem `dangerouslySetInnerHTML`, `innerHTML` nem `document.write`) e G-37 (sem `eval`, `new Function`, `setTimeout` com texto nem `import()` com expressão). Um teste roda o ESLint sobre código de violação para cada regra.

## Consequências

**Positivas**
- O token da sessão nunca passa pelo JavaScript: não há como roubá-lo por XSS, e o front não guarda credencial nenhuma.
- Aparelho compartilhado: os lançamentos de quem saiu não vão para a conta de quem entrou, e voltam sem duplicar quando o dono entra de novo (o `id` do cliente torna o reenvio idempotente, ADR-010).
- Os erros mostrados são sempre textos do front; nenhuma mensagem do servidor chega à tela.
- O bundle de produção não carrega o Zod do contrato.

**Negativas**
- Cada rodada da fila custa um `GET /api/sessao` antes de enviar.
- O dono lembrado pode estar velho enquanto o aparelho está sem rede: A lança offline com a sessão já expirada, e o item continua sendo de A. Isso é o desejado (P5), mas a pessoa só descobre que a sessão expirou quando a rede volta.
- Itens de um usuário que nunca voltar ficam no IndexedDB do aparelho. Não há expiração automática; a limpeza é manual, nas ferramentas do navegador. Se virar problema, uma purga por idade entra por decisão do usuário.
- `localStorage` guarda o `usuario.id`: dado pessoal mínimo, apagado ao sair.
- Sem rede, o app presume a sessão a partir do dono lembrado; uma tela que dependa do servidor mostrará o erro de rede.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Guardar um JWT ou o token da sessão no `localStorage` para o front "saber" quem é | Exposto a XSS; contraria ADR-006 e G-15 (cookie `HttpOnly`) |
| `axios`, `ky` ou outro cliente HTTP | Mais uma dependência para o que cabe em uma função de 60 linhas; o `fetch` nativo já tem `AbortController` e `credentials` |
| Fila sem dono, esvaziada ao sair | Perde lançamentos feitos offline quando a sessão expira (P5 pede o contrário) |
| Pedir `GET /api/sessao` a cada leitura da fila | Quebraria o "lançar sem rede" (o dono precisa existir sem rede) |
| Enviar a fila com o dono lembrado, sem confirmar no servidor | Um 401 no meio do lote só aparece no primeiro item, mas outro usuário logado no aparelho poderia receber os itens de quem saiu |
| `generateSW` do Workbox com `runtimeCaching` para a API | A API não pode ficar em cache (G-39, dados financeiros), e o push da etapa 15 precisa de handlers próprios |
| Validar toda resposta com o Zod também em produção | CPU e bytes no celular para algo que só serve para pegar defeito de contrato em desenvolvimento |
