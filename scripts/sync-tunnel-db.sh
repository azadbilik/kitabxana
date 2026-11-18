#!/bin/bash
# Copy the library's CONTENT from the local DB (DATABASE_URL in apps/api/.env) into the live
# tunnel DB (container irs-az-tunnel-postgres-1), then compare both sides table by table.
#
# What is copied: only the tables in CONTENT_TABLES below. The live copy of each is replaced
# by the local one, so anything edited through the live admin is overwritten.
# What is never touched: accounts and everything readers keep (NEVER_SYNC): sessions, saved
# items, reading positions, shelves, lists, and submissions waiting for review.
# A table in the local DB that is in neither list stops the script: decide where it belongs.
#
# How, in ONE transaction on the live DB (any error rolls all of it back):
#   1. session_replication_role = replica: foreign keys are neither checked nor cascaded.
#      (TRUNCATE ... CASCADE, which this script used to run, empties every table that
#      references a truncated one — it would wipe readers' shelves along with the works.)
#   2. DELETE every row of the content tables and COPY the local rows in. Ids are stable
#      across imports, so readers' rows keep pointing at the same works and books.
#   3. Back to normal mode; live view counts (Work.viewCount) are put back.
#   4. Rows that now point at nothing are settled: a reader's mark on a work or book that
#      no longer exists is deleted (what the FK's ON DELETE CASCADE would have done);
#      optional references (Submission.workId/authorId, Translation.submissionId,
#      BookState.lastWorkId, ReadingState.translationId) are set to NULL.
#   5. Every foreign key in the schema is verified by query; a single dangling row aborts.
#   6. Content that exists only on the live side because a submission was approved there
#      would be lost: the script aborts if any is missing afterwards, unless
#      SYNC_DROP_APPROVED=1. (Bring it into the local DB first.)
#
# The live DB must be on the same migration as the local one (checked).
# Afterwards reindex search: POST /api/search/reindex as the admin (see deploy/tunnel/README.md).
#
# Overrides, for testing against another database:
#   SYNC_SOURCE_URL   source instead of DATABASE_URL from apps/api/.env
#   SYNC_TARGET_PSQL  psql command for the target instead of the docker exec below,
#                     e.g. SYNC_TARGET_PSQL="psql postgresql://localhost:5432/irs_az_synctest"
set -euo pipefail
cd "$(dirname "$0")/.."

CONTENT_TABLES=(Author Collection Work Translation Tag AuthorTag WorkTag Artwork BlogPost)
NEVER_SYNC=(User Session LoginCode Favorite ReadingState BookState ReadingList ReadingListItem Submission _prisma_migrations)

if [ -n "${SYNC_SOURCE_URL:-}" ]; then
  L="$SYNC_SOURCE_URL"
else
  DBURL=$(grep '^DATABASE_URL' apps/api/.env | cut -d= -f2- | tr -d '"')
  L="${DBURL%%\?*}"
fi
read -r -a TARGET <<< "${SYNC_TARGET_PSQL:-docker exec -i irs-az-tunnel-postgres-1 psql -U postgres -d irs_az}"
target() { "${TARGET[@]}" -v ON_ERROR_STOP=1 "$@"; }

in_list() { local x="$1"; shift; for y in "$@"; do [ "$x" = "$y" ] && return 0; done; return 1; }

# Every table must be accounted for, on both sides
for side in local live; do
  if [ "$side" = local ]; then
    names=$(psql "$L" -At -c "select tablename from pg_tables where schemaname='public' order by 1")
  else
    names=$(target -At -c "select tablename from pg_tables where schemaname='public' order by 1")
  fi
  while IFS= read -r t; do
    [ -n "$t" ] || continue
    if ! in_list "$t" "${CONTENT_TABLES[@]}" && ! in_list "$t" "${NEVER_SYNC[@]}"; then
      echo "ERROR: table \"$t\" in the $side DB is in neither CONTENT_TABLES nor NEVER_SYNC." >&2
      echo "       Add it to one of them in scripts/sync-tunnel-db.sh (content is replaced on live; the rest is left alone)." >&2
      exit 1
    fi
  done <<< "$names"
  for t in "${CONTENT_TABLES[@]}"; do
    if ! grep -qx "$t" <<< "$names"; then echo "ERROR: content table \"$t\" is missing in the $side DB" >&2; exit 1; fi
  done
done

mig="select coalesce(max(migration_name), 'none') from _prisma_migrations where finished_at is not null and rolled_back_at is null"
lm=$(psql "$L" -At -c "$mig"); tm=$(target -At -c "$mig")
if [ "$lm" != "$tm" ]; then
  echo "ERROR: migrations differ (local: $lm, live: $tm). Deploy the API so both are on the same one, then sync." >&2
  exit 1
fi

D=$(mktemp -d "${TMPDIR:-/tmp}/kitabxana-sync.XXXXXX")
echo "dump dir: $D"
args=()
for t in "${CONTENT_TABLES[@]}"; do args+=(-t "public.\"$t\""); done

{
  cat <<'SQL'
BEGIN;
SET LOCAL search_path = public;

CREATE TEMP TABLE _sync_before ON COMMIT DROP AS
  SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Session") AS sessions,
         (SELECT count(*) FROM "Favorite") AS favorites, (SELECT count(*) FROM "ReadingState") AS reading,
         (SELECT count(*) FROM "BookState") AS books, (SELECT count(*) FROM "ReadingList") AS lists,
         (SELECT count(*) FROM "ReadingListItem") AS list_items, (SELECT count(*) FROM "Submission") AS submissions;
CREATE TEMP TABLE _sync_views ON COMMIT DROP AS
  SELECT id, "viewCount" FROM "Work" WHERE "viewCount" > 0;
CREATE TEMP TABLE _sync_approved ON COMMIT DROP AS
  SELECT 'Work' AS kind, "workId" AS id FROM "Submission" WHERE type = 'WORK' AND "workId" IS NOT NULL
  UNION ALL SELECT 'Author', "authorId" FROM "Submission" WHERE type = 'AUTHOR' AND "authorId" IS NOT NULL
  UNION ALL SELECT 'Translation', id FROM "Translation" WHERE "submissionId" IS NOT NULL;

SET LOCAL session_replication_role = replica;
SQL
  for t in "${CONTENT_TABLES[@]}"; do echo "DELETE FROM public.\"$t\";"; done
  pg_dump "$L" --data-only --no-owner --no-acl "${args[@]}"
  cat <<SQL
SET LOCAL session_replication_role = origin;
SET LOCAL search_path = public;

UPDATE "Work" w SET "viewCount" = v."viewCount" FROM _sync_views v WHERE w.id = v.id;

CREATE TEMP TABLE _sync_settled (what text, n bigint) ON COMMIT DROP;
WITH d AS (DELETE FROM "Favorite" f WHERE
    (f."workId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Work" x WHERE x.id = f."workId"))
 OR (f."collectionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Collection" x WHERE x.id = f."collectionId"))
 OR (f."authorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Author" x WHERE x.id = f."authorId")) RETURNING 1)
INSERT INTO _sync_settled SELECT 'Favorite rows deleted (target gone)', count(*) FROM d;
WITH d AS (DELETE FROM "ReadingState" r WHERE NOT EXISTS (SELECT 1 FROM "Work" x WHERE x.id = r."workId") RETURNING 1)
INSERT INTO _sync_settled SELECT 'ReadingState rows deleted (work gone)', count(*) FROM d;
WITH d AS (DELETE FROM "BookState" b WHERE NOT EXISTS (SELECT 1 FROM "Collection" x WHERE x.id = b."collectionId") RETURNING 1)
INSERT INTO _sync_settled SELECT 'BookState rows deleted (book gone)', count(*) FROM d;
WITH d AS (DELETE FROM "ReadingListItem" i WHERE
    (i."workId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Work" x WHERE x.id = i."workId"))
 OR (i."collectionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Collection" x WHERE x.id = i."collectionId")) RETURNING 1)
INSERT INTO _sync_settled SELECT 'ReadingListItem rows deleted (target gone)', count(*) FROM d;
WITH u AS (UPDATE "BookState" b SET "lastWorkId" = NULL
  WHERE b."lastWorkId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Work" x WHERE x.id = b."lastWorkId") RETURNING 1)
INSERT INTO _sync_settled SELECT 'BookState.lastWorkId cleared', count(*) FROM u;
WITH u AS (UPDATE "ReadingState" r SET "translationId" = NULL
  WHERE r."translationId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Translation" x WHERE x.id = r."translationId") RETURNING 1)
INSERT INTO _sync_settled SELECT 'ReadingState.translationId cleared', count(*) FROM u;
WITH u AS (UPDATE "Submission" s SET "workId" = NULL
  WHERE s."workId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Work" x WHERE x.id = s."workId") RETURNING 1)
INSERT INTO _sync_settled SELECT 'Submission.workId cleared', count(*) FROM u;
WITH u AS (UPDATE "Submission" s SET "authorId" = NULL
  WHERE s."authorId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Author" x WHERE x.id = s."authorId") RETURNING 1)
INSERT INTO _sync_settled SELECT 'Submission.authorId cleared', count(*) FROM u;
WITH u AS (UPDATE "Translation" t SET "submissionId" = NULL
  WHERE t."submissionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Submission" x WHERE x.id = t."submissionId") RETURNING 1)
INSERT INTO _sync_settled SELECT 'Translation.submissionId cleared', count(*) FROM u;

-- Foreign keys were not checked while loading: verify every one of them now
DO \$\$
DECLARE c record; n bigint; bad text := '';
BEGIN
  FOR c IN
    SELECT con.conname, con.conrelid::regclass::text AS child, con.confrelid::regclass::text AS parent,
           (SELECT string_agg(format('c.%I = p.%I', ca.attname, pa.attname), ' AND ')
              FROM unnest(con.conkey, con.confkey) AS k(ck, pk)
              JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = k.ck
              JOIN pg_attribute pa ON pa.attrelid = con.confrelid AND pa.attnum = k.pk) AS cond,
           (SELECT string_agg(format('c.%I IS NOT NULL', ca.attname), ' AND ')
              FROM unnest(con.conkey) AS k(ck)
              JOIN pg_attribute ca ON ca.attrelid = con.conrelid AND ca.attnum = k.ck) AS present
    FROM pg_constraint con JOIN pg_namespace ns ON ns.oid = con.connamespace
    WHERE con.contype = 'f' AND ns.nspname = 'public'
  LOOP
    EXECUTE format('SELECT count(*) FROM %s c WHERE %s AND NOT EXISTS (SELECT 1 FROM %s p WHERE %s)',
                   c.child, c.present, c.parent, c.cond) INTO n;
    IF n > 0 THEN
      bad := bad || format(E'\n  %s: %s row(s) of %s point at nothing in %s', c.conname, n, c.child, c.parent);
    END IF;
  END LOOP;
  IF bad <> '' THEN RAISE EXCEPTION 'sync aborted, it would leave broken references:%', bad; END IF;
END \$\$;

-- Content approved from submissions on the live side must not vanish unnoticed
DO \$\$
DECLARE lost text;
BEGIN
  SELECT string_agg(a.kind || ' ' || a.id, ', ') INTO lost FROM _sync_approved a
  WHERE (a.kind = 'Work' AND NOT EXISTS (SELECT 1 FROM "Work" x WHERE x.id = a.id))
     OR (a.kind = 'Author' AND NOT EXISTS (SELECT 1 FROM "Author" x WHERE x.id = a.id))
     OR (a.kind = 'Translation' AND NOT EXISTS (SELECT 1 FROM "Translation" x WHERE x.id = a.id));
  IF lost IS NOT NULL AND '${SYNC_DROP_APPROVED:-0}' <> '1' THEN
    RAISE EXCEPTION 'sync aborted: approved submissions exist only on the live side and would be deleted: %. Copy them into the local DB first, or rerun with SYNC_DROP_APPROVED=1.', lost;
  END IF;
END \$\$;

SELECT 'settled: ' || what || ': ' || n FROM _sync_settled WHERE n > 0;
SELECT 'readers before: ' || row_to_json(b)::text FROM _sync_before b;
SELECT 'readers after:  ' || row_to_json(a)::text FROM (
  SELECT (SELECT count(*) FROM "User") AS users, (SELECT count(*) FROM "Session") AS sessions,
         (SELECT count(*) FROM "Favorite") AS favorites, (SELECT count(*) FROM "ReadingState") AS reading,
         (SELECT count(*) FROM "BookState") AS books, (SELECT count(*) FROM "ReadingList") AS lists,
         (SELECT count(*) FROM "ReadingListItem") AS list_items, (SELECT count(*) FROM "Submission") AS submissions) a;
COMMIT;
SQL
} > "$D/data.sql"
echo "tables: ${#CONTENT_TABLES[@]}, dump bytes: $(wc -c < "$D/data.sql")"

if ! target -q -At < "$D/data.sql" > "$D/load.log" 2>&1; then
  echo "LOAD FAILED, nothing was changed (rolled back). Last lines of $D/load.log:" >&2
  tail -n 15 "$D/load.log" >&2
  exit 1
fi
grep -E '^(settled|readers)' "$D/load.log" || true
echo "loaded"

# Both sides must now hold the same content, row for row (view counts are the live side's own)
q=""
for t in "${CONTENT_TABLES[@]}"; do
  q+="select '$t ' || count(*) || ' ' || coalesce(md5(string_agg(md5((to_jsonb(t) - 'viewCount')::text), '' order by md5((to_jsonb(t) - 'viewCount')::text))), '-') from public.\"$t\" t;"
done
q+="select 'Translation.body ' || coalesce(md5(string_agg(id||body, '' order by id)), '-') from public.\"Translation\";"
loc=$(psql "$L" -At -c "$q")
tun=$(target -At -c "$q")
if [ "$loc" = "$tun" ]; then
  echo "$tun" | cut -d' ' -f1,2 | tr '\n' ';'; echo
  echo "MATCH"
else
  echo "MISMATCH" >&2
  diff <(echo "$loc") <(echo "$tun") >&2 || true
  exit 1
fi
