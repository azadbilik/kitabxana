#!/bin/sh
# Purge kitabxana.az's Cloudflare cache, after a web deploy or an import readers should see at once.
# Pages are edge-cached for an hour, and cached HTML can point to /_next/static chunks a new build
# no longer has. Needs in deploy/tunnel/.env:
#   CF_ZONE_ID          the kitabxana.az zone (dashboard → kitabxana.az → Overview → API)
#   CF_PURGE_TOKEN      an API token limited to Zone · Cache Purge on kitabxana.az
# usage: deploy/tunnel/purge-cache.sh [url ...]   (no urls: purge everything)
set -eu
cd "$(dirname "$0")"
CF_ZONE_ID=$(sed -n 's/^CF_ZONE_ID=//p' .env | tr -d '"')
CF_PURGE_TOKEN=$(sed -n 's/^CF_PURGE_TOKEN=//p' .env | tr -d '"')
if [ -z "$CF_ZONE_ID" ] || [ -z "$CF_PURGE_TOKEN" ]; then
  echo "Set CF_ZONE_ID and CF_PURGE_TOKEN in deploy/tunnel/.env" >&2
  exit 1
fi

if [ $# -eq 0 ]; then
  body='{"purge_everything":true}'
else
  body=$(printf '"%s",' "$@")
  body="{\"files\":[${body%,}]}"
fi

result=$(curl -sS -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
  -H "Authorization: Bearer $CF_PURGE_TOKEN" -H 'Content-Type: application/json' --data "$body")
case "$result" in
  *'"success":true'*) echo "Purged ${*:-everything}" ;;
  *) echo "Purge failed: $result" >&2; exit 1 ;;
esac
