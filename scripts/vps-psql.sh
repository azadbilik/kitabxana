#!/bin/bash
# psql on the server's database over SSH, arguments quoted for the remote shell.
# Host from deploy/vps.env (LIVE_HOST). Used as the sync target:
#   SYNC_TARGET_PSQL=scripts/vps-psql.sh scripts/sync-tunnel-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
. deploy/vps.env
exec ssh -i ~/.ssh/kitabxana_vps -o BatchMode=yes "deploy@$LIVE_HOST" \
  "docker exec -i irs-az-postgres-1 psql -U postgres -d irs_az $(printf '%q ' "$@")"
