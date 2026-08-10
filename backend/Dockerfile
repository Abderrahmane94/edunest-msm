# NOTE: build context must be the repo root (not backend/), because
# backend/tsconfig.json extends ../tsconfig.base.json.

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY backend/package.json ./
RUN npm install --legacy-peer-deps

# ---- Prisma Generate ----
FROM deps AS prisma
COPY backend/prisma.config.ts ./
COPY backend/prisma ./prisma/
RUN npx prisma generate

# ---- Build ----
FROM prisma AS build
COPY tsconfig.base.json /tsconfig.base.json
COPY backend/tsconfig.json ./
COPY backend/src ./src/
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY backend/package.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prisma /app/prisma.config.ts ./
COPY --from=prisma /app/prisma ./prisma/
COPY --from=build /app/dist ./dist/

EXPOSE 4000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
