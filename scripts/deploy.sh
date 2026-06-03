#!/bin/bash
set -e

NEXUS_DIR=${NEXUS_DIR:-/docker/nexus}
LOG_FILE=${LOG_FILE:-/var/log/nexus-deploy.log}

exec >> "$LOG_FILE" 2>&1
echo ""
echo "============================================"
echo "Nexus deploy started at $(date -u)"
echo "============================================"

cd "$NEXUS_DIR"

# Save current commit so we can roll back if needed
PREVIOUS_SHA=$(git rev-parse HEAD)
echo "Previous SHA: $PREVIOUS_SHA"

# Pull latest
git fetch origin main
NEW_SHA=$(git rev-parse origin/main)
if [ "$PREVIOUS_SHA" = "$NEW_SHA" ]; then
  echo "Already at $NEW_SHA, nothing to do."
  exit 0
fi
git reset --hard "$NEW_SHA"
echo "Updated to: $NEW_SHA"

# Apply any new prisma migrations from prisma/migrations
echo "Checking for new migrations..."
for migration_dir in prisma/migrations/*/; do
  migration_name=$(basename "$migration_dir")
  applied=$(docker compose exec -T nexus-db psql -U nexus -d nexus -tAc "SELECT 1 FROM _prisma_migrations WHERE migration_name = '$migration_name' LIMIT 1;" 2>/dev/null || echo "")
  if [ -z "$applied" ]; then
    echo "Applying migration: $migration_name"
    cat "$migration_dir/migration.sql" | docker compose exec -T nexus-db psql -U nexus -d nexus
    # Record it
    docker compose exec -T nexus-db psql -U nexus -d nexus -c "
      INSERT INTO _prisma_migrations (id, checksum, migration_name, finished_at, applied_steps_count)
      VALUES (gen_random_uuid()::text, 'manual', '$migration_name', now(), 1)
      ON CONFLICT DO NOTHING;
    " 2>/dev/null || echo "Note: _prisma_migrations table may not exist yet, continuing"
  fi
done

# Build + restart web container only
echo "Building..."
docker compose build nexus-web

echo "Recreating..."
docker compose up -d nexus-web

# Wait for health
sleep 12
echo "Final state:"
docker compose ps

echo "============================================"
echo "Nexus deploy finished at $(date -u)"
echo "============================================"
