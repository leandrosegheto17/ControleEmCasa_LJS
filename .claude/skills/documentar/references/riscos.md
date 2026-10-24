# Riscos e dívidas (fase 7)

Responde: **onde está o perigo?** É um **levantamento** para quem vai mexer no projeto, não uma auditoria: aponta, com evidência, onde ter cuidado. Auditoria de segurança a fundo é a skill `auditoria-seguranca`, oferecida como trabalho separado.

## Coleta

| Risco | Como levantar | Evidência |
|---|---|---|
| Áreas frágeis | `git log` (pode delegar ao `leitor-codigo`): arquivos que mais mudam nos últimos 6 a 12 meses, commits de correção (`fix`, "corrige", "bug") por arquivo, arquivos muito grandes | contagens e `arquivo` |
| Sem teste | trechos de regra e fluxos de `comportamento.md` sem teste que os exercite; cobertura só se a ferramenta já estiver instalada | caminho do código e ausência de teste |
| Segredos expostos | `python .claude/scripts/varredura-seguranca.py ferramentas --saida .specs/documentacao/<slug>/evidencias/` (histórico do git, dependências e análise estática, com as ferramentas instaladas; ausente sai `NÃO EXECUTADO`) | arquivo e commit, **nunca o valor** |
| Dependências desatualizadas | o comando do ecossistema, se instalado (`npm outdated`, `pip list --outdated`, `composer outdated`...), e a saída de dependências da varredura | versão atual, última, vulnerabilidade conhecida |
| Código morto | `leitor-codigo`: exportações sem uso, rotas sem chamada, arquivos sem import, flags sempre ligadas | `arquivo:linha` e como foi buscado |
| Armadilhas | tropeços de `execucao.md`, estranhezas de `comportamento.md`, inconsistências de `convencoes.md`, `arqueologia.md` anteriores, o que o usuário contar | a fonte |

`evidencias/` fica fora do git (saída bruta pode ter caminho interno ou trecho sensível): antes da varredura, acrescente `.specs/documentacao/*/evidencias/` ao `.gitignore` do projeto, mostrando o diff. Instalar ferramenta de varredura ou de cobertura é decisão do usuário.

## Segredo encontrado

Registre onde está (arquivo e commit), o tipo (chave de API, senha de banco) e se ainda está no código atual ou só no histórico. **Não copie o valor**, nem parcial. Ofereça via `AskUserQuestion`: trocar a credencial (ação externa, confirmação específica), abrir uma auditoria (`auditoria-seguranca`), ou registrar como risco aceito com responsável. Sinal de uso indevido em curso: pare e passe para a skill `incidente`.

## Dívidas

Toda dívida achada (fragilidade, duplicação, inconsistência, dependência antiga, código morto) entra em `.specs/projeto/dividas.md` no modelo da skill `refatoracao` (`references/motivo.md`), com tipo, medida e pontuação, situação `aberta`. Pagar é a skill `refatoracao`.

## Modelo de `riscos.md`

```markdown
# Riscos e dívidas: <slug>

- **Data**: <AAAA-MM-DD> · **Commit**: <hash curto> · **Varredura**: `evidencias/<pasta>` (<ferramentas executadas | NÃO EXECUTADO: ...>)

| Risco | Tipo | Onde | Evidência | Gravidade (alta, média, baixa) | Encaminhamento |
|---|---|---|---|---|---|
| <ex.: cálculo de frete muda todo mês, 9 correções em 6 meses, sem teste> | frágil + sem teste | `src/frete/` | `git log`, ausência em `tests/` | alta | `dividas.md` · cuidado no contexto |

## Segredos
- <tipo> — <arquivo, commit> — <no código atual | só no histórico> — <encaminhamento>

## Fora do levantamento
- <o que não foi checado e por quê (ferramenta ausente, sem acesso)>
```

## Documento

Para o público interno (você, novo dev, auditor), uma seção curta "Onde ter cuidado" em `docs/arquitetura.md` ou `docs/riscos.md`: as áreas frágeis e as armadilhas, com o que fazer. **Vulnerabilidade não corrigida e segredo não entram** em documento do repositório se ele for público ou compartilhado com terceiros: ficam em `riscos.md` e no encaminhamento. Para cliente, esta fase não gera documento.
