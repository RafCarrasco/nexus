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
