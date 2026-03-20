# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – builder
# Installs ALL dependencies (including devDeps for tsc) and compiles TypeScript.
# Works whether the build context is:
#   • apps/api/   (docker-compose: context: ./apps/api)
#   • repo root   (Railway monorepo build)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy only the API's package.json so npm installs API-specific deps.
# We use "npm install" (not "npm ci") because apps/api has no standalone
# package-lock.json – the root lock file covers the whole monorepo.
COPY package.json ./
RUN npm install

# Copy API source files
COPY src ./src
COPY tsconfig.json ./

# Compile TypeScript → dist/
RUN npm run build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – runner (production-only, no devDeps)
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 4000
CMD ["node", "dist/index.js"]
