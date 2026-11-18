# Laptop Hosting (Cloudflare Tunnel)

Serves the production stack from a laptop at **kitabxana.az** through a named Cloudflare tunnel, until a [VPS](../README.md) exists. A quick tunnel (random `*.trycloudflare.com` URL, no account) still works for throwaway previews; see the end.

```
kitabxana.az → cloudflared → Caddy 127.0.0.1:8787 ─┬─ /api/* → api:4000
                                                        └─ /*     → web:3000
                                  postgres, meilisearch (internal only)
```

Limits:
- Up only while the laptop is awake and `cloudflared` is running. No uptime guarantee.
- `www.kitabxana.az` is 308-redirected to the bare domain by Caddy.
- Separate Compose project (`irs-az-tunnel`) — doesn't touch the dev services on `:5433` / `:7700`.

## Named Tunnel (kitabxana.az)

The zone is on Cloudflare (nameservers set at online.az, which is reachable only from Azerbaijan). One-time setup, already done on this laptop:

```bash
cloudflared tunnel login                          # pick kitabxana.az; writes ~/.cloudflared/cert.pem
cloudflared tunnel create kitabxana               # writes ~/.cloudflared/<id>.json
cloudflared tunnel route dns kitabxana kitabxana.az
cloudflared tunnel route dns kitabxana www.kitabxana.az
```

`~/.cloudflared/config.yml` maps both hostnames to `http://localhost:8787` (tunnel id + credentials file, ingress rules, then `http_status:404`). `cloudflared service install` runs it as a launch agent, so it restarts after sleep and reboot. `.env` has `DOMAIN=kitabxana.az`.

## Start

All commands run from `deploy/tunnel/`.

```bash
# 1. Tunnel — note the printed URL. Run it in its own terminal tab and keep it open:
#    not via Claude Code's `!`, which kills it when the command times out.
brew install cloudflared
cloudflared tunnel --no-autoupdate --url http://localhost:8787

# 2. Environment (DOMAIN = tunnel hostname, without https://)
cat > .env <<EOF
DOMAIN=<name>.trycloudflare.com
POSTGRES_PASSWORD=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
MEILISEARCH_KEY=$(openssl rand -hex 16)
EOF

# 3. Build images (native arch — the GHCR images are amd64-only) and start the databases
docker compose build
docker compose up -d --wait postgres meilisearch

# 4. Copy the local database in (the real data lives in native Postgres on :5432)
pg_dump --no-owner --no-acl irs_az | docker compose exec -T postgres psql -q -U postgres -d irs_az

# 5. Start the rest; migrations run on API start
docker compose up -d --wait

# 6. Give the admin a new password and build the search index — before sharing the URL
./secure-admin.sh
```

## Updating Content

Texts are imported into the local database and copied to the live one from the repo root:

```bash
scripts/sync-tunnel-db.sh
```

It replaces only the content tables (authors, books, works, translations, tags, artworks, blog posts) and leaves accounts and everything readers keep (sessions, saved items, reading positions, shelves, lists, submissions) alone; the header of the script explains how, and what stops it. Both databases must be on the same migration, so deploy the API first when a migration is pending. Afterwards rebuild the search index: `POST /api/search/reindex` as the admin (202 at once; `GET /api/search/reindex` shows progress).

## Database Backup

The live database holds what cannot be re-imported: accounts, shelves, lists, submissions. `backup-db.sh` dumps it nightly to `~/kitabxana-backups` (`pg_dump` custom format, private folder) and keeps the newest 14.

```bash
./backup-db.sh    # once by hand, to see it work
sed "s|__REPO__|$(cd ../.. && pwd)|; s|__HOME__|$HOME|g" az.kitabxana.backup-db.plist > ~/Library/LaunchAgents/az.kitabxana.backup-db.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/az.kitabxana.backup-db.plist
```

Nightly at 04:10 (log: `~/Library/Logs/kitabxana-backup-db.log`); a laptop asleep then runs it on wake. The copies sit on the same disk as the database: they cover a bad sync or migration, not a lost laptop.

Restore:

```bash
docker exec -i irs-az-tunnel-postgres-1 pg_restore -U postgres -d irs_az --clean --if-exists < ~/kitabxana-backups/<file>.dump
```

## New Tunnel URL (Quick Tunnel Only)

```bash
# update DOMAIN in .env, then
docker compose up -d web api
```

## Source Scans

The scanned PDFs of the printed books (`anl-<bibid>.pdf`, `halle-<handle>.pdf`) live outside the repo in `~/kitabxana-scans` (override with `SCANS_DIR` in `.env`), mounted read-only into `api`. A collection or work offers its book once the file is there: no import or restart needed (the API rechecks every 5 minutes). It is not in git or the database dump: `backup-scans.sh` copies it to Cloudflare R2 nightly (upload-only, never deletes or overwrites there).

One-time setup:
1. Cloudflare dashboard → R2 → create bucket `kitabxana-scans`; then R2 → Manage API tokens → create a token with **Object Read & Write** on that bucket only.
2. Add to `.env`: `R2_ACCOUNT_ID=…`, `R2_ACCESS_KEY_ID=…`, `R2_SECRET_ACCESS_KEY=…`, `SCANS_BACKUP_BUCKET=kitabxana-scans`.
3. First run (about 3 GB): `./backup-scans.sh`
4. Nightly at 03:30 (log: `~/Library/Logs/kitabxana-backup-scans.log`):
   ```bash
   sed "s|__REPO__|$(cd ../.. && pwd)|; s|__HOME__|$HOME|g" az.kitabxana.backup-scans.plist > ~/Library/LaunchAgents/az.kitabxana.backup-scans.plist
   launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/az.kitabxana.backup-scans.plist
   ```
   A laptop asleep at 03:30 runs it on wake.

## Stop

Ctrl-C `cloudflared`, then:

```bash
docker compose down        # keep data
docker compose down -v     # drop data too
```
