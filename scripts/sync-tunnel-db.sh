#!/bin/bash
# Copy every public table except User and _prisma_migrations from the local DB
# (DATABASE_URL in apps/api/.env) into the live tunnel DB (container irs-az-tunnel-postgres-1),
# then compare Work/Author counts and a Translation md5 on both sides.
# Overwrites the live data: the tunnel DB must be on the same migration as the local one.
# Afterwards reindex search in the tunnel api container (SearchService.reindexAll).
set -euo pipefail
cd "$(dirname "$0")/.."
DBURL=$(grep '^DATABASE_URL' apps/api/.env | cut -d= -f2- | tr -d '"')
L="${DBURL%%\?*}"
D=$(mktemp -d "${TMPDIR:-/tmp}/kitabxana-sync.XXXXXX")
echo "dump dir: $D"
tables=()
while IFS= read -r t; do tables+=("$t"); done < <(psql "$L" -At -c "select tablename from pg_tables where schemaname='public' and tablename not in ('User','_prisma_migrations') order by 1")
args=()
list=""
for t in "${tables[@]}"; do args+=(-t "public.\"$t\""); list+="\"$t\","; done
{
  echo "truncate ${list%,} cascade;"
  pg_dump "$L" --data-only --disable-triggers --no-owner --no-acl "${args[@]}"
} > "$D/data.sql"
echo "tables: ${#tables[@]}, dump bytes: $(wc -c < "$D/data.sql")"
docker exec -i irs-az-tunnel-postgres-1 psql -U postgres -d irs_az -q -v ON_ERROR_STOP=1 --single-transaction < "$D/data.sql" > "$D/load.log" 2>&1
echo "loaded"
q="select count(*) from \"Work\"; select count(*) from \"Author\"; select md5(string_agg(id||body, '' order by id)) from \"Translation\";"
loc=$(psql "$L" -At -c "$q" | tr '\n' ' ')
tun=$(docker exec irs-az-tunnel-postgres-1 psql -U postgres -d irs_az -At -c "$q" | tr '\n' ' ')
echo "local:  $loc"
echo "tunnel: $tun"
if [ "$loc" = "$tun" ]; then echo "MATCH"; else echo "MISMATCH" >&2; exit 1; fi
