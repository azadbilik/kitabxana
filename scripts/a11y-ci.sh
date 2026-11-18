#!/usr/bin/env bash
# The accessibility check as CI runs it: a throwaway library (apps/api/prisma/seed-a11y.ts)
# in the database named by DATABASE_URL, the API and a production build of the web app
# started on local ports, then axe-core over every kind of page (apps/web/scripts/a11y.mjs).
#
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/a11y scripts/a11y-ci.sh
#
# The database must be empty: it is migrated and seeded here. Never point this at a real one
# (the seed refuses a database that already holds works). Needs a Chromium for Playwright:
# pnpm --dir apps/web exec playwright install chromium
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?set DATABASE_URL to an empty throwaway database}"
API_PORT="${API_PORT:-4010}"
WEB_PORT="${WEB_PORT:-3010}"
export DATABASE_URL
export JWT_SECRET="${JWT_SECRET:-a11y-check-only-a11y-check-only-0001}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-a11y-check-only-a11y-check-only-0002}"

pnpm --dir apps/api exec prisma migrate deploy
pnpm --dir apps/api exec ts-node --transpile-only prisma/seed-a11y.ts
pnpm --dir apps/api build

# The browser calls the API directly, as in development
export NEXT_PUBLIC_API_URL="http://localhost:$API_PORT/api"
export API_URL="$NEXT_PUBLIC_API_URL"
export SITE_URL="http://localhost:$WEB_PORT"
pnpm --dir apps/web build
# A standalone build serves its static files only when they sit beside the server
cp -R apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static
cp -R apps/web/public apps/web/.next/standalone/apps/web/public

pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT
# exec: the PID kept is node's own, so the trap stops the server and not just its subshell
(cd apps/api && PORT="$API_PORT" CORS_ORIGIN="$SITE_URL" exec node dist/main) &
pids+=($!)
PORT="$WEB_PORT" HOSTNAME=localhost node apps/web/.next/standalone/apps/web/server.js &
pids+=($!)

for url in "$NEXT_PUBLIC_API_URL/health" "$SITE_URL/"; do
  for _ in $(seq 1 60); do
    curl -sf -o /dev/null "$url" && continue 2
    sleep 1
  done
  echo "Timed out waiting for $url" >&2
  exit 1
done

BASE_URL="$SITE_URL" pnpm --dir apps/web a11y
