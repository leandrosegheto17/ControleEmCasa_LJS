# Destinos de implantação

## Local com Docker

**Quando:** só o usuário usa, na rede de casa ou no próprio computador; dados que ele quer manter consigo.

1. **`docker-compose.yml`**
   - `restart: unless-stopped` em cada serviço.
   - Dados em **volume nomeado** (não em pasta dentro do container).
   - Porta exposta só em `127.0.0.1:<porta>` se for uso no próprio computador; na rede local, a porta normal.
   - Variáveis em `.env` (no `.gitignore`), com um `.env.exemplo` versionado sem valores reais.
2. **Backup agendado**
   - Banco: dump (`pg_dump`, `sqlite3 .backup` ou equivalente) com data no nome.
   - Arquivos: cópia do volume.
   - Destino fora da máquina quando possível (pasta sincronizada, disco externo).
   - Agendamento: serviço de backup no compose, ou tarefa agendada do sistema (Agendador de Tarefas no Windows, `cron` no Linux).
   - Manter os N últimos backups e apagar os mais antigos.
3. **Script de implantação**: `git pull` (se aplicável) → `docker compose build` → `docker compose up -d` → teste de saúde.
4. **Voltar à versão anterior**: `git checkout <versão anterior>` e o mesmo script; os dados ficam no volume.
5. **Acesso de fora de casa** (se o usuário pedir): prefira túnel ou VPN (ex.: Tailscale, Cloudflare Tunnel) a abrir porta no roteador. Com acesso pela internet, autenticação e HTTPS são obrigatórios e a validação inclui o `auditor-seguranca`.

## Nuvem gratuita

**Quando:** acesso de qualquer lugar sem manter máquina ligada; dados pequenos; aceita os limites do plano.

1. **Conferir os limites atuais** com o `pesquisador`, na página oficial de preços do serviço: armazenamento, horas de execução, pausa por inatividade, apagamento de projetos parados, banda, se exige cartão. Registre a fonte e a data.
2. **Separar o que for preciso**: aplicação e banco podem ficar em serviços diferentes, cada um com seu plano gratuito.
3. **Segredos** nas variáveis de ambiente do serviço; nunca no repositório.
4. **Backup para fora do serviço**: planos gratuitos podem pausar ou apagar dados. Exportação agendada (ex.: ação agendada no GitHub que faz o dump e guarda como artefato privado, ou cópia para armazenamento próprio).
5. **Publicar** pelo método oficial do serviço (CLI ou integração com o repositório), sempre com confirmação do usuário.
6. **Voltar à versão anterior**: pelo histórico de versões do serviço, ou reimplantando o commit anterior.
7. **Pausa por inatividade**: se o serviço pausa, avise que o primeiro acesso depois de um tempo parado será lento, ou descreva como evitar dentro dos termos do serviço.

## Teste de fumaça (os dois destinos)

- A aplicação abre no endereço registrado.
- A ação principal funciona de ponta a ponta.
- Os dados persistem depois de reiniciar (local) ou reimplantar (nuvem).
- O backup roda e gera o arquivo esperado.
