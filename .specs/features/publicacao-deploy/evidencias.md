# Evidências — 17c (primeiro deploy e medições)

Sem segredo: só links, nomes e resultados.

## T1 — Push com a suíte verde (2026-10-28)

- Trava de testes (`trava-testes.py --rodar`) verde no `725ab5c`. A primeira rodada reprovou `fixas-isolamento.test.ts` (erro não capturado; o arquivo passa isolado, 9 de 9); a segunda, com a saída gravada, ficou verde.
- Push da `main` com confirmação do usuário: `9303d12..a3edf15`, depois `a3edf15..725ab5c`.
- `ci` do `a3edf15` falhou (execução 40726482091), duas causas, ambas corrigidas:
  - `e2e-pilha`: o `routes` com `custom_domain` (17a) fazia o `wrangler dev` usar o domínio de produção como host e o CSRF recusava cadastro e login locais. Provado comentando a `routes` (2 e2e passaram). Correção: `--local-upstream localhost:<porta>` no `frontend/web/e2e-pilha/global.ts` (`6f4cf81`). O `ci` já falhava assim desde o `9303d12`.
  - `banco`: `lancamentos-consultas.test.ts` (CA-02.1) procurava a substring `'777'` e um UUID aleatório a continha. Alteração aprovada pelo usuário: busca o `777` como valor JSON (`/[:,[]777[,}\]]/`), mesma afirmação (`725ab5c`).
- `ci` do `725ab5c` **verde** nos 5 jobs (e2e-pilha, e2e-web, base, banco, gitleaks): https://github.com/leandrosegheto17/ControleEmCasa_LJS/actions/runs/40734763157
