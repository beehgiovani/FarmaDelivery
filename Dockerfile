FROM node:22-bookworm-slim

WORKDIR /app

ENV CI=true

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/admin/package.json ./apps/admin/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/motoboy-pwa/package.json ./apps/motoboy-pwa/package.json

RUN npm ci

COPY . .

RUN npm run prisma:generate -w apps/api

EXPOSE 3333 5173 5174

CMD ["npm", "run", "dev", "-w", "apps/api"]
