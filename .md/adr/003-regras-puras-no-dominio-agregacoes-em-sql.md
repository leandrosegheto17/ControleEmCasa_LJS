# ADR-003: Regras pequenas e puras em `backend/dominio`; agregações como consultas SQL via Kysely

- **Status:** Aceito em 2026-10-24 (etapa 0 aprovada; antes: Proposto)
- **Data:** 2026-10-24
- **Decisores:** Leandro (stakeholder)
- **Substitui (no legado):** o ADR-003 do MyMoney (regras de negócio em funções SQL expostas como RPC)

## Contexto

- No MyMoney, toda regra vivia em 36 funções SQL `api.*` e cerca de 50 auxiliares `app.*`, expostas pelo PostgREST.
- O Padrão LJS pede `backend/dominio` com regras puras, sem I/O e 100% testáveis, e a API Hono como único acesso ao banco.
- **Limite de CPU:** o Workers Free dá **10 ms de CPU por requisição**. Esperar a rede ou o banco não conta.
  - O `resumo_mes` do legado leva cerca de 290 ms **no banco**, com 5.990 parcelas. Isso é latência, não CPU do Worker.
  - Trazer milhares de parcelas para o Worker, validar com Zod e somar em TypeScript poderia passar de 10 ms.
- O legado tem 1.812 testes pgTAP que descrevem o comportamento. Eles precisam reaparecer como testes do app novo.

## Decisão

1. **Em `backend/dominio`** ficam as funções puras, com testes Vitest portados dos casos pgTAP:
   - `hoje` e competência em America/Sao_Paulo; o dia no mês, com último dia quando o dia não existe;
   - geração e cálculo de parcelas, com o resto na 1ª parcela (RN-14), e o dia de vencimento congelado;
   - permissões de edição por campo (RN-06/07);
   - situação do orçamento (limiares de 80% e 100%);
   - progresso da meta (falta, percentual limitado a 99, mensal necessário);
   - distribuição do `pago_por_membro` (o último fecha 100%);
   - meses em que uma fixa gera ocorrência; validações de valores e textos.
2. **Em SQL via Kysely, dentro do repositório da API**, ficam as **agregações e consultas sobre muitas linhas**: totais do resumo do mês, realizado do orçamento, saldo de conta, gasto do cartão, guardado da meta, lista do mês com filtros.
   - O Worker recebe só linhas já agregadas.
   - Essas consultas têm testes de integração com Postgres real.
3. **Sem funções de regra no banco:** nada de `CREATE FUNCTION` com regra de negócio e nada de `SECURITY DEFINER`.
   - O banco guarda só integridade: FKs compostas, `CHECK`, índices únicos e RLS.
   - Também guarda funções técnicas mínimas, como a leitura do GUC para a RLS.
4. **Orçamento de CPU:**
   - Toda rota de leitura pesada (resumo, lista do mês, orçamento) é medida no `wrangler dev` com a massa de 2 anos, na etapa 9.
   - Se passar de 10 ms, mais cálculo vai para o SQL antes de seguir.

## Consequências

**Positivas**
- O domínio fica testável sem banco (rápido) e as agregações rodam onde é barato (no banco).
- As regras ficam em TypeScript, com o mesmo contrato Zod do front.
- Segue o padrão sem estourar o limite de CPU.

**Negativas**
- A regra fica dividida em dois lugares (`dominio` e as consultas SQL). Mitigação: o PRD-TECNICO indica, para cada RN, onde ela vive; o teste de integração cobre a consulta.
- Portar 1.812 testes pgTAP exige critério. Porta-se **por regra**, não por arquivo, e a matriz fica no PRD-TECNICO.
- Sem `SECURITY DEFINER`, operações que cruzam a privacidade são feitas pela API com a identidade da sessão e respeitam a RLS. É o caso da edição de uma despesa conjunta pelo outro membro, que mexe na `data_operacao` privada do pagador. Pode exigir políticas RLS específicas, desenhadas no SDD.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Manter as funções SQL do legado e só expô-las pela API | Contraria o padrão (`dominio` puro) e leva o `SECURITY DEFINER` e a dependência de `auth.*` |
| Toda regra e agregação em TypeScript | Risco real de estourar 10 ms de CPU no resumo do mês |
| Workers Paid para ter mais CPU | Viola o custo zero |
