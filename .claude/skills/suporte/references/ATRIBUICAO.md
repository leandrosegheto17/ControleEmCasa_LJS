# Atribuição

A skill `suporte` é própria, escrita a partir do desenho em `.rascunho/FLUXO-SUPORTE.md`, construída por cima da skill `demandas` (registro único, comum aos fluxos 10, 11 e 32) e irmã das skills `sugestao` e `solicitacao` na forma e na orquestração. Não havia material pronto de suporte ao cliente nas pastas de referência (`.rascunho/REAPROVEITAMENTO.md`): classificação por tipo, prioridade por impacto, acesso mínimo e registrado, primeira resposta rápida, pedir informação uma vez, tags por causa raiz e base de conhecimento são conhecimento comum de atendimento, escritos sem cópia de fonte. Dois trechos foram adaptados (traduzidos, enxutos e generalizados) das fontes abaixo.

## wshobson/agents — `on-call-handoff-patterns`

- Origem: https://github.com/wshobson/agents · commit `0874a27b17a22e2b7c2e2bcd725768e0803cad06`
- Arquivos: `plugins/incident-response/skills/on-call-handoff-patterns/SKILL.md` e `references/details.md`
- Usado em: `escalonamento.md` (pacote de passagem: estrutura do modelo de passagem no meio de um incidente — situação agora, o que sabemos, o que já foi feito, o que precisa acontecer, quem é quem, comunicação feita; a passagem só está completa com cada seção preenchida ou "nenhum"; a tabela de escalonamento por tipo de problema virou as **alçadas** dos combinados, com papel em vez de pessoa). Mudanças: de troca de plantão entre engenheiros para passagem de um caso de cliente a quem decide; sem horários de sobreposição, chamada de sincronização, comandos nem ferramentas de alerta; sem nomes de pessoas.
- Licença: MIT, Copyright (c) 2024 Seth Hobson.

## anthropics/skills — `internal-comms`

- Origem: https://github.com/anthropics/skills · commit `dbd4588f9e1033efb41dad4bef2f7947c8993d44`
- Arquivos: `skills/internal-comms/SKILL.md`, `examples/faq-answers.md` e `examples/general-comms.md`
- Usado em: `base-conhecimento.md` (formato da entrada: pergunta em uma frase e resposta em uma ou duas; resposta apoiada na fonte oficial, com o incerto marcado e a fonte citada) e `mensagens.md` (o mais importante primeiro; frases claras e curtas; incerteza dita como incerteza; o que pede posição oficial é sinalizado e passado a quem decide). Mudanças: de comunicação interna de empresa para resposta a um cliente e base de conhecimento do suporte; sem consulta a Slack, e-mail ou documentos da empresa, sem os formatos de 3P e boletim.
- Licença: Apache License 2.0 (`LICENSE.txt` da skill). Texto traduzido e modificado.

## Legado (`.claude_legado`, material do usuário)

- `skills/bug-documentation/SKILL.md`: em `atendimento.md`, o relato que vai à skill `bug` com passos específicos o bastante para outra pessoa reproduzir sem perguntar nada, esperado × obtido a partir do comportamento definido, severidade justificada por impacto e presença de contorno e evidência concreta; e, em `base-conhecimento.md`, o limiar de **3 ou mais casos com a mesma causa raiz** (não só o mesmo sintoma) como sinal de problema maior, escalado em vez de tratado caso a caso.

Origem citada; sem licença de terceiro.

## Peças acionadas, não copiadas

Skills `demandas` (registrar, procurar, situação, avisar, encaminhar, conferir ligações, contato; modelos de mensagem), `sugestao` e `solicitacao` (troca de tipo e sugestão interna), `bug` (contrato de entrada do fluxo 32: relato com triagem, **Chamado por** `suporte DEM-NNN`, **Devolver após** `liberação`), `incidente`, `auditoria-seguranca`, `performance`, `documentar`, `redesign`, `integracao-terceiros`, `feature`; agentes `leitor-codigo` e `pesquisador`; superpowers `verification-before-completion`.
