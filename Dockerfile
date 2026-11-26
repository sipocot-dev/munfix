FROM node:22-alpine
WORKDIR /app

# NEXT_PUBLIC_* values are inlined into the client bundle at build time.
ARG NEXT_PUBLIC_MUNICIPALITY_NAME
ARG NEXT_PUBLIC_PROVINCE_NAME
ARG NEXT_PUBLIC_MAP_CENTER_LNG
ARG NEXT_PUBLIC_MAP_CENTER_LAT
ARG NEXT_PUBLIC_MAP_BOUNDS
ARG NEXT_PUBLIC_MAP_TILE_URL

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build \
 && mkdir -p /data/uploads .next/cache \
 && chown -R node:node /data .next/cache

ENV NODE_ENV=production
# Run as the image's unprivileged user; it owns only the upload volume and Next's cache.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
# Migrations are idempotent; seeding only creates the admin/categories if missing.
# exec: the server becomes PID 1's direct child chain, so SIGTERM from `docker stop` reaches it.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && exec npm start"]
