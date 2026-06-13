# Project Intelligence — Design (Frente A: Firebase profundo)

> Epic guarda-chuva: Nexus deixa de ser "lista de recursos + custo" e passa a
> **entender cada projeto a fundo** — o que cada app realmente usa, quanto, e
> como está de saúde/postura. Frente A entrega isso para Firebase (driver:
> `vision` / corporate-forms). Frentes B/C/D na fila (ver `docs/project-intelligence/QUEUE.md`).

## Problema

Hoje o `FirebaseProvider` descobre só: o projeto, sites de Hosting, Cloud
Functions e custo. Abrir o projeto `vision` no Nexus **não** revela o que ele de
fato usa — Firestore, Storage, Auth, Realtime DB, quais APIs estão habilitadas.
O consultor não tem como responder "o que tem dentro desse projeto?" sem abrir o
Console Firebase.

## Objetivo (Frente A)

Ao coletar uma conexão Firebase, descobrir e exibir um **inventário de serviços**
preciso do projeto:

- **APIs/serviços habilitados** (Service Usage API) — espinha do "o que usa".
- **Firestore** — bancos (default + nomeados), location, modo, coleções top-level.
- **Cloud Storage** — buckets, location, storage class.
- **Realtime Database** — instâncias.
- **Auth** — métodos de sign-in habilitados, domínios autorizados, MFA (config, não contagem de users).
- **Hosting + Functions** — já existem, mantidos.

Resultado: painel "Inventário do projeto" na tela do recurso `firebase-project`,
mostrando o mapa de serviços. Recursos novos (Firestore/Storage/RTDB) aparecem na
lista de recursos com seus `kind`.

## Não-objetivos (ficam pra depois / outra frente)

- Contagem de documentos por coleção e tamanho de bucket em bytes (precisa
  Monitoring/agregação cara — vira item de uso ao longo do tempo, Frente C/D).
- Postura de security rules detalhada (Frente C — hardening/segurança).
- Contagem de usuários do Auth (paginação cara).

## Abordagem (escolhida)

**Additive, sem migração de schema.** Tudo cabe no modelo atual:

- Cada serviço descoberto vira uma `Resource` nova (`kind` próprio) com uso/config
  em `metadata` — o collector já faz upsert de `ResourceDTO[]` sem mudança.
- O recurso `project:<pid>` ganha `metadata.serviceInventory`: lista normalizada
  `{ key, label, enabled, headline }` derivada das descobertas, pra UI renderizar
  um painel só sem N queries.

Alternativas descartadas:
- *Tabela `ServiceUsage` dedicada*: migração + mais código; ganho real só quando
  formos rastrear uso ao longo do tempo (adiar até precisar — YAGNI).
- *Provider novo `gcp`*: duplicaria credencial/identidade; Firebase já É um projeto
  GCP. Mantém no `FirebaseProvider`.

## Componentes

Todos os helpers novos em `src/providers/firebase.ts`, mesmo padrão dos atuais
(`listHostingSites`, `listCloudFunctions`): `async`, best-effort, retornam `[]`/
`undefined` em falha (try/catch), nunca lançam — pra uma API negada não derrubar a
coleta inteira (igual hoje).

| Helper | API | Retorna |
|--------|-----|---------|
| `listEnabledServices` | `serviceusage.googleapis.com/v1/projects/{pid}/services?filter=state:ENABLED` | `string[]` nomes de API (`firestore.googleapis.com`, ...) |
| `listFirestoreDatabases` | `firestore.googleapis.com/v1/projects/{pid}/databases` | `{ name, locationId, type }[]` |
| `listFirestoreCollections` | `firestore.googleapis.com/v1/.../documents:listCollectionIds` | `string[]` (best-effort, default db) |
| `listStorageBuckets` | `storage.googleapis.com/storage/v1/b?project={pid}` | `{ name, location, storageClass }[]` |
| `listRtdbInstances` | `firebasedatabase.googleapis.com/v1beta/projects/{pid}/locations/-/instances` | `{ name, state, databaseUrl }[]` |
| `getAuthConfig` | `identitytoolkit.googleapis.com/admin/v2/projects/{pid}/config` | `{ signIn, authorizedDomains, mfa }` |

`listResources` passa a montar: project (com `serviceInventory`) + hosting +
functions + **firestore + storage + rtdb**.

### Scopes
- `cloud-platform.read-only` cobre serviceusage, firestore admin (read), storage (read), firebasedatabase (read).
- `firebase` (já usado) cobre identitytoolkit config + hosting.

### `serviceInventory` (metadata do project)
```ts
type ServiceInventoryItem = {
  key: 'firestore'|'storage'|'rtdb'|'auth'|'hosting'|'functions'|'other';
  label: string;        // "Cloud Firestore"
  enabled: boolean;     // da Service Usage API
  headline?: string;    // "2 bancos · 14 coleções" | "3 buckets" | "Google, Email"
};
```

## Fluxo de dados

`runCollection` (inalterado) → `provider.listResources(view)` → agora retorna N
recursos a mais → upsert em `Resource` com metadata rica. UI lê `Resource` do banco
como hoje. Zero mudança no collector, no schema, nas rotas.

## Erros

Cada descoberta é isolada em try/catch e degrada pra vazio — uma API não-habilitada
(403/404) só significa "serviço não exibido", não falha de coleta. Idêntico ao
comportamento atual de hosting/functions.

## UI

- `src/app/(dash)/resources/[id]/page.tsx`: quando `kind === 'firebase-project'` e
  `metadata.serviceInventory` existe, renderiza `<ServiceInventoryPanel>` —
  grid de cards por serviço (enabled/headline). Novo componente em `src/ui/components/`.
- Recursos Firestore/Storage/RTDB já aparecem na lista existente via `kind`.

## Testes

`tests/unit/providers.firebase.test.ts` (estende o existente, mesmo mock de
`fetch` + `firebase-admin` + `google-auth-library`):
- descobre Firestore databases → emite `firebase-firestore`
- descobre Storage buckets → emite `firebase-storage-bucket`
- descobre RTDB instances → emite `firebase-rtdb`
- monta `serviceInventory` no project a partir de enabled services
- cada API com 403/404 → degrada, NÃO lança, project resource sobrevive
- não quebra os testes de hosting/functions/cost existentes

Verificação local: `npx vitest run tests/unit/providers.firebase.test.ts` +
`npx tsc --noEmit`. (Integração/DB precisa Postgres — roda no CI/VPS.)

## Done quando

- [ ] 6 helpers implementados, best-effort
- [ ] `listResources` emite firestore/storage/rtdb + `serviceInventory`
- [ ] painel de inventário na UI do project
- [ ] testes novos verdes + suite unit sem regressão + tsc limpo
