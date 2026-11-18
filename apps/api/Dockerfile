# Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:24-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl qpdf \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.3.2
WORKDIR /repo

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --filter @irs-az/api...
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @irs-az/api exec prisma generate \
  && pnpm --filter @irs-az/api build \
  && pnpm --filter @irs-az/api deploy --prod --legacy /out \
  && cp -r apps/api/dist apps/api/prisma /out/ \
  && cd /out && npx prisma generate

FROM base AS runner
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
# State for the IndexNow and Telegram jobs; a volume mounted here inherits the ownership
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 4000
# Apply pending migrations, then start. exec: node replaces the shell, so it receives
# SIGTERM from `docker stop` and shuts down cleanly (enableShutdownHooks in main.ts)
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
