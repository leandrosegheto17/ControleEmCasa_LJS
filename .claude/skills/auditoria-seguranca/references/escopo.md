# Escopo e autorização (fase 1)

Também é o **contrato de entrada** para os fluxos que chamam a auditoria (avaliação de terceiros, integração): eles gravam este arquivo com o que sabem e a fase 1 só completa e confirma.

## Como conduzir

Uma pergunta por vez, via `AskUserQuestion`, a resposta recomendada primeiro. Na ordem:

1. **Invasão em curso?** "Há sinal de que alguém já está explorando o sistema ou de que dados vazaram?" Sim → skill `incidente` agora; a auditoria espera.
2. **De quem é o sistema?**
   - **do usuário** (código e infraestrutura dele): autorização `não necessária — sistema do próprio usuário`;
   - **da empresa ou de um cliente**: exige **autorização por escrito** de quem responde pelo sistema (e-mail, contrato, chamado). Registre quem, quando e onde está o documento; não copie o documento. Autorização verbal não basta;
   - **de terceiro** (biblioteca, projeto aberto, fornecedor): só leitura e varredura de uma **cópia local** do código publicado; nada contra o serviço deles, nem com "só uma requisição". Teste ativo, só numa instância que o usuário subir localmente;
   - sem autorização → **não há auditoria**: grave `parado — sem autorização` e pare.
3. **Alvo:** repositórios e caminhos no escopo; o que fica **fora** (outros sistemas, serviços de terceiros integrados, infraestrutura do provedor de nuvem). Para escopo restrito, o recorte (ex.: só a integração com o fornecedor X).
4. **Exposição e dados:** acessível pela internet, rede interna ou só local; guarda dados pessoais, sensíveis (saúde, finanças, menores) ou de pagamento? Isso calibra a severidade.
5. **Onde o teste ativo pode rodar:** local (recomendado), staging (endereço exato e quem avisar), ou nenhum. **Produção: não** é a resposta padrão; só com autorização que a cubra e confirmação específica por teste, na fase 6.
6. **Contas de teste:** duas contas comuns (A e B) e, se houver papéis, uma de administrador, para testar acesso a dados de outro usuário. As credenciais ficam fora do arquivo (diga só onde estão).
7. **Ferramentas:** quais estão instaladas (`semgrep`, `gitleaks`, `osv-scanner`, `pip-audit`, `npm`/`pnpm`, Docker). Instalar é decisão do usuário, pergunte na fase 4 se faltar.
8. **Repositório público?** Se sim (ou se vai ser), a pasta da auditoria fica **fora do git** até os críticos e altos estarem fechados: publicar falha aberta é entregar o mapa ao atacante.

Antes da aprovação, acrescente ao `.gitignore` do projeto a linha `.specs/seguranca/*/evidencias/` (e a pasta inteira, se o repositório for público), mostrando o diff.

## Sempre proibido

Vale mesmo com autorização, e entra no `escopo.md` como lista fixa:

- negação de serviço, teste de carga, inundação de requisições;
- força bruta ou adivinhação de senha em massa (testar o **limite** de tentativas com poucas tentativas é permitido);
- técnicas destrutivas: apagar ou alterar dado real, derrubar serviço, explorar além da prova mínima (provar que lê um registro de teste, não despejar a base);
- engenharia social, phishing, acesso físico;
- tocar sistemas de terceiros, mesmo integrados (provedor de pagamento, e-mail, nuvem);
- usar credencial real de outra pessoa.

## Modelo de `escopo.md`

```markdown
# Auditoria de segurança: <alvo>

- **ID**: <AAAA-MM-DD>-<slug> · **Início**: <AAAA-MM-DD>
- **Chamado por**: <nenhum | avaliacao-terceiros <id> | integracao <id>>
- **Usar em**: <arquivo do chamador | —>
- **Devolver após**: <— | classificação | relatório>
- **Modo**: <completo | restrito — <recorte>>
- **Fases**: <1 a 9 | lista, ex.: 1 a 7 e 9>

## Alvo

- **No escopo**: <repositórios, caminhos, serviços>
- **Fora do escopo**: <o que não se toca, e por quê>
- **Exposição**: <internet | rede interna | local> · **Dados**: <pessoais, sensíveis, pagamento | nenhum>

## Autorização

- **Dono do sistema**: <usuário | empresa | cliente | terceiro (código aberto)>
- **Autorizado por**: <nome e papel> · **Em**: <data> · **Registro**: <onde está o documento escrito>
- **Autorização**: <confirmada | não necessária — sistema do próprio usuário | recusada>

## Ambientes e limites

| Ambiente | Endereço | Leitura de código | Ferramentas | Teste ativo |
|---|---|---|---|---|
| local | <http://localhost:...> | sim | sim | <sim/não> |
| staging | <endereço> | — | — | <sim, janela e contato / não> |
| produção | — | — | — | não (padrão) |

- **Contas de teste**: <A, B, admin — onde estão as credenciais (nunca aqui)>
- **Ferramentas instaladas**: <lista> · **Instalação aprovada**: <não | quais>
- **Repositório público**: <não | sim — pasta fora do git até fechar críticos e altos>
- **Sempre proibido**: negação de serviço, carga, força bruta, técnica destrutiva, engenharia social, sistemas de terceiros, ir além da prova mínima, credencial real de outra pessoa.

## Estado

- **Escopo aprovado**: <pendente | sim (<data>)>
```
