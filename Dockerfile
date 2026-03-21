# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – builder: install deps and build Vite/React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html ./
COPY public ./public
COPY src ./src
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY components.json ./

RUN npm run build:frontend

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – runner: serve static files
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["npx", "--yes", "serve", "dist", "-l", "3000"]
