# Skills chamadas (fases 4, 6 e 8)

A automação não refaz o que outra skill já faz: grava o **contrato de entrada** dela, aciona, e traz o resultado de volta para `.specs/automacoes/<slug>/`. Ao voltar de cada uma, confira os **itens próprios** da fase antes da aprovação.

## Fase 4: escolha da ferramenta (skill `escolha-tecnologia`)

Só quando há alternativas reais ([ferramenta.md](ferramenta.md)). Grave `.specs/escolhas/automacao-<slug>/escolha.md` no formato de `escolha-tecnologia/references/criterios.md`:

- **Chamado por**: `automação <slug>` · **Usar em**: `.specs/automacoes/<slug>/processo.md` (campos **Ferramenta**, **Onde mora** e **Como se testa**)
- **Decisão a tomar**: meio de automatizar `<escopo de processo.md>`, entre os degraus da escada que restaram; "não automatizar" e "continuar à mão" entram como opção quando a conta de retorno for apertada.
- **Restrições já dadas**: onde roda (computador do usuário, servidor, nuvem), sistema operacional, o que o usuário e o projeto já usam (inventário), custo mensal aceitável, quem mantém, frequência e volume de `processo.md`.
- **Reversibilidade** (sugestão; o usuário confirma): **fácil** na maioria das automações (modo **enxuto**); **difícil** quando a ferramenta guarda os dados ou fluxos que não se exportam bem, ou tem fidelidade contratual (modo rigoroso).
- **Critérios sugeridos** (são do usuário; a escolha os congela):
  - eliminatórios: faz o caminho comum do escopo; roda onde precisa rodar; custo no volume dentro do aceitável; permite credencial com permissão mínima; tem como simular ou testar antes de agir (ou o risco é aceito);
  - desejáveis (até 3 no enxuto): simplicidade de manter (menos peças, conhecido do usuário); alerta de falha e histórico de execuções nativos; dependência do fornecedor (exportar a configuração, sair sem perder dados).

Volta: opção, ADR leve. Itens próprios: **Ferramenta**, **Onde mora** e **Como se testa** preenchidos em `processo.md`; degraus descartados com motivo; IA só com motivo e travas anotadas para a fase 5.

## Fase 6: construção em projeto existente (skill `feature` ou `legado`)

Grave a pasta `.specs/features/automacao-<slug>/` e acione a skill escolhida (pergunte qual via `AskUserQuestion`, recomendando pelo projeto: código antigo, pouco testado, autores ausentes → `legado`; senão `feature`). O `spec.md` (Specify do `tlc-spec-driven`) leva no topo:

- **Chamado por**: `automação <slug>` · **Entradas**: `processo.md` e `desenho.md` de `.specs/automacoes/<slug>/`

O que muda em cada fase da skill chamada:

| Fase dela | O que a automação acrescenta |
|---|---|
| Pedido (Specify) | Critérios `AUT-NN` de `desenho.md`, adaptados; casos de amostra do processo com o resultado manual; exceções e "fora" de `processo.md` como fora de escopo explícito. |
| Reconhecimento / arqueologia | Procurar tarefas agendadas, filas, comandos, registro e alertas já existentes: **reaproveitar antes de criar**. |
| Plano (Design e Tasks) | Seções de `desenho.md` com tarefa e teste; simulação como padrão; pausa e teto como configuração. |
| Implementação | Suíte sem efeito em dado real; credenciais nunca no repositório. |
| Verificação | Verificador contra os `AUT-NN`; `auditor-seguranca` quando a automação tem credencial com escrita, toca dado pessoal ou age em massa. |
| Integração da branch | A automação entra **inerte** (simulação por padrão, sem agendamento). O contexto do projeto ganha: o que a automação faz, como simular, como pausar, as variáveis necessárias (só os nomes). No `legado`, a fase 8 dele (liberação) não roda agora: fica para a fase 8 daqui. |

Volta: `integracao.md` da feature. Itens próprios: cada `AUT-NN` com teste passando; casos de amostra iguais ao manual; checagem final verde.

## Fase 6: script avulso ou hook (repositório da automação)

`tlc-spec-driven` direto no repositório de **Onde mora**: Specify a partir de `processo.md` e `desenho.md` (os `AUT-NN` viram critérios), Tasks, Execute numa branch `automacao/<slug>`; verificação pelo agente `verificador`; checagem final (`trava-testes.py --rodar`) e `finishing-a-development-branch`. Repositório novo começa pela infraestrutura mínima de testes, `testes.json` e CI (regra do `CLAUDE.md`).

## Fase 8: ligar (skill `implantacao` ou `liberacao`)

- **Ferramenta pessoal** (só o usuário depende dela): skill `implantacao` quando há algo a pôr no ar (contêiner, serviço na nuvem); agendador local ou do CI só precisa do registro em `operacao.md`.
- **Produção com usuários** (a automação age em sistema que outros usam): skill `liberacao`, levando ao plano: começar em simulação no ambiente real, depois com aprovação humana, depois sozinha; alcance inicial pequeno (um lote, um cliente, teto baixo); critério de parada (exceções acima do normal, divergência, alerta); reversão = pausa testada mais como desfazer o que já foi feito.

Itens próprios: os de [operacao.md](operacao.md) (alertas com disparo testado, relatório chegando, pausa testada, dono).
