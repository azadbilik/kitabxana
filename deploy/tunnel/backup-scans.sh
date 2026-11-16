#!/bin/sh
# Copy the scanned source books (SCANS_DIR, default ~/kitabxana-scans) to a Cloudflare R2 bucket.
# Upload-only: files deleted or damaged locally are never deleted or overwritten in R2 by size alone.
# Needs in .env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, SCANS_BACKUP_BUCKET.
# Runs nightly from ~/Library/LaunchAgents/az.kitabxana.backup-scans.plist (see README.md).
set -eu
cd "$(dirname "$0")"
set -a; . ./.env; set +a
dir="${SCANS_DIR:-$HOME/kitabxana-scans}"

for v in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY SCANS_BACKUP_BUCKET; do
  eval "val=\${$v:-}"
  [ -n "$val" ] || { echo "$(date -u +%FT%TZ) backup-scans: $v missing in deploy/tunnel/.env" >&2; exit 1; }
done

echo "$(date -u +%FT%TZ) backup-scans: $dir -> r2:$SCANS_BACKUP_BUCKET"
docker run --rm -v "$dir:/scans:ro" \
  -e RCLONE_CONFIG_R2_TYPE=s3 -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
  -e RCLONE_CONFIG_R2_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e RCLONE_CONFIG_R2_ENDPOINT="https://$R2_ACCOUNT_ID.r2.cloudflarestorage.com" \
  -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true \
  rclone/rclone:1.71 copy /scans "r2:$SCANS_BACKUP_BUCKET" \
  --include '*.pdf' --immutable --transfers 4 --stats-one-line --stats 0 -v
echo "$(date -u +%FT%TZ) backup-scans: done"
