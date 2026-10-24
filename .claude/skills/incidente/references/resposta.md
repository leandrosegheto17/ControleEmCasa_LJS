# Resposta: triagem, contenção e restauração (fases 1 a 3)

Escrito para quem está sob pressão: listas curtas, a ação mais reversível primeiro. Se o projeto tiver `.specs/runbook.md`, ele vem antes deste roteiro.

## Triagem (fase 1)

Pergunte só o que falta, via `AskUserQuestion`, com sugestão plausível e "Ainda não sei" (vira `[A ESCLARECER]`):

- **Sintoma**: o que quem usa vê (erro, lentidão, dado errado, fora do ar). Erro literal se houver.
- **Desde quando**: hora do primeiro sinal; como foi detectado (alerta, usuário, acaso).
- **Quem é afetado e quanto**: todos, um grupo, uma região, uma função; porcentagem do tráfego.
- **Impacto no negócio**: venda parada, dado perdido ou corrompido, dinheiro, prazo legal ou contratual.
- **O que mudou recentemente**: última liberação (`.specs/liberacao.md`, `git log`, CI), configuração, dependência, tráfego, serviço de terceiro (página de status).
- **Dado pessoal ou segurança**: há indício de acesso indevido, vazamento ou dado pessoal exposto? Na dúvida, trate como sim até descartar.

### Severidade

Mesma escala da skill `bug`, vista pelo lado do incidente:

| Severidade | Quando | Resposta |
|---|---|---|
| **P0** | Fora do ar, perda ou corrupção de dados, incidente de segurança, dado pessoal exposto | Agora, tudo para |
| **P1** | Função principal quebrada ou muito degradada para muitos usuários, sem contorno | Agora |
| **P2** | Degradação parcial, com contorno | Hoje; pode virar `bug` urgente |
| **P3** | Impacto mínimo | Não é incidente: skill `bug` |

**Veredito da triagem:** `incidente <severidade>` · `não é incidente` (encaminhar à skill `bug`) · `duplicado de <id>`.

### Classificação inicial

| Sintoma | Causa mais provável | Primeira medida |
|---|---|---|
| Tudo falhando logo após uma liberação | a liberação | reverter |
| Tudo falhando sem liberação | infraestrutura, dependência, certificado, disco, cota | ver saúde e status de terceiros |
| Lentidão | banco, dependência lenta, pico de tráfego | limitar tráfego, escalar, desligar a função pesada |
| Falha parcial numa função | defeito de código, dado inesperado | desligar a flag ou a função |
| Pico de erros com pico de tráfego | sobrecarga ou ataque | limitar tráfego, bloquear origem |
| Dado errado sendo gravado | defeito de código ou migração | parar a escrita (flag, modo leitura) antes de tudo |

## Contenção (fase 2)

### Evidências antes de mexer

Copie o que a ação vai apagar, em minutos: logs da aplicação e do servidor no intervalo do incidente, saída de erros, métricas e capturas dos painéis, versão no ar e configuração ativa, estado de filas e conexões. Guarde em `.specs/incidentes/<id>/evidencias/` ou, se houver dado pessoal ou segredo, fora do repositório (registre onde). Anote o que não deu para copiar.

### Menu de medidas (mais reversível primeiro)

1. **Desligar a feature** (flag) ou a função problemática.
2. **Reverter a última mudança** (versão, configuração, migração com reversão testada): seção de reversão da skill `liberacao` e entrada em `.specs/liberacao.md`.
3. **Isolar o componente**: tirar do balanceador, modo manutenção, modo somente leitura.
4. **Limitar o tráfego**: limite de requisições, fila, bloquear origem abusiva.
5. **Escalar recurso**: mais instâncias, mais memória (temporário).
6. **Avisar os afetados**: aviso curto (modelo em `comunicacao.md`), enviado só com confirmação.

Para cada ação, **antes**, uma confirmação via `AskUserQuestion` com: o que será feito, onde, efeito esperado, **como desfazer** e quanto tempo leva. Comando destrutivo (matar processo, terminar conexões, apagar fila) leva antes uma checagem do alcance (contar o que será afetado) mostrada na pergunta. Depois, registre hora e resultado.

## Restauração (fase 3)

- Reverter, reiniciar, aplicar a configuração anterior. **Código novo** só pela skill `bug` (relato pronto, urgência agora, caminho de hotfix), porque a regra de testes vale também na emergência.
- **Estável por métrica**: o sinal que mostrou o problema (taxa de erro, latência, fila, métrica de negócio) de volta ao normal, observado pelo período combinado com o usuário (sugestão: 15 a 30 minutos). Teste de fumaça do fluxo principal.
- Ação que pede escalonamento (outra equipe, fornecedor): registre quem e quando.

## Caminho de segurança

Indício de invasão, acesso indevido ou vazamento:

1. **Isolar sem destruir**: bloquear acesso ou tirar da rede; não desligar, reinstalar nem apagar a máquina ou o banco afetado.
2. **Evidência forense**: logs de acesso, autenticação e auditoria; lista de processos e conexões; cópia ou snapshot do que foi afetado; hashes quando possível. Nada disso no git.
3. **Credenciais**: trocar senhas, chaves e tokens expostos ou suspeitos; revogar sessões (cada troca confirmada; anotar o que deixa de funcionar).
4. **Alcance dos dados**: quais dados, de quantas pessoas, se são sensíveis (saúde, biometria, financeiros, de crianças), se estavam criptografados.
5. **Relógio da LGPD**: data e hora em que se soube que dados pessoais foram afetados (campo no `incidente.md`). Avise o usuário já que o prazo corre (ver `comunicacao.md`) e que a decisão é de quem responde pelos dados, com encarregado ou jurídico.
6. Só depois restaurar, a partir de versão limpa.

## Modelo de `incidente.md`

```markdown
# Incidente: <sintoma, do ponto de vista de quem usa>

- **Id**: <AAAA-MM-DD-slug> · **Detectado em**: <data hora, fuso> · **Por**: <alerta | usuário | equipe>
- **Severidade**: P0–P3 — <justificativa> · **Veredito da triagem**: <incidente P_ | não é incidente | duplicado de <id>>
- **Contido**: pendente | sim (<hora>) · **Estável**: pendente | sim (<hora>, <sinal e período>)
- **Segurança**: não | suspeita | confirmada · **Dado pessoal afetado**: não | possível | sim — conhecido em <data hora>
- **Encerrado**: não | sim (<data>, <motivo ou "ciclo completo">)

## Triagem

- **Sintoma**: <...> · **Início provável**: <hora> · **Erro literal**: <...>
- **Afetados**: <quem, quantos, % do tráfego> · **Impacto**: <negócio, dados, dinheiro>
- **Mudanças recentes**: <liberação, configuração, terceiro | nenhuma encontrada>
- **Origem do relato**: <colado | link (host) | bug <slug> | demanda DEM-NNN>
- **Casos de suporte**: <— | DEM-NNN, DEM-NNN (avisados pela skill `suporte`)>

## Evidências

| O quê | Onde está | Copiado em |
|---|---|---|
| <logs da API 14:00–15:30> | <evidencias/api.log | fora do repositório: <local>> | <hora> |

## Ações

| Hora | Ação | Confirmada por | Como desfazer | Resultado |
|---|---|---|---|---|
| <hh:mm> | <reverter v2.3.4 → v2.3.3> | <usuário> | <reaplicar v2.3.4> | <erros caíram de 23% para 1%> |

## Comunicações durante o incidente

| Hora | Para | Canal | Resumo | Confirmado |
|---|---|---|---|---|

## A esclarecer

- [A ESCLARECER: <...>]
```
