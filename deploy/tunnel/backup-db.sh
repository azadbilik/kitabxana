#!/bin/sh
# Nightly dump of the live database (container irs-az-tunnel-postgres-1) into ~/kitabxana-backups
# as irs_az-<date>-<time>.dump (pg_dump custom format), keeping the newest 14.
# The dump holds readers' accounts: the folder is private (700) and stays on this machine.
# Runs from ~/Library/LaunchAgents/az.kitabxana.backup-db.plist (see README.md "Database Backup").
# Restore: docker exec -i irs-az-tunnel-postgres-1 pg_restore -U postgres -d irs_az --clean --if-exists < <file>
# Overrides: BACKUP_DIR, BACKUP_KEEP, PG_CONTAINER.
set -eu
dir="${BACKUP_DIR:-$HOME/kitabxana-backups}"
keep="${BACKUP_KEEP:-14}"
container="${PG_CONTAINER:-irs-az-tunnel-postgres-1}"
log() { echo "$(date -u +%FT%TZ) backup-db: $*"; }

umask 077
mkdir -p "$dir"
chmod 700 "$dir"
file="$dir/irs_az-$(date +%Y%m%d-%H%M%S).dump"
part="$file.part"
trap 'rm -f "$part"' EXIT

if ! docker exec "$container" pg_dump -U postgres -Fc irs_az > "$part"; then
  log "pg_dump failed; nothing kept" >&2
  exit 1
fi
# A dump that cannot be listed is not a backup: check before it counts towards the 14
if ! docker exec -i "$container" pg_restore -l < "$part" > /dev/null; then
  log "the dump is not readable; nothing kept" >&2
  exit 1
fi
mv "$part" "$file"
log "wrote $file ($(wc -c < "$file" | tr -d ' ') bytes)"

ls -1t "$dir"/irs_az-*.dump | tail -n +"$((keep + 1))" | while IFS= read -r old; do
  rm -f "$old"
  log "removed $old"
done
