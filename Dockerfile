# NOVOTIC FLEET — imagen de producción (Node 20)
FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci

FROM deps AS build
COPY . .
RUN npx prisma generate && npx next build

FROM node:20-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=build /app ./
EXPOSE 3000
# Migra, asegura catálogos/admin inicial y arranca
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx prisma/bootstrap.ts && npx next start -p ${PORT}"]
