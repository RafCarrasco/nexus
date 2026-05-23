# Nexus — Deploy on VPS

```bash
git clone <repo> /opt/nexus
cd /opt/nexus
cp .env.example .env   # fill values
docker compose build
docker compose up -d
docker compose exec nexus-web npx prisma migrate deploy
```

Logs: `docker compose logs -f nexus-web`
Reset DB (dangerous): `docker compose down -v && rm -rf data/postgres`

## Microsoft Entra ID setup

1. Go to https://entra.microsoft.com/ → Identity → Applications → App registrations → New registration
   - Name: `Nexus`
   - Supported account types: "Accounts in this organizational directory only" (single tenant)
   - Redirect URI: Web → `https://<NEXUS_HOST>/api/auth/callback/microsoft-entra-id`
2. After creation, on the Overview page copy:
   - Application (client) ID → `AUTH_MICROSOFT_ENTRA_ID_ID`
   - Directory (tenant) ID → use in `AUTH_MICROSOFT_ENTRA_ID_ISSUER` as `https://login.microsoftonline.com/<tenant-id>/v2.0`
3. Certificates & secrets → New client secret → set expiration → copy the **Value** (not the ID) → `AUTH_MICROSOFT_ENTRA_ID_SECRET`
4. API permissions → confirm `User.Read` (Microsoft Graph, delegated) is present (default). No admin consent needed.
5. Put the three values in `/opt/nexus/.env` on the VPS, then `docker compose restart nexus-web`.

Domain restriction (`NEXUS_ALLOWED_EMAIL_DOMAIN=procurementgarage.com`) still gates sign-in by the email's domain after Microsoft authenticates the user.
