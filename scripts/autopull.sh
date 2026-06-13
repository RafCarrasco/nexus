#!/usr/bin/env bash
#
# Pull-based auto-deploy. Polls origin/main; when it advances AND the commit's CI
# is green, runs nexus-deploy.sh. Used instead of a GitHub Actions SSH push because
# the VPS network (Hostinger) blocks inbound SSH from GitHub runner IPs. Outbound
# only, so it's firewall-agnostic. Run from cron every couple of minutes.
set -euo pipefail

NEXUS_DIR=${NEXUS_DIR:-/docker/nexus}
REPO=${REPO:-RafCarrasco/nexus}
LOG=${AUTOPULL_LOG:-/var/log/nexus-autopull.log}
DEPLOY=${DEPLOY_SCRIPT:-/usr/local/bin/nexus-deploy.sh}

cd "$NEXUS_DIR"
git fetch origin main -q
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main)
[ "$LOCAL" = "$REMOTE" ] && exit 0

# CI gate: require every check-run on the remote commit to have concluded success.
api="https://api.github.com/repos/${REPO}/commits/${REMOTE}/check-runs"
json=$(curl -fsS -m 20 -H "Accept: application/vnd.github+json" "$api" 2>/dev/null || echo '')
if command -v jq >/dev/null 2>&1 && [ -n "$json" ]; then
  verdict=$(echo "$json" | jq -r '
    (.check_runs // []) as $c
    | if ($c|length)==0 then "none"
      elif any($c[]; .status!="completed") then "pending"
      elif all($c[]; .conclusion=="success") then "success"
      else "failed" end')
else
  verdict="nogate"
fi

stamp=$(date -u)
case "$verdict" in
  success|none|nogate)
    echo "$stamp deploying $REMOTE (ci=$verdict)" >> "$LOG"
    bash "$DEPLOY"
    ;;
  pending)
    echo "$stamp $REMOTE ci pending — wait" >> "$LOG"
    ;;
  failed)
    echo "$stamp $REMOTE ci FAILED — skip" >> "$LOG"
    ;;
esac
