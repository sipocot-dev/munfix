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
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000
# Migrations are idempotent; seeding only creates the admin/categories if missing.
CMD ["sh", "-c", "npm run db:migrate && npm run db:seed && npm start"]
