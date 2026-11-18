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
# Readers' own data lives only on the live side and is never copied over: accounts, sessions,
# sign-in codes, saved items, reading positions, book shelves, lists, submissions
KEEP=(Session LoginCode Favorite ReadingState BookState ReadingList ReadingListItem Submission)
keep_sql=$(printf "'%s'," "${KEEP[@]}")
tables=()
while IFS= read -r t; do tables+=("$t"); done < <(psql "$L" -At -c "select tablename from pg_tables where schemaname='public' and tablename not in ('User','_prisma_migrations',${keep_sql%,}) order by 1")
args=()
list=""
for t in "${tables[@]}"; do args+=(-t "public.\"$t\""); list+="\"$t\","; done
{
  # Truncating the content tables cascades into the reader tables that point at works,
  # books and authors, so set the live reader rows aside first and put them back after
  for t in "${KEEP[@]}"; do echo "create temp table \"keep_$t\" as select * from \"$t\";"; done
  echo "truncate ${list%,} cascade;"
  pg_dump "$L" --data-only --disable-triggers --no-owner --no-acl "${args[@]}"
  echo "set session_replication_role = replica;"
  for t in "${KEEP[@]}"; do echo "insert into \"$t\" select * from \"keep_$t\" on conflict do nothing;"; done
  echo "set session_replication_role = origin;"
  # A saved item whose work, book or author is gone from the new data goes too
  cat <<'SQL'
delete from "Favorite" f where (f."workId" is not null and not exists (select 1 from "Work" w where w.id = f."workId"))
  or (f."collectionId" is not null and not exists (select 1 from "Collection" c where c.id = f."collectionId"))
  or (f."authorId" is not null and not exists (select 1 from "Author" a where a.id = f."authorId"));
delete from "ReadingState" r where not exists (select 1 from "Work" w where w.id = r."workId");
update "ReadingState" r set "translationId" = null where r."translationId" is not null and not exists (select 1 from "Translation" t where t.id = r."translationId");
delete from "BookState" b where not exists (select 1 from "Collection" c where c.id = b."collectionId");
update "BookState" b set "lastWorkId" = null where b."lastWorkId" is not null and not exists (select 1 from "Work" w where w.id = b."lastWorkId");
delete from "ReadingListItem" i where (i."workId" is not null and not exists (select 1 from "Work" w where w.id = i."workId"))
  or (i."collectionId" is not null and not exists (select 1 from "Collection" c where c.id = i."collectionId"));
update "Submission" s set "workId" = null where s."workId" is not null and not exists (select 1 from "Work" w where w.id = s."workId");
update "Submission" s set "authorId" = null where s."authorId" is not null and not exists (select 1 from "Author" a where a.id = s."authorId");
SQL
} > "$D/data.sql"
parts=""; for t in "${KEEP[@]}"; do parts+="(select count(*) from \"$t\")::text,"; done
reader_counts="select '${KEEP[*]}: ' || concat_ws(' ', ${parts%,})"
echo "live reader rows before: $(docker exec irs-az-tunnel-postgres-1 psql -U postgres -d irs_az -At -c "$reader_counts")"
echo "tables: ${#tables[@]}, dump bytes: $(wc -c < "$D/data.sql")"
docker exec -i irs-az-tunnel-postgres-1 psql -U postgres -d irs_az -q -v ON_ERROR_STOP=1 --single-transaction < "$D/data.sql" > "$D/load.log" 2>&1
echo "loaded"
echo "live reader rows after:  $(docker exec irs-az-tunnel-postgres-1 psql -U postgres -d irs_az -At -c "$reader_counts")"
q="select count(*) from \"Work\"; select count(*) from \"Author\"; select md5(string_agg(id||body, '' order by id)) from \"Translation\";"
loc=$(psql "$L" -At -c "$q" | tr '\n' ' ')
tun=$(docker exec irs-az-tunnel-postgres-1 psql -U postgres -d irs_az -At -c "$q" | tr '\n' ' ')
echo "local:  $loc"
echo "tunnel: $tun"
if [ "$loc" = "$tun" ]; then echo "MATCH"; else echo "MISMATCH" >&2; exit 1; fi
