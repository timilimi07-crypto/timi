# syntax=docker/dockerfile:1
# Build-Kontext ist das Projekt-Root:  docker build -f apps/web/Dockerfile .
# Stages:  migrate (führt Drizzle-Migrationen aus)  |  runtime (Standard, Next.js standalone)
ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
# Optional: zusätzliche CA (TLS-prüfender Firmen-Proxy) per BuildKit-Secret "extra_ca".
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca; fi; \
    pnpm install --frozen-lockfile
COPY apps/web apps/web
COPY packages packages

FROM deps AS migrate
CMD ["pnpm", "--filter", "@erl/db", "migrate"]

FROM deps AS build
RUN pnpm --filter @erl/web build

FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
