# Liberação e monitoramento (fases 8 e 9)

## Liberação (fase 8): o que levar à skill `liberacao`

A skill `liberacao` monta o plano, pausa antes de produção e registra em `.specs/liberacao.md`. Acrescente ao plano:

| Item | O que decidir |
|---|---|
| **Chaves de produção** | Criadas pelo usuário no painel do fornecedor, com o escopo mínimo de `seguranca-legal.md`, e cadastradas por ele no cofre ou nas variáveis do ambiente de produção. Nunca passam pela conversa nem por artefato. A sessão só confere que a variável existe (pelo nome). |
| **Webhook de produção** | Endereço cadastrado no painel pelo usuário (ação externa), com o segredo de produção; teste de assinatura antes de abrir o tráfego. |
| **Flag** | Começa desligada em produção; desligar leva ao caminho de degradação. **Reversão testada** = desligar a flag em staging (ou produção com alcance zero) e ver a degradação. |
| **Alcance** | Primeiro um grupo interno ou uma porcentagem pequena; sem sandbox ou com sandbox diferente de produção, começar pela menor operação real possível (ex.: cobrança de valor mínimo e estorno), cada uma com confirmação específica. |
| **Critério de parada** | Taxa de erro do fornecedor acima de <X%>, latência p95 acima de <T>, disjuntor abrindo, divergência na reconciliação, custo por operação acima do esperado. |
| **Volta** | Desligar a flag; o que ficou pendente (fila, cobranças em andamento) e como reconciliar depois. |

Ferramenta pessoal (fluxo 2): skill `implantacao`, com as chaves em variável de ambiente fora do repositório e o mesmo desligamento.

## Monitoramento (fase 9)

Responde: **percebo quando o terceiro falha ou muda?** Usa a observabilidade que o projeto já tem; instalar ferramenta ou contratar serviço é decisão do usuário.

### Métricas e alertas

| Sinal | Métrica | Alerta (exemplo) |
|---|---|---|
| Erro | taxa por tipo (transitório, definitivo, recusa de negócio), por operação | transitório acima de X% em 5 min |
| Latência | p50, p95, p99 por operação | p95 acima do tempo limite × 0,8 |
| Disjuntor | estado e quantas vezes abriu | abriu |
| Fila | tamanho, idade da mensagem mais antiga, fila de mortos | mensagem com mais de N min; qualquer item na fila de mortos |
| Webhooks | recebidos, rejeitados por assinatura, duplicados | rejeições acima do normal (pode ser ataque ou troca de segredo) |
| Reconciliação | divergências por execução | qualquer divergência em dinheiro ou acesso |
| Custo e cota | chamadas pagas, gasto do período, uso da cota | 80% do teto ou da cota |

- **Alerta acionável**: cada um diz o que olhar e o que fazer (link para o runbook), e vai para quem vai agir.
- **Disparo testado**: provoque cada alerta uma vez (simulado em staging, flag, limiar temporário) e registre a data. Alerta nunca disparado não conta.
- Painel do fornecedor (status, uso, faturas) entra como fonte complementar, não como o único alarme.

### Mudanças do fornecedor

- **Versão fixada** da API e data de fim de suporte dela, se publicada.
- **Canal de avisos** assinado por alguém que age: changelog ou RSS, e-mail de depreciação da conta, página de status. Quem recebe e com que frequência olha.
- **Revisão periódica** (sugestão: trimestral, ou na data de fim da versão): um `pesquisador` confere changelog, preços e termos desde a última consulta; mudança relevante abre integração nova pelo contrato (laço em `fases.md`).
- **Checagem de contrato agendada** (opcional): os testes de sandbox rodando no CI de tempos em tempos, para perceber mudança silenciosa. Exige a chave de sandbox nos segredos do CI (ação externa, aprovação do usuário).

### Chaves e runbook

- **Rotação** com data marcada e responsável; procedimento de `seguranca-legal.md`.
- **`.specs/runbook.md`** ganha a entrada do fornecedor: como saber se o problema é dele (página de status, taxa de erro), como desligar (flag), o que fica pendente e como reconciliar, contato do suporte, como ele avisa incidente com dados pessoais. Formato do runbook da skill `incidente`.
- **Contexto do projeto e inventário**: a integração entra no `inventario.md` (seção de integrações) e o contexto aponta para o adaptador e para o runbook.

## Modelo de `monitoramento.md`

```markdown
# Monitoramento: <fornecedor> — <caso de uso>

- **Data**: <AAAA-MM-DD> · **Liberação**: `.specs/liberacao.md` (<data>) · **Alcance atual**: <...>

## Alertas

| Sinal | Métrica | Limiar | Vai para | Disparo testado |
|---|---|---|---|---|

## Mudanças do fornecedor

- **Versão fixada**: <versão> · **Fim de suporte**: <data | não publicado>
- **Canal**: <onde> · **Quem acompanha**: <pessoa ou papel> · **Próxima revisão**: <AAAA-MM-DD>
- **Checagem de contrato agendada**: <sim, frequência | não>

## Chaves

- **Próxima rotação**: <AAAA-MM-DD> · **Responsável**: <...>

## Histórico

- <AAAA-MM-DD: mudança anunciada, alerta real, revisão feita, ação>
```

Com os alertas testados, o runbook atualizado e a revisão agendada, marque a fase 9 `feita` e **Resultado** `concluída (<data>)` em `terceiro.md`.
