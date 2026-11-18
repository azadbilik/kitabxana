# Deployment

One Hetzner VPS running Docker Compose. CI builds images to GHCR, and every push to `main` deploys them. The site reaches the server through the Cloudflare named tunnel `kitabxana`, which connects out from the server, so only SSH is open.

```
Cloudflare (DNS, TLS, edge cache) ⇠ tunnel ⇠ cloudflared → Caddy :80 ─┬─ /api/* → api:4000 (NestJS)
                                                                    └─ /*     → web:3000 (Next.js)
                                          postgres, meilisearch, /opt/irs-az/scans (internal only)
```

[tunnel/README.md](tunnel/README.md) runs the same stack on a laptop; that was the live site until the VPS.

## One-time setup

### 1. Server

Hetzner CPX21-class (Ubuntu 24.04) with the admin key `~/.ssh/kitabxana_vps.pub` added at creation. Then, locally:

```bash
ssh root@<host> 'sh -s' < deploy/provision.sh "$(cat ~/.ssh/kitabxana_vps.pub)" "$(cat ~/.ssh/kitabxana_deploy.pub)"
echo 'LIVE_HOST=<host>' > deploy/vps.env    # scripts/vps-psql.sh and sync-tunnel-db.sh read it
```

`provision.sh` installs Docker, creates the `deploy` user, turns off password and root logins, allows only SSH through ufw, and adds swap and automatic security updates. From then on log in as `deploy` with `~/.ssh/kitabxana_vps`.

### 2. CI

```bash
gh variable set DEPLOY_HOST --body <host>
gh secret set DEPLOY_SSH_KEY < ~/.ssh/kitabxana_deploy
```

The deploy job logs in to GHCR with the job's own token, so the server keeps no registry credentials.

### 3. Stack files

On the server, in `/opt/irs-az`:
- `.env`: from [.env.example](.env.example), plus the reader sign-in keys (`MAIL_API_KEY`, `MAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) and `INDEXNOW_KEY`.
- `cloudflared/`: the tunnel's credentials JSON (from `~/.cloudflared/` on the machine that ran `cloudflared tunnel login`) and a `config.yml` like the laptop's, with `service: http://caddy:80`. Files must be readable by uid 65532.
- `scans/`: the scanned books, `rsync -a ~/kitabxana-scans/ deploy@<host>:/opt/irs-az/scans/`.

### 4. First deploy

Run the **CI / Deploy** workflow (Actions tab, or `gh workflow run deploy.yml`). It copies the compose file, Caddyfile and backup.sh, pulls the images and starts everything; migrations run on API start.

Copy the live database in full (users and reader data included) before the tunnel connects, then reindex search:

```bash
docker exec irs-az-tunnel-postgres-1 pg_dump -U postgres --clean --if-exists irs_az | gzip | \
  ssh -i ~/.ssh/kitabxana_vps deploy@<host> 'gunzip | docker exec -i irs-az-postgres-1 psql -q -U postgres -d irs_az'
ssh -i ~/.ssh/kitabxana_vps deploy@<host> 'docker exec -w /app irs-az-api-1 node -e "…SearchService.reindexAll()…"'
```

Reindexing runs in the background; `GET /api/search/reindex` shows progress. The API refuses to start in production without `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (random, 32+ characters), `SITE_URL` and `CORS_ORIGIN`; Compose sets them from `.env`. `GET /api/health` answers 200 while the API reaches the database.

Then stop `cloudflared` on the laptop; Cloudflare sends everything to the server's connector. The origin has no open web port, so `CF-Connecting-IP` (used for rate limits) can only come from Cloudflare.

### 5. Backups

```bash
crontab -e   # as deploy
15 3 * * * /opt/irs-az/backup.sh >> /opt/irs-az/backups/backup.log 2>&1
```

Keeps a week of nightly dumps in `/opt/irs-az/backups`, and 30 days in R2 once `R2_*` and `BACKUP_BUCKET` are in `.env`.

## Content updates

Imports still run against the local database; then copy the content to the server, keeping readers' data there:

```bash
scripts/sync-tunnel-db.sh        # targets the server whenever deploy/vps.env exists
```

## Operations

```bash
cd /opt/irs-az
docker compose ps                     # status
docker compose logs -f api            # logs
docker compose exec postgres psql -U postgres irs_az

# Roll back: set IMAGE_TAG in .env to an earlier commit SHA, then
docker compose up -d

# Restore a backup
gunzip -c backups/<file>.sql.gz | docker compose exec -T postgres psql -U postgres -d irs_az
```

## Local test of the production stack

```bash
docker build -f apps/api/Dockerfile -t ghcr.io/nomadical/irs-az-api:local .
docker build -f apps/web/Dockerfile -t ghcr.io/nomadical/irs-az-web:local .
cd deploy
# .env with DOMAIN=localhost, TLS=internal, IMAGE_TAG=local and the secrets
docker compose -p irs-az-prodtest up -d --wait   # → https://localhost
```
