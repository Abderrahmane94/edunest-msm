# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY package.json ./
RUN npm install --legacy-peer-deps

# ---- Prisma Generate ----
FROM deps AS prisma
COPY prisma ./prisma/
RUN npx prisma generate

# ---- Build ----
FROM prisma AS build
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ---- Production ----
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev --legacy-peer-deps

COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=prisma /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=prisma /app/prisma ./prisma/
COPY --from=build /app/dist ./dist/

EXPOSE 4000

CMD ["node", "dist/server.js"]
