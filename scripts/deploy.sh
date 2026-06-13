#!/usr/bin/env bash
#
# Nexus deploy — pull main, migrate, rebuild web container, health-gate, rollback on failure.
# Invoked on the VPS by the GitHub Actions deploy workflow over SSH:
#   bash /usr/local/bin/nexus-deploy.sh
#
# Idempotent: no-ops when already at origin/main. Safe to re-run.
set -euo pipefail

NEXUS_DIR=${NEXUS_DIR:-/docker/nexus}
LOG_FILE=${LOG_FILE:-/var/log/nexus-deploy.log}
HEALTH_URL=${HEALTH_URL:-http://localhost:3000/api/health}
HEALTH_RETRIES=${HEALTH_RETRIES:-12}
HEALTH_INTERVAL=${HEALTH_INTERVAL:-5}

exec >> "$LOG_FILE" 2>&1
echo ""
echo "============================================"
echo "Nexus deploy started at $(date -u)"
echo "============================================"

cd "$NEXUS_DIR"

PREVIOUS_SHA=$(git rev-parse HEAD)
echo "Current: $PREVIOUS_SHA"

git fetch origin main
NEW_SHA=$(git rev-parse origin/main)
if [ "$PREVIOUS_SHA" = "$NEW_SHA" ]; then
  echo "Already at $NEW_SHA — nothing to do."
  exit 0
fi

rollback() {
  echo "!! Deploy FAILED — rolling code back to $PREVIOUS_SHA"
  git reset --hard "$PREVIOUS_SHA" || true
  docker compose build nexus-web || true
  docker compose up -d nexus-web || true
  echo "Rolled back. NOTE: forward DB migrations are not auto-reverted —"
  echo "keep migrations expand/contract (backward-compatible) so rollback stays safe."
  docker compose ps || true
  exit 1
}
trap rollback ERR

echo "Updating to $NEW_SHA"
git reset --hard "$NEW_SHA"

echo "Building web image..."
docker compose build nexus-web

# Migrate with the freshly built image BEFORE swapping the running container,
# so the new schema is in place when new code goes live. prisma migrate deploy
# only applies pending migrations and is a no-op when up to date.
echo "Applying migrations (prisma migrate deploy)..."
docker compose run --rm nexus-web npx prisma migrate deploy

echo "Recreating web container..."
docker compose up -d nexus-web

echo "Health gate: $HEALTH_URL"
for i in $(seq 1 "$HEALTH_RETRIES"); do
  sleep "$HEALTH_INTERVAL"
  code=$(curl -fsS -o /dev/null -w '%{http_code}' "$HEALTH_URL" 2>/dev/null || echo 000)
  if [ "$code" = "200" ]; then
    trap - ERR
    echo "Healthy after ${i} attempt(s)."
    docker compose ps
    echo "============================================"
    echo "Nexus deploy finished OK at $(date -u) → $NEW_SHA"
    echo "============================================"
    exit 0
  fi
  echo "Health attempt ${i}/${HEALTH_RETRIES}: HTTP ${code}"
done

# Never became healthy — trap fires rollback.
echo "Health gate timed out."
false
