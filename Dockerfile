# =============================================================================
# Stage 1 — Frontend builder
# Installs root deps and compiles the Vite/React app → dist/
# =============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy workspace manifests so npm ci can resolve workspace members
COPY package.json package-lock.json .npmrc ./
COPY apps/web/package.json ./apps/web/
COPY apps/worker/package.json ./apps/worker/
COPY apps/api/package.json ./apps/api/

# Install all root (frontend) deps
RUN npm ci

# Copy frontend source
COPY index.html ./
COPY public ./public
COPY src ./src
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts tailwind.config.ts postcss.config.js components.json ./

# Build Vite SPA → dist/
RUN npm run build:frontend

# =============================================================================
# Stage 2 — API builder
# Installs API deps and compiles TypeScript → dist/
# =============================================================================
FROM node:20-alpine AS api-builder
WORKDIR /app

COPY apps/api/package.json ./
RUN npm install

COPY apps/api/src ./src
COPY apps/api/tsconfig.json ./

RUN npm run build

# =============================================================================
# Stage 3 — Production runner
# Lean image: API compiled JS + frontend static files
# =============================================================================
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY apps/api/package.json ./
RUN npm install --omit=dev

# API compiled JS
COPY --from=api-builder /app/dist ./dist

# Frontend static files served by Express at /
COPY --from=frontend-builder /app/dist ./public

# Railway uses $PORT; local dev defaults to 4000
EXPOSE 4000
CMD ["node", "dist/index.js"]
