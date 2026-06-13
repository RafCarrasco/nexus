# Auto-deploy — CI-gated pull (cron)

> **ATIVO (2026-06-12): modelo PULL via cron no VPS.** O VPS roda `scripts/autopull.sh`
> a cada 2 min: faz `git fetch origin main`, e se main avançou **E** o CI daquele commit
> está verde (API `check-runs`), executa `nexus-deploy.sh` (build + `prisma migrate deploy`
> + health gate interno + rollback).
>
> **Por que pull e não SSH-push:** o GitHub Actions SSH-push (`deploy.yml`) falha com
> `dial tcp :22 i/o timeout` — a **rede da Hostinger dropa SSH de entrada dos IPs dos
> runners do GitHub** (o VPS em si está aberto: sshd em 0.0.0.0, sem iptables/fail2ban;
> meu IP conecta). O pull só usa saída → firewall-agnóstico. `deploy.yml` fica **desabilitado**
> (serve de fallback se o firewall for aberto pros ranges do GitHub no futuro).
>
> CI-gate preservado (autopull checa o status do CI antes de deployar); health gate +
> rollback do `deploy.sh` são a rede de segurança. Rascunho n8n: [`auto-deploy-n8n-legacy.md`](./auto-deploy-n8n-legacy.md).

## Setup do pull no VPS (já aplicado)

```bash
# scripts vêm do repo; symlinks + cron:
ln -sf /docker/nexus/scripts/autopull.sh /usr/local/bin/nexus-autopull.sh
ln -sf /docker/nexus/scripts/deploy.sh  /usr/local/bin/nexus-deploy.sh
apt-get install -y jq   # autopull usa pra ler o status do CI
# crontab:
*/2 * * * * /usr/bin/flock -n /tmp/nexus-autopull.lock /usr/local/bin/nexus-autopull.sh >> /var/log/nexus-autopull.log 2>&1
```
Logs: `/var/log/nexus-autopull.log` (decisões do gate) e `/var/log/nexus-deploy.log` (deploy).

## O que faz (o `deploy.sh`, chamado pelo autopull)

`push` em `main` → **CI** (`.github/workflows/ci.yml`) roda lint + typecheck +
testes (com Postgres real) → se verde, **Deploy** (`.github/workflows/deploy.yml`)
faz SSH no VPS e roda `nexus-deploy.sh` → `git pull` + `prisma migrate deploy` +
rebuild do `nexus-web` + **health gate** em `/api/health` → **rollback** automático
do código se não ficar saudável.

```
GitHub push main ─▶ CI (test) ──green──▶ Deploy (workflow_run) ─ssh─▶ nexus-deploy.sh
                                  │                                        │
                                  └─red─▶ deploy NÃO roda                  ├─ git reset --hard origin/main
                                                                          ├─ docker compose build nexus-web
                                                                          ├─ docker compose run --rm nexus-web prisma migrate deploy
                                                                          ├─ docker compose up -d nexus-web
                                                                          └─ curl /api/health  ─fail─▶ rollback p/ SHA anterior
```

Arquivos:
- `.github/workflows/ci.yml` — gate de qualidade (PR + push main).
- `.github/workflows/deploy.yml` — deploy, só após CI sucesso em main.
- `scripts/deploy.sh` — script idempotente que roda no VPS (vira `/usr/local/bin/nexus-deploy.sh`).
- `src/app/api/health/route.ts` — probe público (200 ok / 503 db down).

---

## Checklist de ativação (passos que tocam prod — Rafael executa)

### 1. Deploy key SSH dedicada (não usar senha root)
```bash
# Na sua máquina — gerar par dedicado ao deploy
ssh-keygen -t ed25519 -f nexus-deploy -C "github-actions-nexus-deploy" -N ""

# Copiar a PÚBLICA pro VPS (autoriza o GitHub a entrar)
ssh-copy-id -i nexus-deploy.pub root@177.7.41.38
#   (ou: anexar conteúdo de nexus-deploy.pub em ~/.ssh/authorized_keys no VPS)
```
> Melhoria opcional de segurança: criar usuário `deploy` no VPS com sudo restrito
> só ao `nexus-deploy.sh`, em vez de `root`. Ver nota de segurança no fim.

### 2. Secrets no GitHub
Repo → Settings → Secrets and variables → Actions → **New repository secret**:

| Secret | Valor |
|--------|-------|
| `VPS_HOST` | `177.7.41.38` |
| `VPS_USER` | `root` (ou `deploy`) |
| `VPS_SSH_KEY` | conteúdo de **`nexus-deploy`** (a chave PRIVADA, completa) |
| `VPS_SSH_PORT` | `22` (só se não for padrão) |

### 3. Environment `production` (opcional, recomendado)
Repo → Settings → Environments → **New environment** → `production`.
Pode exigir **required reviewers** → deploy espera aprovação manual antes de subir.

### 4. Instalar o script no VPS
```bash
ssh root@177.7.41.38
# O repo já fica em /docker/nexus — symlink pro script versionado:
ln -sf /docker/nexus/scripts/deploy.sh /usr/local/bin/nexus-deploy.sh
chmod +x /docker/nexus/scripts/deploy.sh
touch /var/log/nexus-deploy.log
```

### 5. Pré-requisitos no VPS (one-time, se ainda não)
```bash
cd /docker/nexus
git remote -v          # deve apontar pro repo; main checked out
ls .env                # .env de produção presente (NEXUS_MASTER_KEY etc.)
docker compose ps      # nexus-db + nexus-web up
```

### 6. Testar
- GitHub → Actions → ver o **CI** rodar verde no próximo push.
- **Deploy** dispara em seguida; acompanhar no VPS:
  ```bash
  tail -f /var/log/nexus-deploy.log
  ```
- Validar `curl -s http://localhost:3000/api/health` → `{"status":"ok",...}`.

---

## Comportamento de rollback

Se o `/api/health` não responder 200 após ~60s (12×5s), o script faz
`git reset --hard` pro SHA anterior, rebuilda e sobe. **Migrações não são
revertidas automaticamente** — por isso mantenha migrações *expand/contract*
(compatíveis com a versão anterior do código). Nunca um `DROP COLUMN` no mesmo
deploy que para de usá-la; separe em dois releases.

## Notas de segurança

- A chave em `VPS_SSH_KEY` dá acesso de deploy ao VPS — tratar como segredo crítico.
- Preferir usuário `deploy` dedicado a `root`. Restringir a chave no
  `authorized_keys` com `command="bash /usr/local/bin/nexus-deploy.sh",no-port-forwarding,no-pty <chave>`
  pra ela só poder rodar o deploy.
- O endpoint `/api/health` é público de propósito (não vaza dado — só status up/down + timestamp).
- O `environment: production` + required reviewers dá um gate humano antes de tocar prod.
