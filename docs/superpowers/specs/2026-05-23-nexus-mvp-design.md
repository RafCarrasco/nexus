# Nexus MVP — Design Spec

**Date:** 2026-05-23
**Status:** Draft for review
**Owner:** Rafael Carrasco (Procurement Garage)

## 1. Purpose

Nexus is an internal observability dashboard that lets a 5-person technical team see, in one place, every cloud/SaaS application the company runs. For each application it surfaces:

- Current and historical cost
- Last activity / last triggered time
- Health status (errors, downtime, anomalies)
- Where it lives (provider, project, region)
- Friendly name for each connection
- Tenant allocation (which client uses which slice of a multi-tenant project)

It is **not** customer-facing. The MVP serves the internal team and is designed so customer-facing reporting can be added later.

## 2. Pain Points Addressed

| Pain | Nexus Answer |
|------|-------------|
| Surprise bills, no cost visibility | Daily cost snapshots per resource, charts, % delta vs 7-day avg |
| Zombie apps consuming budget | "Last activity" column; resources idle >30 days flagged |
| Chaotic inventory (which apps exist, who owns them) | Single inventory across providers with searchable client allocation |
| Late discovery of outages | Health polling every 5 min, incident feed, in-app alert badges |

## 3. Scope

### In Scope (MVP)

- **Providers:** Firebase (primary), Supabase (secondary), Docker on the VPS itself
- **Data:** cost snapshots, last-activity timestamp, health, resource inventory, tenant list
- **Features:** auth, dashboard, connection management, resource detail, incident feed, manual client↔resource allocation
- **Deployment:** single Docker Compose stack on the existing Hostinger VPS

### Out of Scope (Future Phases)

- Azure, Copilot Studio, GCP-non-Firebase adapters
- External notification channels (Teams, Telegram, email) — adapter interface ready, no implementations
- Customer-facing tenant portal
- Automated tenant cost pro-ration (MVP uses manual % allocation)
- Budget enforcement / kill-switch actions

## 4. Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js 22 LTS | LTS, native fetch, broad SDK support |
| Framework | Next.js 15 (App Router, TypeScript) | Single repo for UI + API + cron; SSR; mature ecosystem |
| UI | Tailwind CSS + shadcn/ui + lucide-react | Lightweight, accessible, looks polished by default |
| Database | PostgreSQL 16 (Docker) | Relational fit for inventory; volume on VPS disk |
| ORM | Prisma | Type-safe, versioned migrations |
| Auth | NextAuth v5 (Auth.js) with Google provider | SSO restricted to `@procurementgarage.com` domain |
| Crypto | Node `crypto` (AES-256-GCM) | Encrypt provider credentials at rest |
| Scheduler | `node-cron` (in-process) | MVP simplicity; replaceable with BullMQ later |
| Reverse proxy | Existing Traefik on VPS | Already running; TLS via Let's Encrypt labels |
| Container | Docker Compose | VPS already runs Docker + Traefik |

## 5. Architecture

### 5.1 Deployment Topology

```
VPS (177.7.41.38, Ubuntu 24.04, KVM 2 vCPU / 100 GB / 8 TB BW)
└── Docker Engine
    ├── traefik             (already deployed, shared)
    ├── nexus-web           (Next.js, port 3000, exposed via Traefik)
    └── nexus-db            (Postgres 16, volume: ./data/postgres)
```

Traefik routes `https://nexus.<company-domain>` → `nexus-web:3000`. Postgres is **not** exposed externally; only `nexus-web` reaches it on the internal Docker network.

### 5.2 Module Boundaries

```
src/
├── app/                    Next.js App Router (UI + API routes)
│   ├── (auth)/login        NextAuth pages
│   ├── (dash)/             authenticated dashboard pages
│   │   ├── page.tsx        overview
│   │   ├── connections/    list, create, edit providers
│   │   ├── resources/      inventory with filters
│   │   ├── resources/[id]/ detail view (cost chart, activity, tenants)
│   │   ├── incidents/      open + history
│   │   └── settings/       users, client allocation
│   └── api/                internal API routes (cron trigger, webhooks)
│
├── providers/              one adapter per integration
│   ├── types.ts            Provider interface + DTOs
│   ├── firebase.ts         FirebaseProvider
│   ├── supabase.ts         SupabaseProvider
│   ├── docker.ts           DockerProvider (Docker socket)
│   └── registry.ts         provider lookup by type
│
├── collector/              orchestrates polling
│   ├── scheduler.ts        node-cron registration
│   ├── runCollection.ts    one collection cycle for one connection
│   ├── anomaly.ts          cost-delta + idle detection → incidents
│   └── lock.ts             advisory lock to prevent overlap
│
├── db/                     Prisma client + schema + seeds
│   ├── schema.prisma
│   └── client.ts           singleton PrismaClient
│
├── auth/                   NextAuth config + middleware
│   ├── config.ts
│   └── middleware.ts       domain restriction enforcement
│
├── crypto/                 AES-GCM wrap/unwrap for credentials
│   └── vault.ts            encrypt(plaintext) / decrypt(payload)
│
├── notify/                 alert channels
│   ├── types.ts            Notifier interface
│   └── inApp.ts            writes to incidents table (MVP-only impl)
│
└── lib/                    cross-cutting helpers (logger, dates, money)
```

Each module has a single purpose, talks to neighbors only through its public surface (the file's named exports), and can be tested without spinning up the rest of the system.

### 5.3 Provider Interface

```ts
// src/providers/types.ts
export interface Provider {
  readonly type: 'firebase' | 'supabase' | 'docker';

  /** Discover resources under this connection. */
  listResources(conn: Connection): Promise<ResourceDTO[]>;

  /** Cost for a closed day (UTC). May be null if provider has no billing API. */
  getDailyCost(conn: Connection, resourceId: string, date: Date): Promise<CostDTO | null>;

  /** Most recent invocation/activity, or null if not derivable. */
  getLastActivity(conn: Connection, resourceId: string): Promise<Date | null>;

  /** Lightweight health check. */
  getHealth(conn: Connection, resourceId: string): Promise<HealthDTO>;

  /** Multi-tenant only: list tenants inside a resource. Empty array if not applicable. */
  listTenants(conn: Connection, resourceId: string): Promise<TenantDTO[]>;
}
```

Adding a new provider means creating one file under `src/providers/` and registering it in `registry.ts`. No other module changes.

### 5.4 Provider Implementations (MVP)

**FirebaseProvider** (`firebase-admin` SDK)
- `listResources`: enumerate Firestore databases, Functions, Hosting sites, Auth tenants
- `getDailyCost`: not available via Admin SDK — use **Cloud Billing API** with the same service account scoped to `cloud-billing.viewer`
- `getLastActivity`: Functions → latest log timestamp; Firestore → last write via metadata API; Hosting → latest release date
- `getHealth`: Functions error rate from Cloud Monitoring; Firestore reachability ping
- `listTenants`: `auth.tenantManager().listTenants()`

**SupabaseProvider** (Management API + PAT)
- `listResources`: `GET /v1/projects`
- `getDailyCost`: `GET /v1/organizations/{slug}/billing/usage` (daily granularity)
- `getLastActivity`: `GET /v1/projects/{ref}/database/usage` (last query timestamp from logs)
- `getHealth`: `GET /v1/projects/{ref}/health`
- `listTenants`: returns `[]` (Supabase has no native tenants)

**DockerProvider** (Docker Engine socket)
- `listResources`: `GET /containers/json?all=true`
- `getDailyCost`: returns `null` (no direct cost; future: pro-rate VPS monthly cost across containers by CPU-seconds)
- `getLastActivity`: `State.StartedAt` and last log line timestamp
- `getHealth`: container `State.Status` and `State.Health.Status` if defined
- `listTenants`: returns `[]`

### 5.5 Database Schema (Prisma)

```prisma
// connections — one row per provider account hooked up
model Connection {
  id              String   @id @default(cuid())
  name            String                       // friendly display name
  type            String                       // 'firebase' | 'supabase' | 'docker'
  credentials     Bytes                        // AES-GCM ciphertext (JSON blob)
  status          String   @default("active")  // 'active' | 'error' | 'paused'
  lastError       String?
  lastCollectedAt DateTime?
  ownerUserId     String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  resources       Resource[]
}

// resources — discovered units inside a connection (a Firestore DB, a container, etc.)
model Resource {
  id             String   @id @default(cuid())
  connectionId   String
  externalId     String                        // provider-native id
  name           String
  kind           String                        // 'firestore' | 'function' | 'hosting' | 'container' | …
  region         String?
  metadata       Json
  clientId       String?                       // allocated to which client (nullable)
  allocationPct  Int?                          // % of cost attributed to the client (for shared resources)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  connection     Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  tenants        Tenant[]
  costSnapshots  CostSnapshot[]
  activityLog    ActivityLog?
  incidents      Incident[]

  @@unique([connectionId, externalId])
}

model Tenant {
  id            String   @id @default(cuid())
  resourceId    String
  externalId    String
  displayName   String
  clientId      String?                        // optional manual assignment
  resource      Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  @@unique([resourceId, externalId])
}

model CostSnapshot {
  id          String   @id @default(cuid())
  resourceId  String
  date        DateTime                          // UTC day boundary
  amount      Decimal  @db.Decimal(12, 4)
  currency    String   @default("USD")
  source      String                            // 'cloud-billing' | 'supabase-billing' | 'derived'
  resource    Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  @@unique([resourceId, date, source])
  @@index([date])
}

model ActivityLog {
  resourceId    String   @id
  lastSeenAt    DateTime?
  source        String
  updatedAt     DateTime @updatedAt
  resource      Resource @relation(fields: [resourceId], references: [id], onDelete: Cascade)
}

model Incident {
  id          String    @id @default(cuid())
  resourceId  String
  type        String                            // 'cost_spike' | 'health_bad' | 'idle' | 'collection_failed'
  severity    String                            // 'info' | 'warn' | 'crit'
  message     String
  openedAt    DateTime  @default(now())
  resolvedAt  DateTime?
  payload     Json?
  resource    Resource  @relation(fields: [resourceId], references: [id], onDelete: Cascade)
  @@index([resolvedAt, openedAt])
}

model Client {
  id        String   @id @default(cuid())
  name      String   @unique
  createdAt DateTime @default(now())
}

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String?
  image         String?
  role          String   @default("member")   // 'admin' | 'member'
  createdAt     DateTime @default(now())
  auditEntries  AuditLog[]
}

model AuditLog {
  id        String   @id @default(cuid())
  userId    String
  action    String                              // 'connection.create' | 'allocation.update' | …
  target    String                              // entity affected (e.g. "Connection:abc123")
  payload   Json?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
  @@index([createdAt])
}
```

### 5.6 Collection Flow

```
node-cron tick every 5 min  →  collector.runAll()
  for each Connection where status='active':
    acquire advisory lock on (connectionId)
      provider = registry[connection.type]
      try:
        resources = provider.listResources(conn)          → upsert Resource rows
        for each resource:
          activity = provider.getLastActivity(...)        → upsert ActivityLog
          health   = provider.getHealth(...)              → if bad, open/update Incident
          tenants  = provider.listTenants(...)            → upsert Tenant rows
        connection.status = 'active'
        connection.lastCollectedAt = now()
      catch e:
        connection.status = 'error'
        connection.lastError = e.message
        open Incident(type='collection_failed', severity='warn')
    release lock

node-cron tick every 6 h  →  collector.runCost()
  for each closed-day (date = yesterday UTC):
    for each Connection:
      for each Resource:
        cost = provider.getDailyCost(conn, resource, date)
        if cost: upsert CostSnapshot
    anomaly.check():
      for each Resource:
        avg7d  = avg of last 7 CostSnapshots
        latest = today's CostSnapshot
        if latest > avg7d * 1.5 AND latest > $1:
          open Incident(type='cost_spike', severity='warn')
```

The UI **only reads from Postgres**. It never calls a provider SDK during an HTTP request. This keeps page loads fast and isolates provider outages from UX.

### 5.7 Multi-Tenant Allocation Strategy

Firebase projects are multi-tenant. Cost is billed per project, not per tenant. MVP approach:

1. `provider.listTenants()` populates `Tenant` rows automatically.
2. UI provides a "Tenants" tab on each resource where the operator manually assigns `clientId` and an optional weight (default: split evenly).
3. Cost views show "Cost by Client" by joining `CostSnapshot` → `Resource` → `Tenant`/`allocationPct`.
4. Phase 2 (out of scope here): instrument Cloud Functions/Firestore with `tenantId` labels to derive automatic pro-ration from Cloud Monitoring custom metrics.

### 5.8 Authentication

- NextAuth v5 with the Google provider.
- `signIn` callback rejects any email whose domain is not `@procurementgarage.com`.
- First user to sign in is promoted to `admin` automatically; subsequent users land as `member`.
- All `/api/*` and `/(dash)/*` routes are gated by middleware; unauthenticated requests redirect to `/login`.
- Session stored in JWT (no session table needed in DB).

### 5.9 Credential Vault

- A 32-byte `NEXUS_MASTER_KEY` lives in `.env` on the VPS (never committed).
- `vault.encrypt(obj)` returns `Buffer = iv (12 bytes) || ciphertext || tag (16 bytes)`, written to `Connection.credentials`.
- `vault.decrypt(buf)` rejects on tag mismatch.
- Master key rotation procedure documented in `/docs/operations/key-rotation.md` (Phase 2).
- Connection-create form posts credentials over TLS; server encrypts before persisting; plaintext never written to logs.

### 5.10 Notification Adapter

```ts
// src/notify/types.ts
export interface Notifier {
  readonly id: string;
  notify(incident: Incident, resource: Resource): Promise<void>;
}
```

MVP ships `InAppNotifier` only — it writes the incident row, which the UI surfaces as a badge and on `/incidents`. Stubs `TeamsNotifier`, `TelegramNotifier`, `EmailNotifier` are **not** included in MVP, but the registry-based dispatch (`for n of registeredNotifiers: await n.notify(...)`) is implemented so adding a channel later is a one-file change.

## 6. Error Handling

| Failure | Behaviour |
|---------|-----------|
| Provider SDK throws on `listResources` | catch, mark connection `error`, open `collection_failed` incident, move to next connection |
| Single resource health check throws | catch per-resource, continue with remaining resources |
| Cost API rate-limited (429) | exponential backoff 1s/5s/30s, then defer until next 6h tick |
| Database unreachable | crash the cron tick; supervisor (Docker `restart: unless-stopped`) restarts container; previous data still readable |
| Two cron ticks overlap | `pg_try_advisory_lock(hashtext(connectionId)::bigint)` — second tick exits noop and logs |
| Invalid credential at connection-create time | the create-handler runs a dry `listResources` before persisting; rejects with the SDK error if it throws |

## 7. Testing Strategy

- **Unit (Vitest):** every provider adapter against mocked SDK responses; `vault` encrypt/decrypt roundtrip; `anomaly` thresholds.
- **Integration:** `docker-compose.test.yml` spins ephemeral Postgres; `collector.runAll()` driven with a `FakeProvider` to assert DB state.
- **E2E (Playwright):** happy path — login → create Firebase connection (using a recorded HTTP fixture) → see resource appear → see cost snapshot after manual cron trigger → open incident manually → resolve.
- CI runs unit + integration on every push; E2E on the main branch.

## 8. Operations

### 8.1 First-Run Setup

```bash
cd /opt/nexus
cp .env.example .env             # fill GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXUS_MASTER_KEY, DATABASE_URL
docker compose up -d
docker compose exec nexus-web npx prisma migrate deploy
```

Traefik picks up the container via labels and provisions TLS.

### 8.2 Backups

- Nightly `pg_dump` cron on the host writes to `/opt/nexus/backups/nexus-YYYY-MM-DD.sql.gz`.
- Retention: 30 days local; manual offsite copy is operator's responsibility for MVP.

### 8.3 Logs

- Container stdout/stderr captured by Docker; `docker compose logs -f nexus-web`.
- App logs are JSON with `level`, `module`, `connectionId?`, `resourceId?` for grep-ability.

## 9. Future Phases (Tracked, Not Implemented)

1. **Notifications:** Teams (priority), Telegram, email — implement `Notifier` interface, add `notification_channels` table, route incident severity → channel.
2. **Azure + Copilot Studio adapters.**
3. **Auto tenant pro-ration** via instrumented Functions/Firestore custom metrics.
4. **Customer-facing tenant portal** — embedded **inside each multi-tenant project** (not inside Nexus). Each Firebase project ships a tenant-scoped portal that consumes Nexus data via a read-only API key bound to a single `tenantId`. Nexus exposes `GET /api/external/tenant/{tenantId}` (cost summary, recent activity, health) so the host project's portal can render the slice that belongs to its current logged-in tenant. Keeps the customer experience inside the product they already use; Nexus stays internal.
5. **Anomaly detection** beyond fixed thresholds — rolling baselines, weekday seasonality.
6. **Worker tier** (BullMQ + Redis) once any single collection cycle exceeds 30 s.

## 10. Open Questions

None blocking MVP. Items deliberately deferred listed in §9.
