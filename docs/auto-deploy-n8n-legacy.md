> **Legado/alternativa.** Abordagem webhook→n8n. O pipeline oficial agora é GitHub Actions — ver [auto-deploy.md](./auto-deploy.md).

# Auto-deploy via GitHub Webhook → n8n

## O que faz

Push para `main` no GitHub → GitHub dispara webhook → n8n recebe → valida assinatura HMAC-SHA256 → executa `nexus-deploy.sh` no VPS → pull + migrações + rebuild + restart do container `nexus-web`.

---

## Configuração única no VPS

```bash
# 1. Baixar o script para /usr/local/bin
curl -fsSL https://raw.githubusercontent.com/RafCarrasco/nexus/main/scripts/deploy.sh \
  -o /usr/local/bin/nexus-deploy.sh && chmod +x /usr/local/bin/nexus-deploy.sh

# 2. Gerar segredo do webhook
openssl rand -hex 32 > /etc/nexus-webhook.secret && chmod 600 /etc/nexus-webhook.secret

# 3. Verificar o segredo gerado
cat /etc/nexus-webhook.secret
```

---

## Configuração do workflow no n8n

### Importar pronto

Importe o arquivo `docs/auto-deploy-n8n-workflow.json` direto no n8n (menu → Import from file).

### Construir manualmente (4 nós)

#### 1. Nó Webhook (Trigger)
- **Tipo:** Webhook
- **HTTP Method:** POST
- **Path:** `nexus-deploy`
- **Authentication:** None (validamos HMAC no próximo nó)
- **Response Mode:** Immediately (status 200)

#### 2. Nó Code — Validar assinatura HMAC

```js
const crypto = require('crypto');
const secret = $env.NEXUS_WEBHOOK_SECRET;
const sigHeader = $request.headers['x-hub-signature-256'] || '';
const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(JSON.stringify($input.first().json))
  .digest('hex');
if (sigHeader !== expected) {
  return [{ json: { ok: false, error: 'invalid signature' } }];
}
return [{ json: { ok: true, ref: $input.first().json.ref } }];
```

Definir variável de ambiente no container n8n: `NEXUS_WEBHOOK_SECRET=<conteúdo de /etc/nexus-webhook.secret>`.

#### 3. Nó IF — Filtrar branch
- **Condition 1:** `{{ $json.ok }}` equals `true`
- **Condition 2:** `{{ $json.ref }}` equals `refs/heads/main`

#### 4. Nó Execute Command (ramo True)

**Opção A — n8n com acesso ao socket Docker/host paths:**
```
Command: bash /usr/local/bin/nexus-deploy.sh
```

**Opção B — n8n isolado (mais comum):**
Usar nó **SSH** em vez do Execute Command:
- Host: `host.docker.internal` (ou IP do VPS)
- User: `root`
- Authentication: Private Key (adicionar chave pública ao `authorized_keys` do root)
- Command: `bash /usr/local/bin/nexus-deploy.sh`

---

## Configuração do webhook no GitHub

1. Abrir: https://github.com/RafCarrasco/nexus/settings/hooks → **Add webhook**
2. **Payload URL:** `https://n8n.srv1625247.hstgr.cloud/webhook/nexus-deploy`
   _(ajustar para o hostname real do n8n no VPS)_
3. **Content type:** `application/json`
4. **Secret:** colar o conteúdo de `/etc/nexus-webhook.secret`
5. **Events:** Selecionar "Just the `push` event"
6. **Active:** ✓ → Salvar

---

## Testar

```bash
# No VPS — acompanhar o log em tempo real
tail -f /var/log/nexus-deploy.log
```

No GitHub:
1. Ir em Settings → Webhooks → clicar no webhook recém-criado
2. Aba **Recent Deliveries** → clicar no ping → **Redeliver**
3. Verificar execução no painel do n8n
4. Fazer um commit + push qualquer para validar fluxo completo

---

## Notas de segurança

- O segredo em `/etc/nexus-webhook.secret` deve ter permissão `600` e pertencer a `root`.
- O HMAC previne que qualquer terceiro acione o deploy — mesmo conhecendo a URL do webhook.
- Não expor o segredo em variáveis de ambiente não seguras ou logs.
