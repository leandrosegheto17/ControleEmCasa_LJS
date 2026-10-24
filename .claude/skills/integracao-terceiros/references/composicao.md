# Skills chamadas (fases 2, 3, 5 a 8)

A integração não refaz o que outra skill já faz: grava o **contrato de entrada** dela, aciona, e traz o resultado de volta para `.specs/integracoes/<slug>/`. Ao voltar de cada uma, confira os **itens próprios** da fase antes da aprovação.

## Fase 2: escolha do fornecedor (skill `escolha-tecnologia`)

Grave `.specs/escolhas/fornecedor-<slug>/escolha.md` no formato de `escolha-tecnologia/references/criterios.md`:

- **Chamado por**: `integração <slug>` · **Usar em**: `.specs/integracoes/<slug>/terceiro.md` (campos **Fornecedor** e **Rota de saída**)
- **Decisão a tomar**: fornecedor de `<caso de uso>`, com construir e não integrar quando couberem.
- **Restrições já dadas**: volume, criticidade, orçamento e dados de `terceiro.md`; o que o projeto já usa (inventário).
- **Reversibilidade** (sugestão; o usuário confirma): **fácil** quando o adaptador isola e o fornecedor não guarda dado nosso (e-mail transacional, CEP, geocodificação); **difícil** quando ele guarda dados ou estado que não se exporta bem (pagamento com cartões salvos e assinaturas, CRM, autenticação), ou há fidelidade contratual. Difícil → modo rigoroso.
- **Critérios sugeridos** (são do usuário; a escolha os congela):
  - eliminatórios: atende o caso de uso; custo no volume esperado dentro do orçamento; termos permitem o uso pretendido (comercial, revenda, região); trata dado pessoal conforme a LGPD (onde ficam os dados, contrato de tratamento disponível); tem sandbox ou modo de teste (ou o risco é aceito);
  - desejáveis: custo total (preço no volume, taxas, câmbio, custo de sair); limites de taxa contra o pico; SLA publicado e histórico da página de status; qualidade da documentação e do SDK oficial; política de versões e aviso de depreciação; rota de saída (exportação de dados, padrão aberto, alternativas compatíveis); suporte.

Volta: opção, ADR, `AD-NNN` (rigoroso). Itens próprios: **Fornecedor** e **Rota de saída** preenchidos em `terceiro.md`, com o custo no volume e os limites citados com fonte e data.

**Fornecedor imposto**: fase 2 `dispensada — <quem impôs>`; mesmo assim, um `pesquisador` levanta custo no volume, limites, SLA, termos e rota de saída, e a sessão anota em `terceiro.md`. Se algo disso fere o caso de uso, avise antes de seguir.

## Fase 3: contrato no sandbox (skill `spike`)

Grave `.specs/spikes/<slug>-contrato/spike.md` no formato de `spike/references/preparacao.md`:

- **Chamado por**: `integração <slug>` · **Usar em**: `.specs/integracoes/<slug>/contrato.md` (coluna **Situação** dos itens)
- **Pergunta**: "o sandbox de <fornecedor> se comporta como a documentação nos itens C-01 a C-NN de `contrato.md`?" (sim/não, com a lista).
- **Critério**: deu certo = todos os itens **críticos** confirmados; deu errado = algum crítico diverge; inconclusivo = algum crítico não pôde ser exercitado.
- **Ações externas**: criar conta de sandbox e gerar chave (do usuário), cada chamada ao sandbox (confirmação no início do experimento, com a lista de chamadas). Chave só em variável de ambiente; respostas brutas em `evidencias/` fora do git, sem token.

Pergunta com número (limite de taxa real, latência no p95) que pese na decisão: um spike próprio, `<slug>-<pergunta>`. Volta: veredito e confiança. Itens próprios: cada item de `contrato.md` com situação; divergências avaliadas contra a saída de emergência.

## Fases 5 a 8: construção (skill `feature` ou `legado`)

Na fase 5, a sessão grava a pasta `.specs/features/integracao-<slug>/` e aciona a skill escolhida. O `spec.md` (fase Specify do `tlc-spec-driven`) leva no topo:

- **Chamado por**: `integração <slug>` · **Entradas**: `terceiro.md`, `contrato.md`, `seguranca-legal.md` de `.specs/integracoes/<slug>/`

O que muda em cada fase da skill chamada:

| Fase dela | O que a integração acrescenta |
|---|---|
| Pedido (Specify) | Critérios de aceite da seção "Critérios de falha" de [desenho.md](desenho.md), adaptados ao caso; os requisitos de dados e segredos de `seguranca-legal.md`; fora de escopo explícito (capacidades do fornecedor que não serão usadas). |
| Reconhecimento / arqueologia | Procurar integrações existentes, cliente HTTP, biblioteca de resiliência, fila e flag já instalados: **reaproveitar antes de criar**. |
| Plano (Design e Tasks) | Seções do desenho de [desenho.md](desenho.md); tarefas de teste de falha e de contrato; tarefa de flag com desligamento. |
| Implementação | Suíte padrão sem rede; chaves de sandbox nunca no repositório. |
| Verificação | Em vez do `auditor-seguranca` avulso, a auditoria restrita (abaixo); depois, [verificacao.md](verificacao.md). |
| Integração da branch | Contexto do projeto ganha: onde fica o adaptador, como rodar os testes de sandbox, as variáveis necessárias (só os nomes). |

Volta: `integracao.md` da feature. Itens próprios da fase 5: o plano tem cada seção de [desenho.md](desenho.md) resolvida ou `não se aplica — motivo`; da 6: os testes da lista de falhas existem e passam; da 7: `verificacao.md` sem pendência; da 8: entrada em `liberacao.md`.

## Fase 7: segurança do lado do usuário (skill `auditoria-seguranca`)

Grave `.specs/seguranca/<AAAA-MM-DD>-integracao-<slug>/escopo.md` no formato de `auditoria-seguranca/references/escopo.md`:

- **Chamado por**: `integracao <slug>` · **Usar em**: `.specs/integracoes/<slug>/verificacao.md` · **Devolver após**: `classificação`
- **Modo**: `restrito — código da integração no projeto do usuário` · **Fases**: 1 a 7 (8 e 9 `não se aplica — correção como tarefa da integração, reteste pelo auditor-seguranca`)
- **No escopo**: adaptador, entrada de webhooks e retornos, guarda e uso das credenciais, dados enviados ao terceiro (de `seguranca-legal.md`), tratamento de resposta e erro, logs. **Fora**: o serviço do fornecedor, o painel dele, outros clientes dele; sandbox só dentro dos termos de uso.
- **Dono do sistema**: usuário (a autorização é confirmada na fase 1 da auditoria). **Teste ativo**: local, contra o nosso endpoint de webhook (assinatura forjada, repetição, carga malformada); nunca contra o fornecedor.

Volta: achados `SEC-NNN` classificados. Crítico e alto viram tarefa da feature (volta à fase 6 da integração), com o teste do ataque; o reteste é do `auditor-seguranca` com a mesma Prova, anotado em `verificacao.md`.

## Fase 8: liberação (skill `liberacao`)

Antes de acionar, leve ao plano de liberação os itens de [monitoramento.md](monitoramento.md) (seção Liberação): chaves de produção, webhook de produção, flag e desligamento, alcance inicial, critério de parada próprio de terceiro. No `legado`, a fase 8 dele já chama a `liberacao`: passe os mesmos itens. Ferramenta pessoal: skill `implantacao`, com as chaves fora do repositório.
